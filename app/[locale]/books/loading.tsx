import { getTranslations } from "next-intl/server";

const SKELETONS = Array.from({ length: 12 }, (_, index) => index);

export default async function CatalogLoading() {
  const t = await getTranslations("common");

  return (
    <div className="container-page py-10 md:py-14" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="skeleton h-3 w-28" />
          <div className="skeleton mt-4 h-9 w-48" />
          <div className="skeleton mt-3 h-4 w-36" />
        </div>
        <div className="skeleton h-11 w-32" />
      </div>

      <div className="rule-double mt-8" aria-hidden="true" />

      <div className="catalog-grid mt-8">
        {SKELETONS.map((index) => (
          <div key={index}>
            <div className="skeleton aspect-[2/3] w-full" />
            <div className="skeleton mt-3 h-4 w-3/4" />
            <div className="skeleton mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
