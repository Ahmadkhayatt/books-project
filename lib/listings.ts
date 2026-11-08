import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { BookCondition, ListingStatus, ListingType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { bookSearchConditions } from "@/lib/search";

/**
 * M2 listings read/write layer. Every function is server-only; the HTTP-facing
 * surface is the server actions in `app/[locale]/listings/[id]/actions.ts`.
 */

export type ListingWithBook = {
  id: string;
  bookId: string;
  type: ListingType;
  condition: BookCondition;
  priceCents: number | null;
  currency: string;
  status: ListingStatus;
  description: string | null;
  images: string[];
  location: string | null;
  meetupOptions: string | null;
  createdAt: Date;
  updatedAt: Date;
  book: {
    id: string;
    title: string;
    titleAr: string | null;
    coverUrl: string | null;
    subjects: string[];
    authors: Array<{ author: { name: string } }>;
  };
  seller: {
    id: string;
    username: string;
    name: string | null;
    status: ListingStatus;
    profile: { displayName: string | null } | null;
  };
};

export type ListingsPage = {
  listings: ListingWithBook[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ListingSort = "newest" | "priceLow" | "priceHigh";

export type ListingFilters = {
  q?: string;
  type?: string;
  condition?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  city?: string;
  genre?: string;
  sort?: ListingSort;
  page?: number;
  pageSize?: number;
  bookId?: string;
};

const DEFAULT_PAGE_SIZE = 10;

const listingInclude = {
  book: {
    include: {
      subjects: true,
      authors: { orderBy: { order: "asc" }, include: { author: true } },
    },
  },
  seller: { include: { profile: true } },
} satisfies Prisma.ListingInclude;

export async function getListingById(id: string): Promise<ListingWithBook | null> {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: listingInclude,
  });

  if (!listing) return null;
  if (listing.status === ListingStatus.CANCELLED) return null;

  return listing;
}

/**
 * Browse offers: ACTIVE listings only, newest first by default, with optional
 * `q` (title/author/ISBN via the trigram-backed catalog search conditions),
 * `type`, `condition`, price window, `city`, `genre` (book subject) and sort.
 */
export async function getListings(filters: ListingFilters): Promise<ListingsPage> {
  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const pageSize =
    filters.pageSize && filters.pageSize > 0 ? filters.pageSize : DEFAULT_PAGE_SIZE;

  const where: Prisma.ListingWhereInput = { status: ListingStatus.ACTIVE };
  if (filters.bookId) where.bookId = filters.bookId;
  if (filters.type) where.type = filters.type;
  if (filters.condition) where.condition = filters.condition;

  const conditions: Prisma.ListingWhereInput[] = [];
  if (filters.priceMin) conditions.push({ priceCents: { gte: filters.priceMin } });
  if (filters.priceMax) conditions.push({ priceCents: { lte: filters.priceMax } });
  if (conditions.length > 0) where.AND = [...(where.AND ?? []), ...conditions];

  const city = filters.city?.trim();
  if (city) {
    const existingAnd = Array.isArray(where.AND) ? where.AND : [];
    where.AND = [...existingAnd, { location: { contains: city, mode: "insensitive" } }];
  }

  const query = filters.q?.trim();
  if (query) where.book = bookSearchConditions(query);

  const genre = filters.genre?.trim();
  const sort = filters.sort ?? "newest";

  const orderBy =
    sort === "priceLow"
      ? { priceCents: "asc" as const }
      : sort === "priceHigh"
        ? { priceCents: "desc" as const }
        : { createdAt: "desc" as const };

  const shouldFilterGenre = Boolean(genre);
  const rows = await prisma.listing.findMany({
    where,
    include: listingInclude,
    orderBy,
    ...(shouldFilterGenre
      ? {}
      : { skip: (page - 1) * pageSize, take: pageSize }),
  });

  const listings = shouldFilterGenre
    ? rows.filter((listing) =>
        (listing.book.subjects ?? []).some(
          (subject) => subject.toLowerCase() === (genre ?? "").toLowerCase(),
        ),
      )
    : rows;

  const total = shouldFilterGenre
    ? listings.length
    : await prisma.listing.count({ where });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const paged = shouldFilterGenre ? listings.slice(start, start + pageSize) : listings;

  return { listings: paged, total, page: current, pageSize, totalPages };
}

export type ListingInput = {
  bookId: string;
  sellerId: string;
  type: ListingType;
  condition: BookCondition;
  priceCents: number | null;
  currency: string;
  description: string | null;
  location: string | null;
  meetupOptions: string | null;
  images: string[];
};

/** Owner creates a copy they finished → ACTIVE (reservations come later). */
export async function createListingRecord(input: ListingInput) {
  return prisma.listing.create({
    data: {
      bookId: input.bookId,
      sellerId: input.sellerId,
      type: input.type,
      condition: input.condition,
      priceCents: input.priceCents,
      currency: input.currency,
      status: ListingStatus.ACTIVE,
      description: input.description,
      images: input.images,
      location: input.location,
      meetupOptions: input.meetupOptions,
    },
    include: listingInclude,
  });
}

export async function updateListingRecord(
  listingId: string,
  data: {
    type: ListingType;
    condition: BookCondition;
    priceCents: number | null;
    currency: string;
    description: string | null;
    location: string | null;
    meetupOptions: string | null;
    images: string[];
  },
) {
  return prisma.listing.update({
    where: { id: listingId },
    data: { ...data },
    include: listingInclude,
  });
}

export async function cancelListingRecord(listingId: string) {
  return prisma.listing.update({
    where: { id: listingId },
    data: { status: ListingStatus.CANCELLED },
    include: listingInclude,
  });
}

/** ACTIVE → RESERVED (exchange completion flips to COMPLETED in M4). */
export async function reserveListingRecord(listingId: string) {
  return prisma.listing.update({
    where: { id: listingId },
    data: { status: ListingStatus.RESERVED },
    include: listingInclude,
  });
}
