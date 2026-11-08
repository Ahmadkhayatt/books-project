import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  createComment,
  deleteReview,
  saveReview,
} from "@/app/[locale]/books/[id]/actions";
import { auth } from "@/auth";
import { BookCover } from "@/components/book-cover";
import { CatalogCard } from "@/components/catalog-card";
import { CommentItem } from "@/components/comment-item";
import { EmptyState } from "@/components/empty-state";
import { NoticeBanner } from "@/components/notice-banner";
import { RatingInput } from "@/components/rating-input";
import { RatingSummary } from "@/components/rating-summary";
import { ReviewCard } from "@/components/review-card";
import { SubmitButton } from "@/components/submit-button";
import { routing } from "@/i18n/routing";
import {
  getBookById,
  getBookDiscussion,
  getBookReviews,
  getRatingAggregates,
  getRelatedBooks,
  getViewerRating,
  getViewerReview,
} from "@/lib/books";
import { displayTitle, formatCount, formatYear } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageParams = { locale: string; id: string };
type PageSearchParams = { notice?: string | string[]; error?: string | string[] };

function firstValue(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function authorLineFor(
  book: { authors: Array<{ author: { name: string } }> },
  locale: string,
): string {
  return book.authors
    .map((entry) => entry.author.name)
    .join(locale === "ar" ? "، " : ", ");
}

function languageLabel(locale: string, code: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function clampDescription(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 160 ? `${clean.slice(0, 157)}…` : clean;
}

function LedgerRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="ledger-row">
      <span className="shrink-0 text-sm text-ink-soft">{label}</span>
      <span className="leader" aria-hidden="true" />
      <span className="ledger-value min-w-0 break-words text-sm">
        {children}
      </span>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const book = await getBookById(id);
  if (!book) notFound();

  const title = displayTitle(book, locale);
  const authors = authorLineFor(book, locale);
  const description = clampDescription(
    book.description?.trim() || [title, authors].filter(Boolean).join(" — "),
  );

  return {
    title,
    description,
    alternates: {
      languages: {
        ar: `/ar/books/${id}`,
        en: `/en/books/${id}`,
        "x-default": `/ar/books/${id}`,
      },
    },
  };
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { notice: noticeParam, error: errorParam } = await searchParams;
  const notice = firstValue(noticeParam);
  const error = firstValue(errorParam);

  /**
   * React's `<form action>` contract is `(formData) => void | Promise<void>`,
   * so the state-shaped actions are wrapped in form-compatible Server
   * Functions; the action itself keeps the contract's `(prevState, formData)`
   * signature for future `useActionState` clients.
   */
  async function submitReview(formData: FormData): Promise<void> {
    "use server";
    await saveReview({ ok: true }, formData);
  }

  async function submitComment(formData: FormData): Promise<void> {
    "use server";
    await createComment({ ok: true }, formData);
  }

  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const book = await getBookById(id);
  if (!book) notFound();

  const [ratings, viewerReview, viewerRating, reviews, discussion, related] =
    await Promise.all([
      getRatingAggregates(book.id),
      viewerId ? getViewerReview(viewerId, book.id) : Promise.resolve(null),
      viewerId ? getViewerRating(viewerId, book.id) : Promise.resolve(null),
      getBookReviews(book.id, viewerId),
      getBookDiscussion(book.id, viewerId),
      getRelatedBooks(book),
    ]);

  const t = await getTranslations({ locale, namespace: "book" });

  const title = displayTitle(book, locale);
  const authors = authorLineFor(book, locale);
  const otherTitle =
    locale === "ar"
      ? book.title && book.titleAr
        ? book.title
        : null
      : book.titleAr;
  const bookHref = `/${locale}/books/${book.id}`;
  const catalogHref = `/${locale}/books`;
  const signInHref = `/${locale}/sign-in?callbackUrl=${encodeURIComponent(bookHref)}`;
  const isbn = book.isbn13 ?? book.isbn10;
  const noticeKind =
    notice === "created" || notice === "exists" || notice === "reviewDeleted"
      ? notice
      : null;

  const starLabels = [1, 2, 3, 4, 5].map((value) =>
    t("starLabel", { value }),
  );

  return (
    <div className="container-page py-10 md:py-14">
      <div className="grid gap-8 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-4 lg:col-span-3">
          <div className="cover-mat mx-auto w-full max-w-xs md:sticky md:top-24">
            <BookCover
              coverUrl={book.coverUrl}
              title={title}
              authorLine={authors || undefined}
              publisher={book.publisher}
              alt={t("coverAlt", { title })}
              sizes="(min-width: 1024px) 300px, (min-width: 768px) 30vw, 70vw"
              seed={book.isbn13 ?? book.id}
              priority
            />
          </div>
        </div>

        <div className="md:col-span-8 lg:col-span-9">
          {error ? (
            <div className="mb-6">
              <NoticeBanner
                kind="error"
                code={error}
                dismissHref={bookHref}
              />
            </div>
          ) : noticeKind ? (
            <div className="mb-6">
              <NoticeBanner
                kind={noticeKind}
                dismissHref={bookHref}
              />
            </div>
          ) : null}

          <p className="section-label">{t("recordKicker")}</p>
          <h1 className="mt-3 text-3xl md:text-4xl">{title}</h1>

          {otherTitle ? (
            <p className="book-alt-title mt-2">
              <span>{t("altTitle")}</span>{" "}
              <bdi dir={locale === "ar" ? "ltr" : "rtl"}>{otherTitle}</bdi>
            </p>
          ) : null}

          {authors ? (
            <p className="mt-3 text-lg text-ink-soft" dir="auto">
              {authors}
            </p>
          ) : null}

          {/* H7: this action row stays for M2's wishlist/toggle; M1 ships the
              back-link only. */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href={catalogHref} className="btn btn--ghost btn--sm">
              {t("backToCatalog")}
            </Link>
          </div>

          <div className="mt-8">
            {book.publisher ? (
              <LedgerRow label={t("publisher")}>
                <span dir="auto">{book.publisher}</span>
              </LedgerRow>
            ) : null}
            {book.publishedYear ? (
              <LedgerRow label={t("year")}>
                {formatYear(locale, book.publishedYear)}
              </LedgerRow>
            ) : null}
            {book.pageCount ? (
              <LedgerRow label={t("pages")}>
                {formatCount(locale, book.pageCount)}
              </LedgerRow>
            ) : null}
            {book.language ? (
              <LedgerRow label={t("language")}>
                {languageLabel(locale, book.language)}
              </LedgerRow>
            ) : null}
            {isbn ? (
              <LedgerRow label={t("isbn")}>
                <bdi dir="ltr" className="font-mono">
                  {isbn}
                </bdi>
              </LedgerRow>
            ) : null}
          </div>

          {book.subjects.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-soft">{t("subjects")}</span>
              {book.subjects.map((subject) => (
                <span key={subject} className="chip chip--cloth" dir="auto">
                  {subject}
                </span>
              ))}
            </div>
          ) : null}

          {book.description ? (
            <section aria-labelledby="about-heading" className="mt-10">
              <h2 id="about-heading" className="section-label">
                {t("about")}
              </h2>
              <p className="ar-prose mt-3 max-w-2xl whitespace-pre-line leading-relaxed text-ink-soft">
                {book.description}
              </p>
            </section>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="ratings-heading" className="mt-12">
        <h2 id="ratings-heading" className="section-label">
          {t("ratingLabel")}
        </h2>

        <div className="mt-4">
          <RatingSummary
            locale={locale}
            average={ratings.average}
            count={ratings.count}
            histogram={ratings.histogram}
          />
        </div>

        <div className="form-card mt-6">
          {viewerId ? (
            <>
              <p className="mb-3 text-sm font-semibold text-ink-soft">
                {t("yourRating")}
              </p>
              <RatingInput
                bookId={book.id}
                currentValue={viewerRating}
                locale={locale}
                labels={{
                  group: t("ratingGroupLabel"),
                  save: t("saveRating"),
                  saved: t("ratingSaved"),
                  stars: starLabels,
                }}
              />
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              <Link href={signInHref} className="text-link">
                {t("signInToRate")}
              </Link>
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="reviews-heading" className="mt-12">
        <h2 id="reviews-heading" className="section-label">
          {t("reviews")}
        </h2>

        <div className="mt-2">
          {reviews.length === 0 ? (
            <EmptyState title={t("noReviews")} />
          ) : (
            reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                bookId={book.id}
                locale={locale}
                viewerId={viewerId}
              />
            ))
          )}
        </div>

        <div id="review-form" className="form-card mt-6 scroll-mt-24">
          {viewerId ? (
            <>
              <h3 className="text-xl">
                {viewerReview ? t("editReview") : t("writeReview")}
              </h3>
              <form action={submitReview} className="mt-4">
                <input type="hidden" name="bookId" value={book.id} />
                <input type="hidden" name="locale" value={locale} />

                <label
                  htmlFor="review-title"
                  className="text-sm text-ink-soft"
                >
                  {t("reviewTitle")}
                </label>
                <input
                  id="review-title"
                  name="title"
                  type="text"
                  maxLength={150}
                  defaultValue={viewerReview?.title ?? ""}
                  className="field mt-2"
                  dir="auto"
                />

                <label
                  htmlFor="review-body"
                  className="mt-5 block text-sm text-ink-soft"
                >
                  {t("reviewBody")}
                </label>
                <textarea
                  id="review-body"
                  name="body"
                  required
                  minLength={3}
                  maxLength={5000}
                  rows={5}
                  defaultValue={viewerReview?.body ?? ""}
                  aria-describedby="review-body-hint"
                  className="field mt-2"
                  dir="auto"
                />
                <p id="review-body-hint" className="field-hint mt-1">
                  {t("reviewBodyHint")}
                </p>

                <label className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    name="containsSpoiler"
                    value="1"
                    defaultChecked={viewerReview?.containsSpoiler ?? false}
                    className="h-5 w-5 accent-leather"
                  />
                  {t("containsSpoiler")}
                </label>

                <div className="mt-5">
                  <SubmitButton label={t("saveReview")} />
                </div>
              </form>

              {viewerReview ? (
                <form action={deleteReview} className="mt-3">
                  <input type="hidden" name="bookId" value={book.id} />
                  <input type="hidden" name="locale" value={locale} />
                  <SubmitButton
                    label={t("deleteReview")}
                    className="btn--danger"
                    confirmMessage={t("deleteReviewConfirm")}
                  />
                </form>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              <Link href={signInHref} className="text-link">
                {t("reviewSignInPrompt")}
              </Link>
            </p>
          )}
        </div>
      </section>

      <section
        id="discussion"
        aria-labelledby="discussion-heading"
        className="mt-12 scroll-mt-24"
      >
        <h2 id="discussion-heading" className="section-label">
          {t("discussion")}
        </h2>

        {viewerId ? (
          <form
            action={submitComment}
            className="form-card mt-4"
          >
            <input type="hidden" name="bookId" value={book.id} />
            <input type="hidden" name="locale" value={locale} />

            <label
              htmlFor="comment-body"
              className="text-sm text-ink-soft"
            >
              {t("commentPlaceholder")}
            </label>
            <textarea
              id="comment-body"
              name="body"
              required
              maxLength={2000}
              rows={3}
              className="field mt-2"
              dir="auto"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  name="containsSpoiler"
                  value="1"
                  className="h-5 w-5 accent-leather"
                />
                {t("containsSpoiler")}
              </label>
              <SubmitButton
                label={t("postComment")}
                className="btn--secondary"
              />
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">
            <Link href={signInHref} className="text-link">
              {t("commentSignInPrompt")}
            </Link>
          </p>
        )}

        {discussion.length === 0 ? (
          <EmptyState title={t("noComments")} />
        ) : (
          <ol className="comment-thread mt-6">
            {discussion.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={1}
                bookId={book.id}
                locale={locale}
                viewerId={viewerId}
              />
            ))}
          </ol>
        )}
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="mt-12">
          <h2 id="related-heading" className="section-label">
            {t("relatedHeading")}
          </h2>
          <div className="catalog-grid mt-5">
            {related.map((relatedBook) => (
              <CatalogCard
                key={relatedBook.id}
                book={relatedBook}
                locale={locale}
                coverAlt={t("coverAlt", {
                  title: displayTitle(relatedBook, locale),
                })}
                headingLevel={3}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/*
        H1/H2/H4/H5 — M2 fills this section with ledger rows (not cards) from
        prisma.listing.findMany({ where: { bookId, status: 'ACTIVE' }, take: 4,
        orderBy: { createdAt: 'desc' } }). Overflow links to the reserved
        `/[locale]/listings?bookId={id}` filter. M1 ships only this placeholder.
      */}
      <section aria-labelledby="listings-heading" className="mt-12">
        <h2 id="listings-heading" className="section-label">
          {t("listingsHeading")}
        </h2>
        <div className="listings-empty mt-5 px-4 py-2">
          <EmptyState
            title={t("listingsEmpty")}
            body={t("listingsEmptyBody")}
          />
        </div>
      </section>
    </div>
  );
}
