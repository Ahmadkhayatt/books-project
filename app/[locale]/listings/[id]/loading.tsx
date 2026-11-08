import { getTranslations } from "next-intl/server";

export default async function ListingLoading() {
  const t = await getTranslations("common");

  return (
    <div className="container-page py-10 md:py-14" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>

      <div className="grid gap-8 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-4 lg:col-span-3">
          <div className="cover-mat mx-auto w-full max-w-xs">
            <div className="skeleton aspect-[2/3] w-full" />
          </div>
        </div>

        <div className="md:col-span-8 lg:col-span-9">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton mt-4 h-10 w-3/4 max-w-xl" />
          <div className="skeleton mt-3 h-4 w-52" />
          <div className="mt-8 space-y-2">
            <div className="skeleton h-4 w-full max-w-2xl" />
            <div className="skeleton h-4 w-full max-w-xl" />
            <div className="skeleton h-4 w-2/3 max-w-lg" />
          </div>
          <div className="skeleton mt-8 h-11 w-40" />
        </div>
      </div>
    </div>
  );
}
