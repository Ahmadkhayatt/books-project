import { getTranslations } from "next-intl/server";

import {
  createComment,
  deleteComment,
} from "@/app/[locale]/books/[id]/actions";
import { LikeForm } from "@/components/like-form";
import { SubmitButton } from "@/components/submit-button";
import type { DiscussionComment } from "@/lib/books";

type CommentItemProps = {
  comment: DiscussionComment;
  depth: number;
  bookId: string;
  locale: string;
  viewerId: string | null;
};

const EMPTY_COMMENT_STATE = { ok: true } as const;

function commentDate(locale: string, date: Date): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export async function CommentItem({
  comment,
  depth,
  bookId,
  locale,
  viewerId,
}: CommentItemProps) {
  const t = await getTranslations("book");
  const own = viewerId === comment.user.id;
  const canReply = Boolean(viewerId) && depth < 3 && !comment.deletedAt;
  const displayName =
    comment.user.profile?.displayName?.trim() ||
    comment.user.name?.trim() ||
    comment.user.username;
  const monogram = Array.from(displayName)[0]?.toUpperCase() ?? "?";

  const body = (
    <p className="comment-item__body whitespace-pre-line" dir="auto">
      {comment.body}
    </p>
  );

  return (
    <li className="comment-item">
      {comment.deletedAt ? (
        <p className="py-1 text-sm italic text-ink-faint">
          {t("commentDeleted")}
        </p>
      ) : (
        <>
          <div className="comment-item__meta">
            <span className="monogram" aria-hidden="true">
              {monogram}
            </span>
            <span className="font-semibold text-ink" dir="auto">
              {displayName}
            </span>
            <bdi dir="ltr">@{comment.user.username}</bdi>
            <time dateTime={comment.createdAt.toISOString()}>
              {commentDate(locale, comment.createdAt)}
            </time>
            {comment.containsSpoiler ? (
              <span className="chip chip--stamp">{t("spoilerChip")}</span>
            ) : null}
          </div>

          {comment.containsSpoiler ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-sm text-leather">
                {t("spoilerReveal")}
              </summary>
              {body}
            </details>
          ) : (
            body
          )}

          <div className="comment-item__actions">
            {viewerId ? (
              <LikeForm
                kind="comment"
                targetId={comment.id}
                liked={comment.viewerLiked}
                count={comment.likeCount}
                locale={locale}
              />
            ) : null}

            {canReply ? (
              <details className="w-full">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-leather">
                  {t("reply")}
                </summary>
                <form
                  action={createComment.bind(null, EMPTY_COMMENT_STATE)}
                  className="mt-2"
                >
                  <input type="hidden" name="bookId" value={bookId} />
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="parentId" value={comment.id} />
                  <input
                    type="hidden"
                    name="reviewId"
                    value={comment.reviewId ?? ""}
                  />
                  <textarea
                    name="body"
                    required
                    maxLength={2000}
                    rows={3}
                    aria-label={t("commentPlaceholder")}
                    placeholder={t("commentPlaceholder")}
                    className="field"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="checkbox"
                        name="containsSpoiler"
                        value="1"
                        className="h-5 w-5 accent-leather"
                      />
                      {t("containsSpoiler")}
                    </label>
                    <SubmitButton
                      label={t("postComment")}
                      className="btn--secondary btn--sm"
                    />
                  </div>
                </form>
              </details>
            ) : null}

            {own ? (
              <form action={deleteComment} className="inline-flex">
                <input type="hidden" name="commentId" value={comment.id} />
                <input type="hidden" name="bookId" value={bookId} />
                <input type="hidden" name="locale" value={locale} />
                <SubmitButton
                  label={t("deleteComment")}
                  className="btn--danger btn--sm"
                  confirmMessage={t("deleteCommentConfirm")}
                />
              </form>
            ) : null}
          </div>
        </>
      )}

      {comment.replies.length > 0 ? (
        <ol className="comment-reply mt-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              bookId={bookId}
              locale={locale}
              viewerId={viewerId}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}
