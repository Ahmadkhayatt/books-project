import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Wishlist read/write layer (M2). Toggle semantics: delete-if-present,
 * create-if-absent; a concurrent unique-constraint race resolves as a no-op
 * (`{ wished: false }` — the desired end state already holds).
 *
 * The form-facing action lives in `app/[locale]/wishlist/actions.ts`
 * ("use server"); this module stays a plain server-only helper so pages can
 * import reads without going through an action boundary.
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

export async function isWishlisted(
  userId: string | null,
  bookId: string,
): Promise<boolean> {
  if (!userId) return false;
  const found = await prisma.wishlistItem.findUnique({
    where: { userId_bookId: { userId, bookId } },
    select: { userId: true },
  });
  return found !== null;
}

export async function getWishlistForUser(userId: string) {
  return prisma.wishlistItem.findMany({
    where: { userId },
    include: {
      book: {
        include: {
          authors: { orderBy: { order: "asc" }, include: { author: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
