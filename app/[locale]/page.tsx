import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Seal } from "@/components/seal";
import { routing } from "@/i18n/routing";
import { formatIndex } from "@/lib/utils";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [hero, home] = await Promise.all([
    getTranslations({ locale, namespace: "hero" }),
    getTranslations({ locale, namespace: "home" }),
  ]);

  const principles = [
    { index: formatIndex(locale, 1), title: home("p01t"), body: home("p01b") },
    { index: formatIndex(locale, 2), title: home("p02t"), body: home("p02b") },
    { index: formatIndex(locale, 3), title: home("p03t"), body: home("p03b") },
  ];

  return (
    <div className="container-page">
      <section className="grid gap-10 pb-14 pt-12 md:pb-20 md:pt-20 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <p className="hero-kicker">
            <bdi dir="ltr">{hero("kicker")}</bdi>
          </p>
          <h1 className="hero-title mt-4">{hero("title")}</h1>
          <p className="ar-prose mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            {hero("lede")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={`/${locale}/sign-up`}
              className="btn btn--primary btn--lg"
            >
              {hero("ctaPrimary")}
            </Link>
            <Link
              href={`/${locale}/sign-in`}
              className="btn btn--ghost"
            >
              {hero("ctaSecondary")}
            </Link>
          </div>
        </div>

        <div className="hero-ornament lg:col-span-5">
          <Seal
            locale={locale}
            text={hero("seal")}
            className="h-40 w-40 md:h-44 md:w-44"
          />
          <span className="vertical-est" dir="ltr">
            {hero("est")}
          </span>
        </div>
      </section>

      <div className="rule-double" aria-hidden="true" />

      <section aria-labelledby="principles-heading" className="py-10 md:py-14">
        <h2 id="principles-heading" className="section-label">
          {home("principlesLabel")}
        </h2>

        <ol className="ledger-reveal mt-6">
          {principles.map((principle) => (
            <li key={principle.index} className="ledger-row principle-row">
              <span className="principle-index" aria-hidden="true">
                {principle.index}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="principle-title">{principle.title}</h3>
                <p className="ar-prose mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
                  {principle.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="colophon-strip">
        <p>{home("colophon")}</p>
        <p>{home("localeNote")}</p>
      </div>
    </div>
  );
}
