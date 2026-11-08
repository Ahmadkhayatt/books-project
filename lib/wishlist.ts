"use server";

import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Wishlist read/write layer (M2). Toggle semantics: delete-if-present,
 * create-if-absent; a concurrent unique-constraint race resolves as a no-op
 * (`{ wished: false }` — the desired end state already holds).
 */

export type WishlistToggleResult = { wished: boolean };

export async function toggleWishlistItem(
  userId: string,
  bookId: string,
): Promise<WishlistToggleResult> {
  try {
    const deleted = await prisma.wishlistItem.deleteMany({
      where: { userId, bookId },
    });
    if (deleted.count > 0) return { wished: false };

    await prisma.wishlistItem.create({ data: { userId, bookId } });
    return { wished: true };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      // Unique (userId, bookId) raced us — treat as no-op.
      return { wished: false };
    }
    throw error;
  }
}

export async function getWishlistForUser(userId: string) {
  return prisma.wishlistItem.findMany({
    where: { userId },
    include: {
      book: {
        include: {
          subjects: true,
          authors: { orderBy: { order: "asc" }, include: { author: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

function localeFrom(value: FormDataEntryValue | null): "ar" | "en" {
  return value === "en" ? "en" : "ar";
}

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  return user?.status === "ACTIVE" ? user.id : null;
}

/**
 * Wishlist toggle server action. Redirects back to the originating surface
 * with a lifecycle notice (`wishlistAdded` / `wishlistRemoved`).
 */
export async function wishlistToggleAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData.get("locale"));
  const userId = await currentUserId();
  const bookId = String(formData.get("bookId") ?? "").trim();

  if (!userId || !bookId) {
    redirect(`/${locale}/wishlist`);
  }

  const wished = await toggleWishlistItem(userId, bookId);
  const target =
    String(formData.get("from") ?? "").trim() === "wishlist"
      ? `/${locale}/wishlist`
      : `/${locale}/books/${bookId}`;

  if (wished) {
    redirect(`${target}?notice=wishlistAdded`);
  }
  redirect(`${target}?notice=wishlistRemoved`);
}
