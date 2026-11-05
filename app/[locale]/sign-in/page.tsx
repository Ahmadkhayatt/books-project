import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AlertIcon } from "@/components/icons";
import { routing } from "@/i18n/routing";
import { formatIndex } from "@/lib/utils";

import { signInWithCredentials } from "./actions";

type PageParams = { locale: string };
type PageSearchParams = { error?: string | string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signInTitle") };
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { error } = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth" });

  const errorMessages = {
    invalidCredentials: t("errors.invalidCredentials"),
    rateLimited: t("errors.rateLimited"),
    emailTaken: t("errors.emailTaken"),
    usernameTaken: t("errors.usernameTaken"),
    passwordWeak: t("errors.passwordWeak"),
    generic: t("errors.generic"),
  } as const;

  const errorCode = typeof error === "string" ? error : null;
  const errorMessage =
    errorCode && errorCode in errorMessages
      ? errorMessages[errorCode as keyof typeof errorMessages]
      : null;
  const invalidCredentials = errorCode === "invalidCredentials";

  const emailDescribedBy = errorMessage
    ? "form-error email-hint"
    : "email-hint";
  const passwordDescribedBy = errorMessage
    ? "form-error password-hint"
    : "password-hint";

  return (
    <section className="container-page py-12 md:py-20">
      <div className="grid gap-10 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-5">
          <p className="section-label">
            <span className="section-label__index" dir="ltr">
              № {formatIndex(locale, 1)}
            </span>
            {t("signInTitle")}
          </p>
          <h1 className="mt-4 text-3xl">{t("signInTitle")}</h1>
          <p className="ar-prose mt-4 max-w-sm text-lg leading-relaxed text-ink-soft">
            {t("signInIntro")}
          </p>
          <p className="mt-8 max-w-sm text-sm text-ink-soft">
            {t("noAccount")}{" "}
            <Link href={`/${locale}/sign-up`} className="text-link">
              {t("createAccount")}
            </Link>
          </p>
        </div>

        <div className="md:col-span-6 md:col-start-7">
          <form
            action={signInWithCredentials.bind(null, null)}
            className="form-card"
          >
            <input type="hidden" name="locale" value={locale} />

            {errorMessage ? (
              <div id="form-error" role="alert" className="form-alert">
                <AlertIcon className="mt-0.5 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            ) : null}

            <div className={errorMessage ? "mt-5" : undefined}>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="email" className="text-sm text-ink-soft">
                  {t("email")}
                </label>
                <span className="text-xs text-ink-faint">
                  ({t("required")})
                </span>
              </div>
              <input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                required
                aria-invalid={invalidCredentials || undefined}
                aria-describedby={emailDescribedBy}
                className="field mt-2"
              />
              <p id="email-hint" className="field-hint mt-2">
                {t("emailHint")}
              </p>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="password" className="text-sm text-ink-soft">
                  {t("password")}
                </label>
                <span className="text-xs text-ink-faint">
                  ({t("required")})
                </span>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                required
                aria-invalid={invalidCredentials || undefined}
                aria-describedby={passwordDescribedBy}
                className="field mt-2"
              />
              <p id="password-hint" className="field-hint mt-2">
                {t("passwordHint")}
              </p>
            </div>

            <button type="submit" className="btn btn--primary mt-6 w-full">
              {t("signInTitle")}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
