import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { Seal } from "@/components/seal";

export default async function LocaleNotFound() {
  const locale = await getLocale();
  const [t, hero] = await Promise.all([
    getTranslations("notFound"),
    getTranslations("hero"),
  ]);

  return (
    <div className="container-page flex flex-col items-center py-16 text-center md:py-24">
      <Seal
        locale={locale}
        text={hero("seal")}
        className="h-20 w-20 opacity-90"
      />
      <h1 className="mt-6 max-w-xl text-2xl md:text-3xl">{t("title")}</h1>
      <p className="ar-prose mt-3 max-w-md text-ink-soft">{t("body")}</p>
      <Link href={`/${locale}`} className="btn btn--ghost mt-6">
        {t("cta")}
      </Link>
    </div>
  );
}
