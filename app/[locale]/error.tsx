"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  return (
    <div className="container-page flex flex-col items-center py-16 text-center md:py-24">
      <svg
        viewBox="0 0 96 96"
        className="stamp h-20 w-20"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="48" cy="48" r="38" fill="none" stroke="currentColor" strokeWidth="1" />
        <path
          d="M48 34c-5.4-3-11.4-3.6-17-2.9v30c5.6-.7 11.6-.1 17 2.9 5.4-3 11.4-3.6 17-2.9v-30c-5.6-.7-11.6.1-17 2.9Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M48 34v30" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M48 40l-3.5 6.5 4.5 3.5-3.5 7 4.5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <h1 className="mt-6 max-w-xl text-2xl md:text-3xl">{t("title")}</h1>
      <p className="ar-prose mt-3 max-w-md text-ink-soft">{t("body")}</p>

      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-ink-faint">
          {t("digestLabel")}
          {" — "}
          <bdi dir="ltr">{error.digest}</bdi>
        </p>
      ) : null}

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="btn btn--secondary" onClick={reset}>
          {t("retry")}
        </button>
        <Link href={`/${locale}`} className="btn btn--ghost">
          {tCommon("backHome")}
        </Link>
      </div>
    </div>
  );
}
