import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogCard } from "@/components/catalog-card";
import { EmptyState } from "@/components/empty-state";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { routing } from "@/i18n/routing";
import { getCatalogPage } from "@/lib/books";
import { displayTitle, formatIndex } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

type PageParams = { locale: string };
type PageSearchParams = { page?: string | string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: "catalog" }),
    getTranslations({ locale, namespace: "meta" }),
  ]);

  return {
    title: t("title"),
    description: tMeta("description"),
    alternates: {
      languages: {
        ar: "/ar/books",
        en: "/en/books",
        "x-default": "/ar/books",
      },
    },
  };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { page: pageParam } = await searchParams;
  const rawPage = firstValue(pageParam);
  const parsed = rawPage ? Number.parseInt(rawPage, 10) : 1;
  const requestedPage = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;

  const [catalog, t, tBook] = await Promise.all([
    getCatalogPage({ page: requestedPage, pageSize: PAGE_SIZE }),
    getTranslations({ locale, namespace: "catalog" }),
    getTranslations({ locale, namespace: "book" }),
  ]);

  const pageHref = (page: number) => `/${locale}/books?page=${page}`;
  const addBookHref = `/${locale}/books/new`;

  return (
    <div className="container-page py-10 md:py-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="section-label">
            <span className="section-label__index" dir="ltr">
              {formatIndex(locale, 1)}
            </span>
            <span aria-hidden="true">—</span>
            <span>{t("title")}</span>
          </p>
          <h1 className="mt-3 text-3xl">{t("title")}</h1>
          <p className="ar-prose mt-2 text-ink-soft">
            {t("count", { count: catalog.total })}
          </p>
        </div>

        <Link href={addBookHref} className="btn btn--primary">
          {t("emptyCta")}
        </Link>
      </header>

      <div className="rule-double mt-8" aria-hidden="true" />

      {catalog.total === 0 ? (
        <div className="py-12 md:py-16">
          <EmptyState
            title={t("emptyTitle")}
            body={t("emptyBody")}
            cta={
              <Link href={addBookHref} className="btn btn--primary">
                {t("emptyCta")}
              </Link>
            }
          />
        </div>
      ) : (
        <section aria-labelledby="shelf-heading" className="mt-8">
          <h2 id="shelf-heading" className="section-label">
            {t("recentlyShelved")}
          </h2>

          <div className="catalog-grid mt-5">
            {catalog.books.map((book) => {
              const title = displayTitle(book, locale);
              return (
                <CatalogCard
                  key={book.id}
                  book={book}
                  locale={locale}
                  coverAlt={tBook("coverAlt", { title })}
                  headingLevel={3}
                />
              );
            })}
          </div>
        </section>
      )}

      {catalog.total > 0 ? (
        <nav aria-label={t("title")} className="pagination mt-10">
          <div className="pagination__pages">
            {catalog.page > 1 ? (
              <Link
                href={pageHref(catalog.page - 1)}
                className="pagination__link"
                aria-label={t("prevPage")}
              >
                <ChevronLeftIcon className="icon-flip" />
                <span>{t("prevPage")}</span>
              </Link>
            ) : (
              <span
                className="pagination__link"
                aria-disabled="true"
                aria-label={t("prevPage")}
              >
                <ChevronLeftIcon className="icon-flip" />
                <span>{t("prevPage")}</span>
              </span>
            )}

            {catalog.page < catalog.totalPages ? (
              <Link
                href={pageHref(catalog.page + 1)}
                className="pagination__link"
                aria-label={t("nextPage")}
              >
                <span>{t("nextPage")}</span>
                <ChevronRightIcon className="icon-flip" />
              </Link>
            ) : (
              <span
                className="pagination__link"
                aria-disabled="true"
                aria-label={t("nextPage")}
              >
                <span>{t("nextPage")}</span>
                <ChevronRightIcon className="icon-flip" />
              </span>
            )}
          </div>

          <p className="text-sm text-ink-soft" dir="auto">
            {t("pageOf", {
              current: catalog.page,
              total: catalog.totalPages,
            })}
          </p>
        </nav>
      ) : null}
    </div>
  );
}
