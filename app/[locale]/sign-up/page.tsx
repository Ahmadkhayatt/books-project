import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AlertIcon } from "@/components/icons";
import { routing } from "@/i18n/routing";
import { formatIndex } from "@/lib/utils";

import { signUp } from "./actions";

type PageParams = { locale: string };
type PageSearchParams = {
  error?: string | string[];
  callbackUrl?: string | string[];
};

function safeCallback(
  value: string | string[] | undefined,
  locale: string,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return `/${locale}`;
  }
  return raw;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signUpTitle") };
}

export default async function SignUpPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { error, callbackUrl } = await searchParams;
  const callback = safeCallback(callbackUrl, locale);
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

  const invalidEmail = errorCode === "emailTaken";
  const invalidUsername = errorCode === "usernameTaken";
  const invalidPassword = errorCode === "passwordWeak";

  const errorDescribedBy = errorMessage ? " form-error" : "";

  return (
    <section className="container-page py-12 md:py-20">
      <div className="grid gap-10 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-5">
          <p className="section-label">
            <span className="section-label__index" dir="ltr">
              № {formatIndex(locale, 2)}
            </span>
            {t("signUpTitle")}
          </p>
          <h1 className="mt-4 text-3xl">{t("signUpTitle")}</h1>
          <p className="ar-prose mt-4 max-w-sm text-lg leading-relaxed text-ink-soft">
            {t("signUpIntro")}
          </p>
          <p className="mt-8 max-w-sm text-sm text-ink-soft">
            {t("haveAccount")}{" "}
            <Link
              href={`/${locale}/sign-in?callbackUrl=${encodeURIComponent(callback)}`}
              className="text-link"
            >
              {t("signInTitle")}
            </Link>
          </p>
        </div>

        <div className="md:col-span-6 md:col-start-7">
          <form action={signUp.bind(null, null)} className="form-card">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="callbackUrl" value={callback} />

            {errorMessage ? (
              <div id="form-error" role="alert" className="form-alert">
                <AlertIcon className="mt-0.5 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            ) : null}

            <div className={errorMessage ? "mt-5" : undefined}>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="displayName" className="text-sm text-ink-soft">
                  {t("displayName")}
                </label>
                <span className="text-xs text-ink-faint">
                  ({t("required")})
                </span>
              </div>
              <input
                id="displayName"
                name="displayName"
                type="text"
                autoComplete="name"
                maxLength={80}
                required
                aria-describedby={`displayName-hint${errorDescribedBy}`}
                className="field mt-2"
              />
              <p id="displayName-hint" className="field-hint mt-2">
                {t("displayNameHint")}
              </p>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="username" className="text-sm text-ink-soft">
                  {t("username")}
                </label>
                <span className="text-xs text-ink-faint">
                  ({t("required")})
                </span>
              </div>
              <input
                id="username"
                name="username"
                type="text"
                dir="ltr"
                autoComplete="username"
                minLength={3}
                maxLength={24}
                required
                aria-invalid={invalidUsername || undefined}
                aria-describedby={`username-hint${errorDescribedBy}`}
                className="field mt-2"
              />
              <p id="username-hint" className="field-hint mt-2">
                {t("usernameHint")}
              </p>
            </div>

            <div className="mt-5">
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
                aria-invalid={invalidEmail || undefined}
                aria-describedby={`email-hint${errorDescribedBy}`}
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
                autoComplete="new-password"
                minLength={8}
                required
                aria-invalid={invalidPassword || undefined}
                aria-describedby={`password-hint${errorDescribedBy}`}
                className="field mt-2"
              />
              <p id="password-hint" className="field-hint mt-2">
                {t("passwordHint")}
              </p>
            </div>

            <button type="submit" className="btn btn--primary mt-6 w-full">
              {t("createAccount")}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
