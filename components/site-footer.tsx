import { hasLocale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { ExternalIcon } from "@/components/icons";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { routing } from "@/i18n/routing";

const REPO_URL = "https://github.com/Ahmadkhayatt/books-project";

export async function SiteFooter() {
  const locale = await getLocale();
  if (!hasLocale(routing.locales, locale)) return null;

  const t = await getTranslations("footer");
  const tMeta = await getTranslations("meta");
  const tLocale = await getTranslations("localeSwitch");

  const localeLabels = {
    ar: tLocale("ar"),
    en: tLocale("en"),
    label: tLocale("label"),
  };

  return (
    <footer className="site-footer">
      <div className="container-page py-12 md:py-14">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className={locale === "ar" ? "wordmark-ar" : "wordmark-en"}>
              {tMeta("siteName")}
            </p>
            <p className="footer-tagline mt-3 text-lg">{t("tagline")}</p>
            <p className="footer-colophon ar-prose mt-2 max-w-xs text-sm">
              {t("colophon")}
            </p>
          </div>

          <div>
            <h2 className="footer-label">{t("guide")}</h2>
            <ul className="mt-2">
              <li>
                <Link href={`/${locale}`} className="footer-link-row">
                  {t("home")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/books`} className="footer-link-row">
                  {t("catalog")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/listings`} className="footer-link-row">
                  {t("listings")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/sign-in`} className="footer-link-row">
                  {t("signIn")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/sign-up`} className="footer-link-row">
                  {t("signUp")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="footer-label">{t("language")}</h2>
            <div className="mt-3">
              <LocaleSwitcher
                locale={locale}
                labels={localeLabels}
                tone="dark"
              />
            </div>
            <p className="footer-colophon mt-3 max-w-xs text-sm">
              {t("availability")}
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>{t("rights")}</p>
          <p>{t("edition")}</p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5"
          >
            {t("github")}
            <ExternalIcon />
          </a>
        </div>
      </div>
    </footer>
  );
}
