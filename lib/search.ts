import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { ListingStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { bookWithAuthors } from "@/lib/books";

/**
 * Catalog + listing search helper (PLAN.md §5, M2). Title/author/ISBN `OR`
 * conditions backed by the `books_title_trgm_idx` GIN index added in the M0
 * init migration (`CREATE EXTENSION IF NOT EXISTS pg_trgm`).
 */

/** Trigram-friendly search condition over the book record (title / author / ISBN). */
export function bookSearchConditions(query: string): Prisma.BookWhereInput {
  const term = query.trim();
  if (!term) return {};

  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { isbn13: { contains: term, mode: "insensitive" } },
      { isbn10: { contains: term, mode: "insensitive" } },
      { authors: { some: { author: { name: { contains: term, mode: "insensitive" } } } } },
    ],
  };
}

/** Books matching the search term (title / author / ISBN). */
export async function searchBooks(query: string, limit = 24) {
  const conditions = bookSearchConditions(query);
  if (Object.keys(conditions).length === 0) return [];

  return prisma.book.findMany({
    where: conditions,
    include: bookWithAuthors,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** ACTIVE offers whose book matches the search term (title / author / ISBN). */
export async function searchListings(query: string, limit = 24) {
  const conditions = bookSearchConditions(query);
  if (Object.keys(conditions).length === 0) return [];

  return prisma.listing.findMany({
    where: { status: ListingStatus.ACTIVE, book: conditions },
    include: {
      book: {
        include: {
          subjects: true,
          authors: { orderBy: { order: "asc" }, include: { author: true } },
        },
      },
      seller: { include: { profile: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
