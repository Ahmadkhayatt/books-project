"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Engagement actions for the book record page (M1).
 *
 * Every action re-checks the session **and** the persisted user status —
 * hiding a form is never the guard. Failures surface as `?error=` codes that
 * the page maps to friendly copy; raw database errors never leave the server.
 */

export type ReviewFormState = { ok: boolean; message?: string };
export type CommentFormState = { ok: boolean; message?: string };

type Locale = "ar" | "en";

function localeFrom(value: FormDataEntryValue | null): Locale {
  return value === "en" ? "en" : "ar";
}

function bookPath(locale: Locale, bookId: string): string {
  return `/${locale}/books/${bookId}`;
}

function signInHref(locale: Locale, bookId: string): string {
  return `/${locale}/sign-in?callbackUrl=${encodeURIComponent(
    bookPath(locale, bookId),
  )}`;
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

function revalidateBook(bookId: string): void {
  revalidatePath(`/ar/books/${bookId}`);
  revalidatePath(`/en/books/${bookId}`);
  revalidatePath("/ar/books");
  revalidatePath("/en/books");
}

/** POST-safe rating upsert: one row per reader per book (DB unique mirrors it). */
export async function rateBook(
  bookId: string,
  value: number,
  locale: string = "ar",
): Promise<{ ok: boolean }> {
  const loc: Locale = locale === "en" ? "en" : "ar";
  const parsed = z
    .object({
      bookId: z.string().trim().min(1).max(64),
      value: z.number().int().min(1).max(5),
    })
    .safeParse({ bookId, value });

  if (!parsed.success) return { ok: false };

  const userId = await activeUserId();
  if (!userId) redirect(signInHref(loc, parsed.data.bookId));

  try {
    await prisma.rating.upsert({
      where: {
        userId_bookId: { userId, bookId: parsed.data.bookId },
      },
      update: { value: parsed.data.value },
      create: {
        userId,
        bookId: parsed.data.bookId,
        value: parsed.data.value,
      },
    });
  } catch (error) {
    console.error("[books] rating failed", error);
    return { ok: false };
  }

  revalidateBook(parsed.data.bookId);
  return { ok: true };
}

/** One review per reader per book — an edit replaces the previous body. */
export async function saveReview(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const locale = localeFrom(formData.get("locale"));
  const bookId = String(formData.get("bookId") ?? "").trim();
  const target = bookPath(locale, bookId);

  if (!bookId) redirect(`/${locale}/books`);

  const parsed = z
    .object({
      title: z
        .string()
        .trim()
        .max(150)
        .optional()
        .transform((value) => (value ? value : null)),
      body: z.string().trim().min(3).max(5000),
      containsSpoiler: z.boolean(),
    })
    .safeParse({
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      containsSpoiler: formData.get("containsSpoiler") === "1",
    });

  const userId = await activeUserId();
  if (!userId) redirect(signInHref(locale, bookId));
  if (!parsed.success) redirect(`${target}?error=reviewInvalid`);

  try {
    await prisma.review.upsert({
      where: { userId_bookId: { userId, bookId } },
      update: {
        title: parsed.data.title,
        body: parsed.data.body,
        containsSpoiler: parsed.data.containsSpoiler,
        language: locale,
      },
      create: {
        userId,
        bookId,
        title: parsed.data.title,
        body: parsed.data.body,
        containsSpoiler: parsed.data.containsSpoiler,
        language: locale,
      },
    });
  } catch (error) {
    console.error("[books] review save failed", error);
    redirect(`${target}?error=reviewInvalid`);
  }

  revalidateBook(bookId);
  return { ok: true };
}

/** Hard delete of the reader's own review; its comments cascade in the DB. */
export async function deleteReview(formData: FormData): Promise<void> {
  const locale = localeFrom(formData.get("locale"));
  const bookId = String(formData.get("bookId") ?? "").trim();
  if (!bookId) return;

  const userId = await activeUserId();
  if (!userId) redirect(signInHref(locale, bookId));

  try {
    await prisma.review.deleteMany({ where: { userId, bookId } });
  } catch (error) {
    console.error("[books] review delete failed", error);
    redirect(`${bookPath(locale, bookId)}?error=reviewInvalid`);
  }

  revalidateBook(bookId);
  redirect(`${bookPath(locale, bookId)}?notice=reviewDeleted`);
}

async function commentDepth(commentId: string): Promise<number> {
  let depth = 1;
  let currentId: string | null = commentId;

  while (currentId && depth < 4) {
    const row: { parentId: string | null } | null =
      await prisma.comment.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
    if (!row?.parentId) break;
    depth += 1;
    currentId = row.parentId;
  }

  return depth;
}

/**
 * Threaded discussion write. `bookId` is always required; an optional
 * `reviewId` attaches the comment to a review thread, and `parentId` must
 * belong to the same book *and* the same thread. Reply depth is capped at 3
 * levels (root = 1) so threads cannot sprawl.
 */
export async function createComment(
  _previousState: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const locale = localeFrom(formData.get("locale"));
  const bookId = String(formData.get("bookId") ?? "").trim();

  if (!bookId) redirect(`/${locale}/books`);

  const parsed = z
    .object({
      body: z.string().trim().min(1).max(2000),
      containsSpoiler: z.boolean(),
    })
    .safeParse({
      body: String(formData.get("body") ?? ""),
      containsSpoiler: formData.get("containsSpoiler") === "1",
    });

  const userId = await activeUserId();
  if (!userId) redirect(signInHref(locale, bookId));
  if (!parsed.success) redirect(`${bookPath(locale, bookId)}?error=commentInvalid`);

  const reviewIdRaw = String(formData.get("reviewId") ?? "").trim();
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const reviewId = reviewIdRaw || null;
  const parentId = parentIdRaw || null;

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true },
  });
  if (!book) redirect(`${bookPath(locale, bookId)}?error=commentInvalid`);

  // A review thread comment must target a review on this same book.
  if (reviewId) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { bookId: true },
    });
    if (!review || review.bookId !== bookId) {
      redirect(`${bookPath(locale, bookId)}?error=commentInvalid`);
    }
  }

  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { bookId: true, parentId: true, reviewId: true },
    });

    if (!parent || parent.bookId !== bookId) {
      redirect(`${bookPath(locale, bookId)}?error=commentInvalid`);
    }
    if ((parent.reviewId ?? null) !== reviewId) {
      redirect(`${bookPath(locale, bookId)}?error=commentInvalid`);
    }
    if ((await commentDepth(parentId)) >= 3) {
      redirect(`${bookPath(locale, bookId)}?error=commentInvalid`);
    }
  }

  try {
    await prisma.comment.create({
      data: {
        userId,
        bookId,
        reviewId,
        parentId,
        body: parsed.data.body,
        containsSpoiler: parsed.data.containsSpoiler,
      },
    });
  } catch (error) {
    console.error("[books] comment create failed", error);
    redirect(`${bookPath(locale, bookId)}?error=commentInvalid`);
  }

  revalidateBook(bookId);
  // The POST was already bound to the discussion anchor; no redirect needed.
  return { ok: true };
}

/** Soft delete: the row stays so the thread keeps its shape; body disappears. */
export async function deleteComment(formData: FormData): Promise<void> {
  const locale = localeFrom(formData.get("locale"));
  const commentId = String(formData.get("commentId") ?? "").trim();
  const fallbackBookId = String(formData.get("bookId") ?? "").trim();
  if (!commentId) return;

  const userId = await activeUserId();
  if (!userId) {
    if (fallbackBookId) redirect(signInHref(locale, fallbackBookId));
    redirect(`/${locale}/books`);
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, bookId: true, deletedAt: true },
  });

  if (!comment) return;

  if (comment.userId !== userId) {
    redirect(`${bookPath(locale, comment.bookId)}?error=commentInvalid`);
  }

  if (!comment.deletedAt) {
    try {
      await prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      console.error("[books] comment delete failed", error);
      redirect(`${bookPath(locale, comment.bookId)}?error=commentInvalid`);
    }
  }

  revalidateBook(comment.bookId);
}

/**
 * Idempotent like toggle: delete-or-create. A concurrent duplicate insert
 * (P2002) is not an error — the desired end state (liked) already exists.
 */
export async function toggleReviewLike(
  reviewId: string,
  bookId: string,
  locale: string = "ar",
): Promise<void> {
  const loc: Locale = locale === "en" ? "en" : "ar";
  if (!reviewId || !bookId) return;

  const userId = await activeUserId();
  if (!userId) redirect(signInHref(loc, bookId));

  try {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.reviewLike.deleteMany({
        where: { userId, reviewId },
      });
      if (deleted.count === 0) {
        await tx.reviewLike.create({ data: { userId, reviewId } });
      }
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      console.error("[books] review like toggle failed", error);
    }
  }

  revalidateBook(bookId);
}

/** Comment twin of {@link toggleReviewLike}. */
export async function toggleCommentLike(
  commentId: string,
  bookId: string,
  locale: string = "ar",
): Promise<void> {
  const loc: Locale = locale === "en" ? "en" : "ar";
  if (!commentId || !bookId) return;

  const userId = await activeUserId();
  if (!userId) redirect(signInHref(loc, bookId));

  try {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.commentLike.deleteMany({
        where: { userId, commentId },
      });
      if (deleted.count === 0) {
        await tx.commentLike.create({ data: { userId, commentId } });
      }
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      console.error("[books] comment like toggle failed", error);
    }
  }

  revalidateBook(bookId);
}
