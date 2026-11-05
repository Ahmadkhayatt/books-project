import { getTranslations } from "next-intl/server";
import Link from "next/link";

type NoticeBannerProps = {
  kind: "created" | "exists" | "reviewDeleted" | "error";
  code?: string;
  dismissHref: string;
};

const NOTICE_KEYS = {
  created: "created",
  exists: "exists",
  reviewDeleted: "reviewDeleted",
} as const;

const ERROR_KEYS = [
  "errorInvalid",
  "errorReview",
  "errorComment",
  "errorRateLimited",
  "errorGeneric",
] as const;

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
    key =
      code && (ERROR_KEYS as readonly string[]).includes(code) ? code : null;
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
