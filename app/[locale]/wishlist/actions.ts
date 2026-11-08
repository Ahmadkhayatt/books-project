"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toggleWishlistItem } from "@/lib/wishlist";

/**
 * Wishlist toggle action (M2). Re-checks the session and the persisted user
 * status (suspended users cannot save), then redirects back to the
 * originating surface with a lifecycle notice.
 */

type Locale = "ar" | "en";

function localeFrom(value: FormDataEntryValue | null): Locale {
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

export async function wishlistToggleAction(
  formData: FormData,
): Promise<void> {
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
