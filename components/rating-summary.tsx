import { getTranslations } from "next-intl/server";

import { StarIcon } from "@/components/icons";
import type { RatingHistogram } from "@/lib/books";
import { formatCount } from "@/lib/utils";

type RatingSummaryProps = {
  locale: string;
  average: number;
  count: number;
  histogram: RatingHistogram;
};

export async function RatingSummary({
  locale,
  average,
  count,
  histogram,
}: RatingSummaryProps) {
  const t = await getTranslations("book");
  const averageText =
    count > 0
      ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
          average,
        )
      : "—";
  const filled = count > 0 ? Math.round(average) : 0;
  const max = Math.max(...Object.values(histogram), 1);

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-center">
      <div className="flex flex-wrap items-center gap-4">
        <p className="font-display text-3xl font-semibold leading-none text-ink">
          {averageText}
        </p>
        <div>
          <div className="rating-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <StarIcon key={star} filled={star <= filled} />
            ))}
          </div>
          {count > 0 ? (
            <span className="sr-only">
              {t("averageOfFive", { average: averageText })}
            </span>
          ) : null}
          <p className="mt-1 text-sm text-ink-soft">
            {t("ratingCount", { count })}
          </p>
        </div>
      </div>

      <div>
        <div className="histogram">
          {[5, 4, 3, 2, 1].map((star) => {
            const value = histogram[star as 1 | 2 | 3 | 4 | 5];
            const width = count > 0 ? Math.round((value / max) * 100) : 0;
            return (
              <div key={star} className="histogram-row">
                <span>{formatCount(locale, star)}</span>
                <div className="histogram-track" aria-hidden="true">
                  <div
                    className="histogram-fill"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="histogram-count">
                  {formatCount(locale, value)}
                </span>
              </div>
            );
          })}
        </div>
        {count === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">{t("noRatings")}</p>
        ) : null}
      </div>
    </div>
  );
}
