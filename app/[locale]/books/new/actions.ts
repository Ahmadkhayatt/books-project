"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { findBookByIsbn } from "@/lib/books";
import { isbnPair } from "@/lib/isbn";
import { isAllowedCoverUrl } from "@/lib/openlibrary-map";
import { lookupBookByIsbn } from "@/lib/openlibrary";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS, checkRateLimit } from "@/lib/rate-limit";
import { BOOK_LANGUAGE_CODES } from "@/lib/utils";

export type BookFormValues = {
  title: string;
  titleAr: string | null;
  subtitle: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  language: string;
  subjects: string[];
  description: string | null;
  coverUrl: string | null;
  isbn13: string | null;
  isbn10: string | null;
  openLibraryKey: string | null;
  authors: Array<{ name: string; openLibraryKey: string | null }>;
};

export type BookFormState = {
  ok: boolean;
  fieldErrors?: Record<string, string>;
  message?: string;
};

type Locale = "ar" | "en";

function localeFrom(formData: FormData): Locale {
  return formData.get("locale") === "en" ? "en" : "ar";
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

function isUniqueConstraintError(error: unknown): error is { code: "P2002" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
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

const bookSchema = z.object({
  title: z.string().trim().min(1).max(200),
  titleAr: optionalText(200),
  subtitle: optionalText(300),
  publisher: optionalText(200),
  publishedYear: optionalInt(1000, 2100),
  pageCount: optionalInt(1, 20000),
  language: z.enum(BOOK_LANGUAGE_CODES),
  description: optionalText(5000),
  isbn13: optionalText(20),
  isbn10: optionalText(20),
  openLibraryKey: optionalText(120),
  coverUrl: optionalText(500),
});

function parseSubjects(formData: FormData): string[] {
  const raw = String(formData.get("subjects") ?? "");
  const seen = new Set<string>();
  const subjects: string[] = [];

  for (const part of raw.split(/[,،]/)) {
    const subject = part.trim().slice(0, 60).trim();
    if (!subject) continue;
    const key = subject.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    subjects.push(subject);
    if (subjects.length >= 12) break;
  }

  return subjects;
}

function parseAuthors(formData: FormData): {
  authors: Array<{ name: string; openLibraryKey: string | null }>;
  error: boolean;
} {
  const names = formData
    .getAll("authorName")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  const keys = formData
    .getAll("authorKey")
    .map((value) => (typeof value === "string" ? value.trim() : ""));

  if (names.length === 0) return { authors: [], error: true };
  if (names.length > 10) return { authors: [], error: true };

  const seen = new Set<string>();
  const authors: Array<{ name: string; openLibraryKey: string | null }> = [];

  names.forEach((name, index) => {
    if (name.length > 120) {
      authors.length = 0;
      return;
    }
    const rawKey = keys[index] ?? "";
    const openLibraryKey = /^\/authors\/[A-Za-z0-9]+$/.test(rawKey)
      ? rawKey
      : null;
    const dedupeKey = openLibraryKey ?? name.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    if (authors.length < 10) {
      authors.push({ name, openLibraryKey });
    }
  });

  return { authors, error: authors.length === 0 || names.length > 10 };
}

/**
 * ISBN search → the page re-renders with the Open Library prefill. Dedupe is
 * checked before the per-user lookup quota is consumed; the page's passive
 * render uses the 30-day fetch cache and consumes nothing.
 */
export async function lookupIsbn(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const rawIsbn = String(formData.get("isbn") ?? "").trim().slice(0, 32);
  const pair = isbnPair(rawIsbn);
  if (!pair) {
    redirect(
      `/${locale}/books/new?error=invalidIsbn&isbn=${encodeURIComponent(rawIsbn)}`,
    );
  }

  const userId = await activeUserId();
  if (!userId) {
    redirect(signInHref(locale, `/${locale}/books/new`));
  }

  const existing = await findBookByIsbn(pair.isbn13, pair.isbn10);
  if (existing) {
    redirect(`/${locale}/books/${existing.id}?notice=exists`);
  }

  const limit = await checkRateLimit(
    `isbn:lookup:${userId}`,
    RATE_LIMITS.isbnLookup,
  );
  if (!limit.ok) redirect(`/${locale}/books/new?error=rateLimited`);

  await lookupBookByIsbn(pair.isbn13);
  redirect(`/${locale}/books/new?isbn=${pair.isbn13}`);
}

/**
 * Create a catalogue record. Hidden OL fields are re-validated, never trusted;
 * ISBN and Open Library key races degrade to the existing record with
 * `notice=exists` (edition-level identity only in M1).
 */
export async function createBook(
  _previousState: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const locale = localeFrom(formData);
  const parsed = bookSchema.safeParse({
    title: formData.get("title"),
    titleAr: formData.get("titleAr"),
    subtitle: formData.get("subtitle"),
    publisher: formData.get("publisher"),
    publishedYear: formData.get("publishedYear"),
    pageCount: formData.get("pageCount"),
    language: formData.get("language"),
    description: formData.get("description"),
    isbn13: formData.get("isbn13"),
    isbn10: formData.get("isbn10"),
    openLibraryKey: formData.get("openLibraryKey"),
    coverUrl: formData.get("coverUrl"),
  });

  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    for (const [field, messages] of Object.entries(flattened)) {
      if (messages && messages.length > 0) fieldErrors[field] = messages[0];
    }
  }

  const { authors, error: authorError } = parseAuthors(formData);
  if (authorError) fieldErrors.authorName = "invalid";

  const hiddenIsbn = String(formData.get("isbn13") ?? "").trim();
  const hiddenIsbn10 = String(formData.get("isbn10") ?? "").trim();
  let isbn13: string | null = null;
  let isbn10: string | null = null;
  const isbnInput = hiddenIsbn || hiddenIsbn10;
  if (isbnInput) {
    const pair = isbnPair(isbnInput);
    if (!pair) {
      fieldErrors.isbn13 = "invalid";
    } else {
      isbn13 = pair.isbn13;
      isbn10 = pair.isbn10;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const data = parsed.success ? parsed.data : null;
  if (!data) return { ok: false, fieldErrors };

  const rawOpenLibraryKey = data.openLibraryKey ?? "";
  const openLibraryKey = /^\/books\/[A-Za-z0-9]+$/.test(rawOpenLibraryKey)
    ? rawOpenLibraryKey
    : null;

  const useSuggestedCover = formData.get("useCover") === "1";
  const coverUrl =
    useSuggestedCover &&
    data.coverUrl &&
    isAllowedCoverUrl(data.coverUrl)
      ? data.coverUrl
      : null;

  const userId = await activeUserId();
  if (!userId) {
    redirect(signInHref(locale, `/${locale}/books/new`));
  }

  const existing = await findBookByIsbn(isbn13, isbn10);
  if (existing) {
    redirect(`/${locale}/books/${existing.id}?notice=exists`);
  }

  if (openLibraryKey) {
    const byKey = await prisma.book.findUnique({
      where: { openLibraryKey },
      select: { id: true },
    });
    if (byKey) {
      redirect(`/${locale}/books/${byKey.id}?notice=exists`);
    }
  }

  let createdId: string;
  try {
    createdId = await prisma.$transaction(async (tx) => {
      const authorIds: string[] = [];

      for (const author of authors) {
        let authorId: string;
        if (author.openLibraryKey) {
          const row = await tx.author.upsert({
            where: { openLibraryKey: author.openLibraryKey },
            update: { name: author.name },
            create: {
              name: author.name,
              openLibraryKey: author.openLibraryKey,
            },
            select: { id: true },
          });
          authorId = row.id;
        } else {
          const row =
            (await tx.author.findFirst({
              where: { name: author.name },
              select: { id: true },
            })) ??
            (await tx.author.create({
              data: { name: author.name },
              select: { id: true },
            }));
          authorId = row.id;
        }
        authorIds.push(authorId);
      }

      const book = await tx.book.create({
        data: {
          title: data.title,
          titleAr: data.titleAr,
          subtitle: data.subtitle,
          description: data.description,
          publisher: data.publisher,
          publishedYear: data.publishedYear,
          language: data.language,
          pageCount: data.pageCount,
          coverUrl,
          openLibraryKey,
          isbn13,
          isbn10,
          subjects: parseSubjects(formData),
          createdById: userId,
          authors: {
            create: authorIds.map((authorId, order) => ({ authorId, order })),
          },
        },
        select: { id: true },
      });

      return book.id;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const winner =
        (isbn13
          ? await prisma.book.findUnique({
              where: { isbn13 },
              select: { id: true },
            })
          : null) ??
        (openLibraryKey
          ? await prisma.book.findUnique({
              where: { openLibraryKey },
              select: { id: true },
            })
          : null) ??
        (isbn10
          ? await prisma.book.findFirst({
              where: { isbn10 },
              select: { id: true },
            })
          : null);

      if (winner) {
        redirect(`/${locale}/books/${winner.id}?notice=exists`);
      }
    }

    console.error("[books] create failed", error);
    return { ok: false, message: undefined };
  }

  revalidatePath(`/${locale}/books`);
  revalidatePath(`/${locale}/books/${createdId}`);
  redirect(`/${locale}/books/${createdId}?notice=created`);
}
