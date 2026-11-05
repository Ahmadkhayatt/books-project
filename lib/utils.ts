/** Small class-name joiner — the only utility helper in M0. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const ARABIC_INDIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Two-digit catalogue index in the locale's numerals (٠١ / 01). */
export function formatIndex(locale: string, value: number): string {
  const padded = String(Math.max(0, Math.trunc(value))).padStart(2, "0");
  if (locale !== "ar") return padded;
  return padded.replace(/\d/g, (digit) => ARABIC_INDIC_DIGITS[Number(digit)]);
}
