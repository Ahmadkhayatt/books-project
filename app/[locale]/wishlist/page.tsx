import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { wishlistToggleAction } from "@/app/[locale]/wishlist/actions";
import { auth } from "@/auth";
import { BookCover } from "@/components/book-cover";
import { EmptyState } from "@/components/empty-state";
import { NoticeBanner } from "@/components/notice-banner";
import { SubmitButton } from "@/components/submit-button";
import { routing } from "@/i18n/routing";
import { displayTitle, formatIndex } from "@/lib/utils";
import { getWishlistForUser } from "@/lib/wishlist";

export const dynamic = "force-dynamic";

type PageParams = { locale: string };
type PageSearchParams = { notice?: string | string[] };

function firstValue(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "wishlist" });

  return {
    title: t("title"),
    description: t("emptyBody"),
    alternates: {
      languages: {
        ar: "/ar/wishlist",
        en: "/en/wishlist",
        "x-default": "/ar/wishlist",
      },
    },
  };
}

export default async function WishlistPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const query = await searchParams;
  const notice = firstValue(query.notice);

  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const t = await getTranslations("wishlist");
  const tAuth = await getTranslations("auth");

  const wishlistHref = `/${locale}/wishlist`;
  const signInHref = `/${locale}/sign-in?callbackUrl=${encodeURIComponent(wishlistHref)}`;
  const catalogHref = `/${locale}/books`;

  let content: ReactNode;

  if (viewerId === null) {
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
  } else {
    const items = await getWishlistForUser(viewerId);

    content = (
      <>
        {notice === "wishlistAdded" || notice === "wishlistRemoved" ? (
          <div className="mt-6 max-w-2xl">
            <NoticeBanner
              kind={notice}
              dismissHref={wishlistHref}
            />
          </div>
        ) : null}

        <p className="ar-prose mt-6 text-ink-soft">
          {t("count", { count: items.length })}
        </p>

        {items.length === 0 ? (
          <div className="py-12 md:py-16">
            <EmptyState
              title={t("emptyTitle")}
              body={t("emptyBody")}
              cta={
                <Link href={catalogHref} className="btn btn--primary">
                  {t("emptyCta")}
                </Link>
              }
            />
          </div>
        ) : (
          <ol className="mt-6">
            {items.map((item) => {
              const title = displayTitle(item.book, locale);
              const authorLine = item.book.authors
                .map((entry) => entry.author.name)
                .join(locale === "ar" ? "، " : ", ");
              return (
                <li
                  key={item.id}
                  className="ledger-row listings-row items-start gap-4"
                >
                  <Link
                    href={`/${locale}/books/${item.book.id}`}
                    className="shrink-0 self-start"
                  >
                    <span className="block aspect-[2/3] w-14">
                      <BookCover
                        coverUrl={item.book.coverUrl}
                        title={title}
                        authorLine={authorLine || undefined}
                        alt=""
                        sizes="(min-width: 1024px) 56px, (min-width: 640px) 7vw, 10vw"
                        seed={item.book.isbn13 ?? item.book.id}
                      />
                    </span>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${locale}/books/${item.book.id}`}
                      className="block truncate text-lg"
                    >
                      {title}
                    </Link>
                    {authorLine ? (
                      <p className="mt-1 text-sm text-ink-soft" dir="auto">
                        {authorLine}
                      </p>
                    ) : null}
                  </div>

                  <form
                    action={wishlistToggleAction}
                    className="shrink-0 self-start"
                  >
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="bookId" value={item.book.id} />
                    <input type="hidden" name="from" value="wishlist" />
                    <SubmitButton
                      label={t("remove")}
                      className="btn--ghost btn--sm"
                    />
                  </form>
                </li>
              );
            })}
          </ol>
        )}
      </>
    );
  }

  return (
    <div className="container-page py-10 md:py-14">
      <header className="max-w-2xl">
        <p className="section-label">
          <span className="section-label__index" dir="ltr">
            {formatIndex(locale, 3)}
          </span>
          <span aria-hidden="true">—</span>
          <span>{t("title")}</span>
        </p>
        <h1 className="mt-3 text-3xl">{t("title")}</h1>
      </header>

      <div className="rule-double mt-8" aria-hidden="true" />

      {content}
    </div>
  );
}
