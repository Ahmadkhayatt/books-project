import { getTranslations } from "next-intl/server";
import Link from "next/link";

type NoticeKind =
  | "created"
  | "exists"
  | "reviewDeleted"
  | "listingCreated"
  | "listingUpdated"
  | "listingCancelled"
  | "listingReserved"
  | "wishlistAdded"
  | "wishlistRemoved";

type NoticeBannerProps = {
  kind: NoticeKind | "error";
  code?: string;
  dismissHref: string;
};

const NOTICE_KEYS = {
  created: "created",
  exists: "exists",
  reviewDeleted: "reviewDeleted",
  listingCreated: "listingCreated",
  listingUpdated: "listingUpdated",
  listingCancelled: "listingCancelled",
  listingReserved: "listingReserved",
  wishlistAdded: "wishlistAdded",
  wishlistRemoved: "wishlistRemoved",
} as const;

/** Action redirect codes → notice keys. Unknown codes render nothing. */
const ERROR_CODE_KEYS: Record<string, string> = {
  reviewInvalid: "errorReview",
  commentInvalid: "errorComment",
  rateLimited: "errorRateLimited",
  invalidIsbn: "errorInvalid",
  invalid: "errorInvalid",
  errorInvalid: "errorInvalid",
  errorReview: "errorReview",
  errorComment: "errorComment",
  errorRateLimited: "errorRateLimited",
  errorGeneric: "errorGeneric",
  listingInvalid: "errorListing",
};

/**
 * Generic status/alert banner (contract H10). Unknown notice or error codes
 * render nothing — a stray query param must never produce invented copy.
 */
export async function NoticeBanner({
  kind,
  code,
  dismissHref,
}: NoticeBannerProps) {
  const t = await getTranslations("notice");

  let key: string | null = null;
  if (kind === "error") {
    key = code ? (ERROR_CODE_KEYS[code] ?? null) : null;
  } else {
    key = NOTICE_KEYS[kind];
  }

  if (!key) return null;

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={
        kind === "error" ? "notice notice--alert" : "notice notice--status"
      }
    >
      <p>{t(key)}</p>
      <Link href={dismissHref} className="notice__dismiss">
        {t("dismiss")}
      </Link>
    </div>
  );
}
