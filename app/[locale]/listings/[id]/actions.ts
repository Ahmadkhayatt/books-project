"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ListingStatus } from "@/generated/prisma/enums";
import { auth } from "@/auth";
import { getImageStore } from "@/lib/images";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  cancelListingRecord,
  createListingRecord,
  reserveListingRecord,
  updateListingRecord,
} from "@/lib/listings";

/**
 * Listing lifecycle actions (M2). Every action re-checks the session **and**
 * the persisted user status — hiding a form is never the guard. Failures
 * surface as `?error=` codes the pages map to friendly copy; raw database
 * errors never leave the server.
 */

const MAX_LISTING_IMAGES = 6;
const MAX_USER_UPLOADS = 60;

type Locale = "ar" | "en";

function localeFrom(value: FormDataEntryValue | null): Locale {
  return value === "en" ? "en" : "ar";
}

function listingPath(locale: Locale, listingId: string): string {
  return `/${locale}/listings/${listingId}`;
}

function signInHref(locale: Locale, callbackPath: string): string {
  return `/${locale}/sign-in?callbackUrl=${encodeURIComponent(callbackPath)}`;
}

async function activeUserId(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  return user?.status === "ACTIVE" ? user.id : null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function revalidateListingPaths(listingId: string, bookId?: string): void {
  revalidatePath("/ar/listings");
  revalidatePath("/en/listings");
  revalidatePath(`/ar/listings/${listingId}`);
  revalidatePath(`/en/listings/${listingId}`);
  if (bookId) {
    revalidatePath(`/ar/books/${bookId}`);
    revalidatePath(`/en/books/${bookId}`);
  }
}

const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text === "" ? null : text;
  }, z.string().max(max).nullable());

const optionalInt = (min: number, max: number) =>
  z.preprocess((value) => {
    const text = typeof value === "string" ? value.trim() : "";
    if (text === "") return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : Number.NaN;
  }, z.number().int().min(min).max(max).nullable());

const listingSchema = z.object({
  bookId: z.string().trim().min(1).max(64),
  type: z.enum(["SELL", "SWAP", "FREE"]),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "ACCEPTABLE", "WORN"]),
  priceCents: optionalInt(0, 100_000_000),
  currency: z.string().trim().min(3).max(8).default("EGP"),
  description: optionalText(2000),
  location: optionalText(200),
  meetupOptions: optionalText(500),
});

type ListingDraft = z.infer<typeof listingSchema>;

type ListingDraftResult =
  | { ok: true; data: ListingDraft }
  | { ok: false };

/** Deployment default for new listings (PLAN §16.1); EGP when unset/invalid. */
function defaultCurrency(): string {
  const raw = process.env.DEFAULT_CURRENCY?.trim().toUpperCase();
  return raw && /^[A-Z]{3,8}$/.test(raw) ? raw : "EGP";
}

function listingDraftFrom(formData: FormData): ListingDraftResult {
  const parsed = listingSchema.safeParse({
    bookId: String(formData.get("bookId") ?? ""),
    type: String(formData.get("type") ?? ""),
    condition: String(formData.get("condition") ?? ""),
    priceCents: formData.get("priceCents"),
    currency: String(formData.get("currency") ?? "") || defaultCurrency(),
    description: formData.get("description"),
    location: formData.get("location"),
    meetupOptions: formData.get("meetupOptions"),
  });

  if (!parsed.success) {
    return { ok: false };
  }

  // SELL offers need a price; SWAP/FREE copies never carry one.
  if (parsed.data.type === "SELL" && parsed.data.priceCents == null) {
    return { ok: false };
  }
  const priceCents =
    parsed.data.type === "SELL" ? parsed.data.priceCents : null;

  return { ok: true, data: { ...parsed.data, priceCents } };
}

/** Files the client posted (`<input type="file" name="images" multiple />`). */
async function postedImages(formData: FormData): Promise<File[]> {
  const entries = formData.getAll("images");
  const files: File[] = [];
  for (const entry of entries) {
    if (entry instanceof File) files.push(entry);
  }
  return files;
}

async function uploadImages(files: File[]): Promise<string[]> {
  const store = getImageStore();
  const urls: string[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await store.put(buffer, file.type ?? undefined);
    urls.push(url);
  }
  return urls;
}

/**
 * Owner publishes a copy they finished → ACTIVE. Rate limited per user
 * (`listing:create:<uid>`, 20 creates / 24h) and capped at 60 stored uploads
 * per user across all of their listings.
 */
export async function createListing(formData: FormData): Promise<void> {
  const locale = localeFrom(formData.get("locale"));
  const draftResult = listingDraftFrom(formData);
  const errorHref = `/${locale}/listings/new?error=listingInvalid`;

  if (!draftResult.ok) redirect(errorHref);

  const draft = draftResult.data;

  const userId = await activeUserId();
  if (!userId) {
    redirect(signInHref(locale, `/${locale}/listings/new`));
  }

  const limit = await checkRateLimit(
    `listing:create:${userId}`,
    RATE_LIMITS.listingCreate,
  );
  if (!limit.ok) redirect(`/${locale}/listings/new?error=rateLimited`);

  const files = await postedImages(formData);
  if (files.length > MAX_LISTING_IMAGES) redirect(errorHref);

  const sellerListings = await prisma.listing.findMany({
    where: { sellerId: userId },
    select: { images: true },
  });
  const storedUploads = sellerListings.reduce(
    (sum, row) => sum + row.images.length,
    0,
  );
  if (storedUploads + files.length > MAX_USER_UPLOADS) {
    redirect(errorHref);
  }

  const imageUrls = files.length > 0 ? await uploadImages(files) : [];

  let createdId: string;
  try {
    const created = await createListingRecord({
      bookId: draft.bookId,
      sellerId: userId,
      type: draft.type,
      condition: draft.condition,
      priceCents: draft.priceCents,
      currency: draft.currency,
      description: draft.description,
      location: draft.location,
      meetupOptions: draft.meetupOptions,
      images: imageUrls,
    });
    createdId = created.id;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect(`/${locale}/listings/new?error=listingInvalid`);
    }
    console.error("[listings] create failed", error);
    redirect(errorHref);
  }

  revalidateListingPaths(createdId, draft.bookId);
  redirect(`/${locale}/listings/${createdId}?notice=listingCreated`);
}

/**
 * Owner edits their ACTIVE offer. `status` only moves via the transitions
 * below — the edit path never overwrites lifecycle state.
 */
export async function updateListing(formData: FormData): Promise<void> {
  const locale = localeFrom(formData.get("locale"));
  const listingId = String(formData.get("listingId") ?? "").trim();
  const draftResult = listingDraftFrom(formData);

  const errorHref = `/${locale}/listings/${listingId}?error=listingInvalid`;

  if (!listingId) redirect(errorHref);
  if (!draftResult.ok) redirect(errorHref);

  const draft = draftResult.data;

  const userId = await activeUserId();
  if (!userId) {
    redirect(signInHref(locale, listingPath(locale, listingId)));
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, status: true, images: true },
  });
  if (!listing || listing.sellerId !== userId) {
    redirect(listingPath(locale, listingId));
  }
  if (listing.status !== ListingStatus.ACTIVE) {
    redirect(errorHref);
  }

  const files = await postedImages(formData);
  if (files.length > MAX_LISTING_IMAGES) redirect(errorHref);
  const imageUrls =
    files.length > 0 ? await uploadImages(files) : listing.images;
  // Per-user quota (60) must still hold after the edit replaces photos.
  const sellerImages = await prisma.listing.findMany({
    where: { sellerId: userId },
    select: { id: true, images: true },
  });
  const otherUploads = sellerImages
    .filter((row) => row.id !== listing.id)
    .reduce((sum, row) => sum + row.images.length, 0);
  if (otherUploads + imageUrls.length > MAX_USER_UPLOADS) {
    redirect(errorHref);
  }
  const staleKeys = listing.images.filter(
    (image) => !imageUrls.includes(image),
  );
  const store = getImageStore();
  for (const key of staleKeys) {
    await store.delete(key);
  }

  try {
    await updateListingRecord(listingId, {
      type: draft.type,
      condition: draft.condition,
      priceCents: draft.priceCents,
      currency: draft.currency,
      description: draft.description,
      location: draft.location,
      meetupOptions: draft.meetupOptions,
      images: imageUrls,
    });
  } catch (error) {
    console.error("[listings] update failed", error);
    redirect(errorHref);
  }

  revalidateListingPaths(listingId, draft.bookId);
  redirect(`/${locale}/listings/${listingId}?notice=listingUpdated`);
}

/**
 * Owner delists their offer → CANCELLED. Allowed from ACTIVE or RESERVED;
 * a cancelled listing disappears from every browse surface immediately.
 */
export async function cancelListing(formData: FormData): Promise<void> {
  const locale = localeFrom(formData.get("locale"));
  const listingId = String(formData.get("listingId") ?? "").trim();

  const userId = await activeUserId();
  if (!userId) {
    redirect(signInHref(locale, listingPath(locale, listingId)));
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, status: true },
  });
  if (!listing) redirect(`/${locale}/listings`);

  if (listing.sellerId !== userId) {
    redirect(listingPath(locale, listingId));
  }
  if (
    listing.status !== ListingStatus.ACTIVE &&
    listing.status !== ListingStatus.RESERVED
  ) {
    redirect(listingPath(locale, listingId));
  }

  try {
    await cancelListingRecord(listing.id);
  } catch (error) {
    console.error("[listings] cancel failed", error);
    redirect(listingPath(locale, listingId));
  }

  revalidateListingPaths(listing.id);
  redirect(`/${locale}/listings/${listing.id}?notice=listingCancelled`);
}

/**
 * Reader reserves an ACTIVE copy → RESERVED. Self-reserve is blocked and the
 * reservation only applies to ACTIVE offers (the M4 exchange flow completes
 * them into COMPLETED).
 */
export async function reserveListing(formData: FormData): Promise<void> {
  const locale = localeFrom(formData.get("locale"));
  const listingId = String(formData.get("listingId") ?? "").trim();

  const userId = await activeUserId();
  if (!userId) {
    redirect(signInHref(locale, listingPath(locale, listingId)));
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, status: true },
  });
  if (!listing) redirect(`/${locale}/listings`);

  if (listing.status !== ListingStatus.ACTIVE) {
    redirect(listingPath(locale, listingId));
  }
  if (listing.sellerId === userId) {
    redirect(listingPath(locale, listingId));
  }

  try {
    await reserveListingRecord(listing.id);
  } catch (error) {
    console.error("[listings] reserve failed", error);
    redirect(listingPath(locale, listingId));
  }

  revalidateListingPaths(listing.id);
  redirect(`/${locale}/listings/${listing.id}?notice=listingReserved`);
}
