import { getTranslations } from "next-intl/server";

import {
  toggleCommentLike,
  toggleReviewLike,
} from "@/app/[locale]/books/[id]/actions";
import { HeartIcon } from "@/components/icons";
import { formatCount } from "@/lib/utils";

type LikeFormProps = {
  kind: "review" | "comment";
  targetId: string;
  liked: boolean;
  count: number;
  locale: string;
};

/**
 * A plain progressive-enhancement form POST. No client state: the DB unique
 * constraint plus the toggle action make repeated posts idempotent.
 */
export async function LikeForm({
  kind,
  targetId,
  liked,
  count,
  locale,
}: LikeFormProps) {
  const t = await getTranslations("book");
  const action =
    kind === "review"
      ? toggleReviewLike.bind(null, targetId)
      : toggleCommentLike.bind(null, targetId);

  return (
    <form action={action} className="inline-flex">
      <button
        type="submit"
        className="like-button"
        aria-pressed={liked}
        aria-label={t("likeLabel")}
      >
        <HeartIcon />
        <span aria-hidden="true">{formatCount(locale, count)}</span>
      </button>
    </form>
  );
}
