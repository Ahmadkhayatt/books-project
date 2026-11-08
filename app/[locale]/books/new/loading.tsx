import { getTranslations } from "next-intl/server";

const FORM_BARS = ["w-40", "w-64", "w-48", "w-72", "w-56", "w-36"];

export default async function NewBookLoading() {
  const t = await getTranslations("common");

  return (
    <div className="container-page py-10 md:py-14" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>

      <div className="skeleton h-3 w-28" />
      <div className="skeleton mt-4 h-9 w-44" />
      <div className="skeleton mt-3 h-4 w-full max-w-lg" />

      <div className="form-card mt-8">
        {FORM_BARS.map((width) => (
          <div key={width} className="mt-5 first:mt-0">
            <div className="skeleton h-3 w-24" />
            <div className={`skeleton mt-2 h-11 ${width}`} />
          </div>
        ))}
        <div className="skeleton mt-6 h-11 w-40" />
      </div>
    </div>
  );
}
