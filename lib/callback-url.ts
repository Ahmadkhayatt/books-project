/**
 * Shared `callbackUrl` validation for the auth pages and actions.
 *
 * The contract rule is "relative paths only, never protocol-relative". That
 * alone is not enough: browsers normalise backslashes to slashes, and
 * whitespace/control characters can slip through path checks. Reject any of
 * those so a crafted `callbackUrl` can never become an open redirect.
 */
export function sanitizeCallbackUrl(value: unknown, fallback: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // Backslash, whitespace of any kind, and C0/C1 control characters.
  if (/[\\\s\u0000-\u001f\u007f-\u009f]/.test(raw)) return fallback;
  return raw;
}
