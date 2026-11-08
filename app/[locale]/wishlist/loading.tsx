import { getTranslations } from "next-intl/server";

const LEDGER_ROWS = Array.from({ length: 3 }, (_, index) => index);

export default async function WishlistLoading() {
  const t = await getTranslations("common");

  return (
    <div className="container-page py-10 md:py-14" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>

      <div className="skeleton h-3 w-32" />
      <div className="skeleton mt-4 h-10 w-56" />
      <div className="skeleton mt-3 h-4 w-48" />

      <div className="mt-10 space-y-3">
        {LEDGER_ROWS.map((row) => (
          <div key={row} className="ledger-row listings-row items-center gap-4">
            <div className="skeleton aspect-[2/3] w-14 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton h-4 w-56" />
              <div className="skeleton h-3 w-40" />
            </div>
            <div className="skeleton h-8 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
