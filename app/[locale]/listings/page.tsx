import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookCover } from "@/components/book-cover";
import { EmptyState } from "@/components/empty-state";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { routing } from "@/i18n/routing";
import { getListings } from "@/lib/listings";
import { displayTitle, formatIndex, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type PageParams = { locale: string };
type PageSearchParams = {
  q?: string | string[];
  type?: string | string[];
  condition?: string | string[];
  priceMin?: string | string[];
  priceMax?: string | string[];
  city?: string | string[];
  genre?: string | string[];
  sort?: string | string[];
  page?: string | string[];
  bookId?: string | string[];
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNullableInt(value: string | undefined): number | null {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildQuery(filters: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "listing" });

  return {
    title: t("title"),
    description: t("search"),
    alternates: {
      languages: {
        ar: "/ar/listings",
        en: "/en/listings",
        "x-default": "/ar/listings",
      },
    },
  };
}

export default async function ListingsPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const filters = await searchParams;
  const q = (firstValue(filters.q) ?? "").trim();
  const typeRaw = firstValue(filters.type) ?? "";
  const type =
    typeRaw === "SELL" || typeRaw === "SWAP" || typeRaw === "FREE"
      ? typeRaw
      : undefined;
  const conditionRaw = firstValue(filters.condition) ?? "";
  const condition =
    conditionRaw === "NEW" ||
    conditionRaw === "LIKE_NEW" ||
    conditionRaw === "GOOD" ||
    conditionRaw === "ACCEPTABLE" ||
    conditionRaw === "WORN"
      ? conditionRaw
      : undefined;
  const priceMin = toNullableInt(firstValue(filters.priceMin));
  const priceMax = toNullableInt(firstValue(filters.priceMax));
  // URL prices are major units; storage is minor units (priceCents).
  const priceMinCents = priceMin == null ? null : priceMin * 100;
  const priceMaxCents = priceMax == null ? null : priceMax * 100;
  const city = (firstValue(filters.city) ?? "").trim() || undefined;
  const genre = (firstValue(filters.genre) ?? "").trim() || undefined;
  const sortRaw = firstValue(filters.sort) ?? "newest";
  const sort: "newest" | "priceLow" | "priceHigh" =
    sortRaw === "priceLow" || sortRaw === "priceHigh" ? sortRaw : "newest";
  const page = toPositiveInt(firstValue(filters.page), 1);
  const bookId = (firstValue(filters.bookId) ?? "").trim() || undefined;

  const result = await getListings({
    q: q || undefined,
    type,
    condition,
    priceMin: priceMinCents,
    priceMax: priceMaxCents,
    city,
    genre,
    sort,
    page,
    pageSize: PAGE_SIZE,
    bookId,
  });

  const t = await getTranslations("listing");
  const tCatalog = await getTranslations("catalog");

  const filterValues: Record<string, string | undefined> = {
    q: q || undefined,
    type: type || undefined,
    condition: condition || undefined,
    priceMin: priceMin ? String(priceMin) : undefined,
    priceMax: priceMax ? String(priceMax) : undefined,
    city: city || undefined,
    genre: genre || undefined,
    sort: sort,
    bookId: bookId || undefined,
  };

  const pageHref = (targetPage: number) =>
    `/${locale}/listings${buildQuery({ ...filterValues, page: String(targetPage) })}`;

  const statusChipClass = (status: string) => {
    switch (status) {
      case "RESERVED":
        return "chip chip--gild";
      case "COMPLETED":
        return "chip chip--ink";
      case "CANCELLED":
        return "chip chip--stamp";
      case "ACTIVE":
      default:
        return "chip chip--cloth";
    }
  };

  const priceLabel = (listing: (typeof result.listings)[number]) => {
    if (listing.priceCents === null) return null;
    return formatPrice(locale, listing.priceCents, listing.currency);
  };

  const authorLine = (listing: (typeof result.listings)[number]) =>
    listing.book.authors
      .map((entry) => entry.author.name)
      .join(locale === "ar" ? "، " : ", ");

  const listingHref = (listingId: string) => `/${locale}/listings/${listingId}`;

  return (
    <div className="container-page py-10 md:py-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="section-label">
            <span className="section-label__index" dir="ltr">
              {formatIndex(locale, 3)}
            </span>
            <span aria-hidden="true">—</span>
            <span>{t("title")}</span>
          </p>
          <h1 className="mt-3 text-3xl">{t("title")}</h1>
          <p className="ar-prose mt-2 text-ink-soft">{t("count", { count: result.total })}</p>
        </div>

        <Link href={`/${locale}/listings/new`} className="btn btn--primary">
          {t("newListing")}
        </Link>
      </header>

      <div className="rule-double mt-8" aria-hidden="true" />

      <section aria-labelledby="listing-filters-heading" className="mt-8">
        <h2 id="listing-filters-heading" className="section-label">
          {t("search")}
        </h2>

        <form method="get" className="form-card mt-4 max-w-3xl">
          {bookId ? (
            <input type="hidden" name="bookId" value={bookId} />
          ) : null}

          <label htmlFor="q" className="text-sm text-ink-soft">
            {t("search")}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            className="field mt-2"
            dir="auto"
          />

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="type" className="text-sm text-ink-soft">
                {t("type")}
              </label>
              <select id="type" name="type" defaultValue={type} className="field mt-2">
                <option value="">{t("conditionAll")}</option>
                <option value="SELL">{t("typeSell")}</option>
                <option value="SWAP">{t("typeSwap")}</option>
                <option value="FREE">{t("typeFree")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="condition" className="text-sm text-ink-soft">
                {t("condition")}
              </label>
              <select
                id="condition"
                name="condition"
                defaultValue={condition}
                className="field mt-2"
              >
                <option value="">{t("conditionAll")}</option>
                <option value="NEW">{t("conditionNew")}</option>
                <option value="LIKE_NEW">{t("conditionLikeNew")}</option>
                <option value="GOOD">{t("conditionGood")}</option>
                <option value="ACCEPTABLE">{t("conditionAcceptable")}</option>
                <option value="WORN">{t("conditionWorn")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="priceMin" className="text-sm text-ink-soft">
                {t("priceMin")}
              </label>
              <input
                id="priceMin"
                name="priceMin"
                type="number"
                min={0}
                inputMode="numeric"
                defaultValue={priceMin ? String(priceMin) : undefined}
                className="field mt-2"
                dir="ltr"
              />
            </div>

            <div>
              <label htmlFor="priceMax" className="text-sm text-ink-soft">
                {t("priceMax")}
              </label>
              <input
                id="priceMax"
                name="priceMax"
                type="number"
                min={0}
                inputMode="numeric"
                defaultValue={priceMax ? String(priceMax) : undefined}
                className="field mt-2"
                dir="ltr"
              />
            </div>

            <div>
              <label htmlFor="city" className="text-sm text-ink-soft">
                {t("city")}
              </label>
              <input
                id="city"
                name="city"
                type="text"
                defaultValue={city}
                className="field mt-2"
                dir="auto"
              />
            </div>

            <div>
              <label htmlFor="genre" className="text-sm text-ink-soft">
                {t("genre")}
              </label>
              <input
                id="genre"
                name="genre"
                type="text"
                defaultValue={genre}
                className="field mt-2"
                dir="auto"
              />
            </div>

            <div>
              <label htmlFor="sort" className="text-sm text-ink-soft">
                {t("sort")}
              </label>
              <select id="sort" name="sort" defaultValue={sort} className="field mt-2">
                <option value="newest">{t("sortNewest")}</option>
                <option value="priceLow">{t("sortPriceLow")}</option>
                <option value="priceHigh">{t("sortPriceHigh")}</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn--primary">
              {t("search")}
            </button>
            <Link href={`/${locale}/listings`} className="btn btn--ghost">
              {t("clearFilters")}
            </Link>
          </div>
        </form>
      </section>

      <section aria-labelledby="listings-heading" className="mt-10">
        <h2 id="listings-heading" className="section-label">
          {t("title")}
        </h2>

        {result.listings.length === 0 ? (
          <div className="py-12 md:py-16">
            <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
          </div>
        ) : (
          <ol className="mt-6">
            {result.listings.map((listing) => (
              <li
                key={listing.id}
                className="ledger-row listings-row items-start gap-4"
              >
                <Link href={listingHref(listing.id)} className="shrink-0 self-start">
                  <span className="block aspect-[2/3] w-14">
                    <BookCover
                      coverUrl={listing.book.coverUrl}
                      title={displayTitle(listing.book, locale)}
                      authorLine={authorLine(listing) || undefined}
                      alt=""
                      sizes="(min-width: 1024px) 56px, (min-width: 640px) 7vw, 10vw"
                      seed={listing.book.isbn13 ?? listing.book.id}
                    />
                  </span>
                </Link>

                <div className="min-w-0 flex-1">
                  <Link href={listingHref(listing.id)} className="block truncate text-lg">
                    {displayTitle(listing.book, locale)}
                  </Link>
                  {authorLine(listing) ? (
                    <p className="mt-1 text-sm text-ink-soft" dir="auto">
                      {authorLine(listing)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-ink-soft">
                    {listing.location ? (
                      <span dir="auto">{listing.location}</span>
                    ) : null}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-start gap-2">
                  {priceLabel(listing) ? (
                    <p className="ledger-value text-sm" dir="auto">
                      {priceLabel(listing)}
                    </p>
                  ) : null}
                  <span className={statusChipClass(listing.status)}>
                    {t("statusActive")}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {result.total > 0 ? (
        <nav aria-label={t("title")} className="pagination mt-10">
          <div className="pagination__pages">
            {result.page > 1 ? (
              <Link
                href={pageHref(result.page - 1)}
                className="pagination__link"
                aria-label={tCatalog("prevPage")}
              >
                <ChevronLeftIcon className="icon-flip" />
                <span>{tCatalog("prevPage")}</span>
              </Link>
            ) : (
              <span className="pagination__link" aria-disabled="true" aria-label={tCatalog("prevPage")}>
                <ChevronLeftIcon className="icon-flip" />
                <span>{tCatalog("prevPage")}</span>
              </span>
            )}

            {result.page < result.totalPages ? (
              <Link
                href={pageHref(result.page + 1)}
                className="pagination__link"
                aria-label={tCatalog("nextPage")}
              >
                <span>{tCatalog("nextPage")}</span>
                <ChevronRightIcon className="icon-flip" />
              </Link>
            ) : (
              <span className="pagination__link" aria-disabled="true" aria-label={tCatalog("nextPage")}>
                <span>{tCatalog("nextPage")}</span>
                <ChevronRightIcon className="icon-flip" />
              </span>
            )}
          </div>

          <p className="text-sm text-ink-soft" dir="auto">
            {tCatalog("pageOf", { current: result.page, total: result.totalPages })}
          </p>
        </nav>
      ) : null}
    </div>
  );
}
