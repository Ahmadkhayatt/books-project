import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Read-side query layer for the M1 catalogue. Every function here is
 * server-only; client components never import this module.
 */

export type CatalogBook = Prisma.BookGetPayload<{
  include: { authors: { include: { author: true } } };
}>;

const bookWithAuthors = {
  authors: {
    orderBy: { order: "asc" as const },
    include: { author: true },
  },
} satisfies Prisma.BookInclude;

export type RatingHistogram = Record<1 | 2 | 3 | 4 | 5, number>;

export type RatingAggregates = {
  average: number;
  count: number;
  histogram: RatingHistogram;
};

export type BookReview = Prisma.ReviewGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        username: true;
        name: true;
        profile: { select: { displayName: true } };
      };
    };
    _count: { select: { likes: true } };
    likes: { select: { id: true } };
  };
}>;

export type ReviewWithMeta = BookReview & { viewerLiked: boolean };

export type DiscussionComment = {
  id: string;
  userId: string;
  parentId: string | null;
  reviewId: string | null;
  body: string | null;
  containsSpoiler: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    username: string;
    name: string | null;
    profile: { displayName: string | null } | null;
  };
  likeCount: number;
  viewerLiked: boolean;
  replies: DiscussionComment[];
};

const discussionCommentSelect = {
  id: true,
  userId: true,
  parentId: true,
  reviewId: true,
  containsSpoiler: true,
  deletedAt: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      username: true,
      name: true,
      profile: { select: { displayName: true } },
    },
  },
  _count: { select: { likes: true } },
} satisfies Prisma.CommentSelect;

type DiscussionCommentRow = Prisma.CommentGetPayload<{
  select: typeof discussionCommentSelect;
}>;

export type CatalogPage = {
  books: CatalogBook[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getCatalogPage({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}): Promise<CatalogPage> {
  const requested =
    Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1;

  const total = await prisma.book.count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(requested, totalPages);

  const books =
    total === 0
      ? []
      : await prisma.book.findMany({
          orderBy: { createdAt: "desc" },
          skip: (current - 1) * pageSize,
          take: pageSize,
          include: bookWithAuthors,
        });

  return { books, total, page: current, pageSize, totalPages };
}

export async function getBookById(
  id: string,
): Promise<(CatalogBook & { listingsCount: number }) | null> {
  const book = await prisma.book.findUnique({
    where: { id },
    include: bookWithAuthors,
  });

  if (!book) return null;

  // M2 replaces this stub with the real ACTIVE-listing count/rows. M1 does not
  // query the Listing table at all (contract H2/H9).
  return { ...book, listingsCount: 0 };
}

export async function getRatingAggregates(
  bookId: string,
): Promise<RatingAggregates> {
  const [aggregate, groups] = await Promise.all([
    prisma.rating.aggregate({
      where: { bookId },
      _avg: { value: true },
      _count: { _all: true },
    }),
    prisma.rating.groupBy({
      by: ["value"],
      where: { bookId },
      _count: { _all: true },
    }),
  ]);

  const histogram: RatingHistogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const group of groups) {
    if (group.value >= 1 && group.value <= 5) {
      histogram[group.value as 1 | 2 | 3 | 4 | 5] = group._count._all;
    }
  }

  return {
    average: aggregate._avg.value ?? 0,
    count: aggregate._count._all,
    histogram,
  };
}

export async function getRelatedBooks(
  book: Pick<CatalogBook, "id" | "subjects"> & {
    authors: Array<{ authorId: string }>;
  },
  limit = 6,
): Promise<CatalogBook[]> {
  const authorIds = [...new Set(book.authors.map((entry) => entry.authorId))];
  const subjects = book.subjects;
  if (authorIds.length === 0 && subjects.length === 0) return [];

  const conditions: Prisma.BookWhereInput[] = [];
  if (authorIds.length > 0) {
    conditions.push({ authors: { some: { authorId: { in: authorIds } } } });
  }
  if (subjects.length > 0) {
    conditions.push({ subjects: { hasSome: subjects } });
  }

  const candidates = await prisma.book.findMany({
    where: {
      id: { not: book.id },
      OR: conditions,
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: bookWithAuthors,
  });

  const authorSet = new Set(authorIds);
  const subjectSet = new Set(subjects.map((subject) => subject.toLowerCase()));

  const scored = candidates
    .map((candidate) => {
      const sharedAuthors = candidate.authors.filter((entry) =>
        authorSet.has(entry.authorId),
      ).length;
      const sharedSubjects = candidate.subjects.filter((subject) =>
        subjectSet.has(subject.toLowerCase()),
      ).length;
      return { candidate, score: sharedAuthors * 2 + sharedSubjects };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime();
    });

  return scored.slice(0, limit).map((entry) => entry.candidate);
}

export async function findBookByIsbn(
  isbn13: string | null | undefined,
  isbn10?: string | null,
): Promise<{ id: string; isbn13: string | null; isbn10: string | null } | null> {
  const conditions: Prisma.BookWhereInput[] = [];
  if (isbn13) conditions.push({ isbn13 });
  if (isbn10) conditions.push({ isbn10 });
  if (conditions.length === 0) return null;

  return prisma.book.findFirst({
    where: { OR: conditions },
    select: { id: true, isbn13: true, isbn10: true },
  });
}

export async function getBookReviews(
  bookId: string,
  viewerId: string | null,
  limit = 20,
): Promise<ReviewWithMeta[]> {
  const reviews = await prisma.review.findMany({
    where: { bookId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          profile: { select: { displayName: true } },
        },
      },
      _count: { select: { likes: true } },
      likes: {
        // An impossible id keeps the include shape stable for anonymous
        // viewers without a second query.
        where: { userId: viewerId ?? "__anonymous__" },
        select: { id: true },
      },
    },
  });

  return reviews.map((review) => ({
    ...review,
    viewerLiked: review.likes.length > 0,
  }));
}

export async function getViewerReview(
  userId: string,
  bookId: string,
): Promise<{
  id: string;
  title: string | null;
  body: string;
  containsSpoiler: boolean;
} | null> {
  return prisma.review.findUnique({
    where: { userId_bookId: { userId, bookId } },
    select: { id: true, title: true, body: true, containsSpoiler: true },
  });
}

export async function getViewerRating(
  userId: string,
  bookId: string,
): Promise<number | null> {
  const rating = await prisma.rating.findUnique({
    where: { userId_bookId: { userId, bookId } },
    select: { value: true },
  });
  return rating?.value ?? null;
}

/**
 * Page-level discussion only (`reviewId: null`). Bodies of soft-deleted
 * comments are never selected; those rows travel as tombstones so the thread
 * shape survives without retaining readable text in any render payload.
 */
export async function getBookDiscussion(
  bookId: string,
  viewerId: string | null,
  limit = 20,
): Promise<DiscussionComment[]> {
  // Newest roots only, then descendants for exactly those threads. The body
  // and like queries are scoped to the same id set, so a long-lived book never
  // loads every comment on every render.
  const rootRows = await prisma.comment.findMany({
    where: { bookId, reviewId: null, parentId: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: discussionCommentSelect,
  });
  if (rootRows.length === 0) return [];

  const rows: DiscussionCommentRow[] = [...rootRows];
  const seenIds = new Set(rootRows.map((comment) => comment.id));
  let parentIds = rootRows.map((comment) => comment.id);

  while (parentIds.length > 0) {
    const replies = await prisma.comment.findMany({
      where: { bookId, reviewId: null, parentId: { in: parentIds } },
      orderBy: { createdAt: "asc" },
      select: discussionCommentSelect,
    });
    const fresh = replies.filter((comment) => !seenIds.has(comment.id));
    if (fresh.length === 0) break;
    for (const comment of fresh) {
      seenIds.add(comment.id);
      rows.push(comment);
    }
    parentIds = fresh.map((comment) => comment.id);
  }

  const ids = rows.map((comment) => comment.id);

  const [bodies, viewerLikes] = await Promise.all([
    prisma.comment.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, body: true },
    }),
    viewerId
      ? prisma.commentLike.findMany({
          where: { userId: viewerId, commentId: { in: ids } },
          select: { commentId: true },
        })
      : Promise.resolve([]),
  ]);

  const bodyById = new Map(bodies.map((entry) => [entry.id, entry.body]));
  const likedIds = new Set(viewerLikes.map((entry) => entry.commentId));

  const nodes = new Map<string, DiscussionComment>();
  for (const comment of rows) {
    nodes.set(comment.id, {
      id: comment.id,
      userId: comment.userId,
      parentId: comment.parentId,
      reviewId: comment.reviewId,
      body: comment.deletedAt ? null : (bodyById.get(comment.id) ?? null),
      containsSpoiler: comment.containsSpoiler,
      deletedAt: comment.deletedAt,
      createdAt: comment.createdAt,
      user: comment.user,
      likeCount: comment._count.likes,
      viewerLiked: likedIds.has(comment.id),
      replies: [],
    });
  }

  const roots: DiscussionComment[] = [];
  for (const node of nodes.values()) {
    if (node.parentId) {
      const parent = nodes.get(node.parentId);
      if (parent) {
        parent.replies.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  const byCreatedAtAsc = (a: DiscussionComment, b: DiscussionComment) =>
    a.createdAt.getTime() - b.createdAt.getTime();
  for (const node of nodes.values()) node.replies.sort(byCreatedAtAsc);

  roots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return roots.slice(0, limit);
}
