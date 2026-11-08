import { hasLocale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { auth } from "@/auth";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MobileNav } from "@/components/mobile-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { routing } from "@/i18n/routing";

export async function SiteHeader() {
  const locale = await getLocale();
  if (!hasLocale(routing.locales, locale)) return null;

  const session = await auth();
  const tNav = await getTranslations("nav");
  const tMeta = await getTranslations("meta");
  const tCommon = await getTranslations("common");
  const tLocale = await getTranslations("localeSwitch");

  const homeHref = `/${locale}`;
  const localeLabels = {
    ar: tLocale("ar"),
    en: tLocale("en"),
    label: tLocale("label"),
  };

  const wordmark = (
    <span className={locale === "ar" ? "wordmark-ar" : "wordmark-en"}>
      {tMeta("siteName")}
    </span>
  );

  return (
    <header className="masthead sticky top-0 z-40">
      <a href="#content" className="skip-link">
        {tCommon("skipToContent")}
      </a>

      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href={homeHref} className="wordmark-link">
          {wordmark}
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav
            aria-label={tNav("primary")}
            className="hidden items-center gap-1 md:flex"
          >
            <Link href={homeHref} className="nav-link">
              {tNav("home")}
            </Link>
            <Link href={`/${locale}/books`} className="nav-link">
              {tNav("catalog")}
            </Link>

            {session?.user ? (
              <>
                <span className="nav-account">{tNav("account")}</span>
                <SignOutButton label={tNav("signOut")} />
              </>
            ) : (
              <Link href={`/${locale}/sign-in`} className="nav-link">
                {tNav("signIn")}
              </Link>
            )}
          </nav>

          <LocaleSwitcher
            locale={locale}
            labels={localeLabels}
            className="hidden sm:inline-flex"
          />

          {!session?.user && (
            <Link
              href={`/${locale}/sign-up`}
              className="btn btn--primary hidden md:inline-flex"
            >
              {tNav("signUp")}
            </Link>
          )}

          <MobileNav label={tNav("menu")} closeLabel={tNav("closeMenu")}>
            <nav aria-label={tNav("menu")} className="grid">
              <Link href={homeHref} className="mobile-nav-link">
                {tNav("home")}
              </Link>
              <Link href={`/${locale}/books`} className="mobile-nav-link">
                {tNav("catalog")}
              </Link>

              {session?.user ? (
                <>
                  <span className="mobile-nav-link">{tNav("account")}</span>
                  <SignOutButton
                    label={tNav("signOut")}
                    className="mobile-nav-link w-full text-start"
                  />
                </>
              ) : (
                <>
                  <Link href={`/${locale}/sign-in`} className="mobile-nav-link">
                    {tNav("signIn")}
                  </Link>
                  <Link href={`/${locale}/sign-up`} className="mobile-nav-link">
                    {tNav("signUp")}
                  </Link>
                </>
              )}
            </nav>

            <div className="mobile-panel-locale">
              <LocaleSwitcher locale={locale} labels={localeLabels} />
            </div>
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
