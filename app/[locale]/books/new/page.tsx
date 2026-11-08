import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  lookupIsbn,
  type BookFormValues,
} from "@/app/[locale]/books/new/actions";
import { auth } from "@/auth";
import { AddBookForm } from "@/components/add-book-form";
import { SubmitButton } from "@/components/submit-button";
import { routing } from "@/i18n/routing";
import { isbnPair } from "@/lib/isbn";
import { lookupBookByIsbn } from "@/lib/openlibrary";
import { BOOK_LANGUAGE_CODES, formatIndex } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DEFAULT_LANGUAGE = "ar";

type PageParams = { locale: string };
type PageSearchParams = {
  isbn?: string | string[];
  manual?: string | string[];
  error?: string | string[];
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function languageOptions(locale: string): Array<{ value: string; label: string }> {
  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames([locale], { type: "language" });
  } catch {
    display = null;
  }

  return BOOK_LANGUAGE_CODES.map((code) => ({
    value: code,
    label: display?.of(code) ?? code,
  }));
}

function emptyDefaults(): BookFormValues {
  return {
    title: "",
    titleAr: null,
    subtitle: null,
    publisher: null,
    publishedYear: null,
    pageCount: null,
    language: DEFAULT_LANGUAGE,
    subjects: [],
    description: null,
    coverUrl: null,
    isbn13: null,
    isbn10: null,
    openLibraryKey: null,
    authors: [],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "addBook" });

  return {
    title: t("title"),
    description: t("lede"),
    alternates: {
      languages: {
        ar: "/ar/books/new",
        en: "/en/books/new",
        "x-default": "/ar/books/new",
      },
    },
  };
}

export default async function NewBookPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const query = await searchParams;
  const rawIsbn = (firstValue(query.isbn) ?? "").trim().slice(0, 32);
  const manualMode = firstValue(query.manual) === "1";
  const errorCode = firstValue(query.error) ?? null;

  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const [t, tAuth] = await Promise.all([
    getTranslations({ locale, namespace: "addBook" }),
    getTranslations({ locale, namespace: "auth" }),
  ]);

  const searchHref = `/${locale}/books/new`;
  const manualHref = `${searchHref}?manual=1`;
  const catalogHref = `/${locale}/books`;
  const signInHref = `/${locale}/sign-in?callbackUrl=${encodeURIComponent(searchHref)}`;
  const options = languageOptions(locale);

  // Resolve the passive ISBN render (cached fetch, no lookup quota consumed).
  const pair = rawIsbn ? isbnPair(rawIsbn) : null;
  const lookup =
    viewerId && pair ? await lookupBookByIsbn(pair.isbn13) : null;
  const invalidIsbn =
    errorCode === "invalidIsbn" || (Boolean(rawIsbn) && !pair);
  const rateLimited = errorCode === "rateLimited";

  const searchForm = (
    <form action={lookupIsbn} className="form-card mt-8 max-w-xl">
      <input type="hidden" name="locale" value={locale} />

      {invalidIsbn || rateLimited ? (
        <div id="isbn-error" role="alert" className="form-alert">
          <p>{invalidIsbn ? t("invalidIsbn") : t("rateLimited")}</p>
        </div>
      ) : null}

      <div className={invalidIsbn || rateLimited ? "mt-5" : undefined}>
        <label htmlFor="isbn" className="text-sm text-ink-soft">
          {t("isbnLabel")}
        </label>
        <input
          id="isbn"
          name="isbn"
          type="text"
          required
          maxLength={20}
          defaultValue={rawIsbn}
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={invalidIsbn || undefined}
          aria-describedby={
            invalidIsbn || rateLimited ? "isbn-hint isbn-error" : "isbn-hint"
          }
          className="field mt-2 font-mono"
        />
        <p id="isbn-hint" className="field-hint mt-1">
          {t("isbnHint")}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <SubmitButton
          label={t("searchAction")}
          pendingLabel={t("creatingPending")}
        />
        <Link href={manualHref} className="text-link text-sm">
          {t("manualToggle")}
        </Link>
      </div>
    </form>
  );

  const manualForm = (
    notice: ReactNode,
    defaults: BookFormValues = emptyDefaults(),
  ) => (
    <div className="mt-8 max-w-2xl">
      {notice}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl">{t("formTitle")}</h2>
          <p className="ar-prose mt-1 text-sm text-ink-soft">
            {t("formIntro")}
          </p>
        </div>
        {lookup || manualMode ? (
          <Link href={searchHref} className="text-link text-sm">
            {t("searchAction")}
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <AddBookForm
          defaults={defaults}
          suggestedCoverUrl={null}
          languageOptions={options}
          cancelHref={catalogHref}
        />
      </div>
    </div>
  );

  const foundDefaults: BookFormValues | null =
    lookup?.kind === "found" && pair
      ? {
          ...emptyDefaults(),
          title: lookup.book.title,
          subtitle: lookup.book.subtitle,
          publisher: lookup.book.publisher,
          publishedYear: lookup.book.publishedYear,
          pageCount: lookup.book.pageCount,
          language:
            lookup.book.language &&
            (BOOK_LANGUAGE_CODES as readonly string[]).includes(
              lookup.book.language,
            )
              ? lookup.book.language
              : DEFAULT_LANGUAGE,
          subjects: lookup.book.subjects,
          coverUrl: lookup.book.coverUrl,
          isbn13: pair.isbn13,
          isbn10: pair.isbn10,
          openLibraryKey: lookup.book.openLibraryKey,
          authors: lookup.book.authors,
        }
      : null;

  const notFoundNotice =
    lookup?.kind === "not-found" ? (
      <div role="status" className="notice notice--status mb-6">
        <div>
          <p className="font-semibold">{t("notFoundTitle")}</p>
          <p className="mt-1">{t("notFoundBody")}</p>
        </div>
      </div>
    ) : lookup?.kind === "unavailable" ? (
      <div role="status" className="notice notice--status mb-6">
        <div>
          <p className="font-semibold">{t("unavailableTitle")}</p>
          <p className="mt-1">{t("unavailableBody")}</p>
        </div>
      </div>
    ) : null;

  let content: ReactNode;
  if (!viewerId) {
    content = (
      <section
        aria-labelledby="gate-heading"
        className="form-card mt-8 max-w-xl"
      >
        <p className="section-label">{t("gateTitle")}</p>
        <h2 id="gate-heading" className="mt-2 text-2xl">
          {t("gateTitle")}
        </h2>
        <p className="ar-prose mt-2 text-ink-soft">{t("gateBody")}</p>
        <Link href={signInHref} className="btn btn--primary mt-5">
          {tAuth("signInTitle")}
        </Link>
      </section>
    );
  } else if (manualMode) {
    content = manualForm(null);
  } else if (foundDefaults) {
    content = (
      <section aria-labelledby="book-form-heading" className="mt-8 max-w-2xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="book-form-heading" className="text-2xl">
              {t("formTitle")}
            </h2>
            <p className="ar-prose mt-1 text-sm text-ink-soft">
              {t("formIntro")}
            </p>
          </div>
          {pair ? (
            <p className="text-sm text-ink-faint">
              <bdi dir="ltr" className="font-mono">
                ISBN {pair.isbn13}
              </bdi>
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          <AddBookForm
            defaults={foundDefaults}
            suggestedCoverUrl={foundDefaults.coverUrl}
            languageOptions={options}
            cancelHref={catalogHref}
          />
        </div>
      </section>
    );
  } else if (lookup) {
    content = manualForm(
      notFoundNotice,
      pair
        ? { ...emptyDefaults(), isbn13: pair.isbn13, isbn10: pair.isbn10 }
        : emptyDefaults(),
    );
  } else {
    content = searchForm;
  }

  return (
    <div className="container-page py-10 md:py-14">
      <header className="max-w-2xl">
        <p className="section-label">
          <span className="section-label__index" dir="ltr">
            {formatIndex(locale, 2)}
          </span>
          <span aria-hidden="true">—</span>
          <span>{t("title")}</span>
        </p>
        <h1 className="mt-3 text-3xl">{t("title")}</h1>
        <p className="ar-prose mt-2 text-ink-soft">{t("lede")}</p>
        {viewerId && !manualMode && !lookup && !rawIsbn ? (
          <p className="mt-2 text-sm text-ink-soft">{t("searchIntro")}</p>
        ) : null}
      </header>

      <div className="rule-double mt-8" aria-hidden="true" />

      {content}
    </div>
  );
}
