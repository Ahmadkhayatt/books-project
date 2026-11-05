import { getTranslations } from "next-intl/server";

const SKELETON_ROWS = ["w-44", "w-56", "w-36"];

export default async function LocaleLoading() {
  const t = await getTranslations("common");

  return (
    <div className="container-page py-12 md:py-16" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>

      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-6 h-12 w-3/4 max-w-2xl" />
      <div className="skeleton mt-3 h-12 w-1/2 max-w-xl" />
      <div className="skeleton mt-6 h-4 w-full max-w-md" />

      <div className="mt-10">
        {SKELETON_ROWS.map((width) => (
          <div key={width} className="ledger-row principle-row">
            <div className="skeleton h-8 w-10" />
            <div className="flex-1 space-y-2">
              <div className={`skeleton h-4 ${width}`} />
              <div className="skeleton h-3 w-full max-w-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
