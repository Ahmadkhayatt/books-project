import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { LikeForm } from "@/components/like-form";
import type { ReviewWithMeta } from "@/lib/books";

type ReviewCardProps = {
  review: ReviewWithMeta;
  locale: string;
  viewerId: string | null;
};

function reviewDate(locale: string, date: Date): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export async function ReviewCard({ review, locale, viewerId }: ReviewCardProps) {
  const t = await getTranslations("book");
  const own = viewerId === review.user.id;
  const displayName =
    review.user.profile?.displayName?.trim() ||
    review.user.name?.trim() ||
    review.user.username;
  const monogram = Array.from(displayName)[0]?.toUpperCase() ?? "?";

  const body = (
    <p className="review-card__body whitespace-pre-line" dir="auto">
      {review.body}
    </p>
  );

  return (
    <article className="review-card">
      <div className="review-card__meta">
        <span className="monogram" aria-hidden="true">
          {monogram}
        </span>
        <span className="text-sm font-semibold text-ink" dir="auto">
          {displayName}
        </span>
        <bdi dir="ltr" className="text-xs text-ink-faint">
          @{review.user.username}
        </bdi>
        <time
          dateTime={review.createdAt.toISOString()}
          className="text-xs text-ink-faint"
        >
          {reviewDate(locale, review.createdAt)}
        </time>
        {own ? (
          <span className="chip chip--cloth">{t("yourReviewBadge")}</span>
        ) : null}
        {review.containsSpoiler ? (
          <span className="chip chip--stamp">{t("spoilerChip")}</span>
        ) : null}
      </div>

      {review.title ? (
        <h3 className="mt-3 text-lg" dir="auto">
          {review.title}
        </h3>
      ) : null}

      {review.containsSpoiler ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-leather">
            {t("spoilerReveal")}
          </summary>
          {body}
        </details>
      ) : (
        body
      )}

      <div className="review-card__footer">
        <LikeForm
          kind="review"
          targetId={review.id}
          liked={review.viewerLiked}
          count={review._count.likes}
          locale={locale}
        />
        {own ? (
          <Link href="#review-form" className="btn btn--ghost btn--sm">
            {t("editReview")}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
