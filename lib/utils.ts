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

const countFormatters = new Map<string, Intl.NumberFormat>();
const yearFormatters = new Map<string, Intl.NumberFormat>();

/** Locale-aware integer formatting (Arabic-Indic digits under `ar`). */
export function formatCount(locale: string, value: number): string {
  let formatter = countFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale);
    countFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}

/** Years never take grouping separators (٢٠٠٤, not ٢٬٠٠٤). */
export function formatYear(locale: string, value: number): string {
  let formatter = yearFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { useGrouping: false });
    yearFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}

/**
 * Languages offered in the add-book form (ISO 639-1). Kept outside the
 * `"use server"` action module, which may only export async functions.
 */
export const BOOK_LANGUAGE_CODES = [
  "ar",
  "en",
  "fr",
  "de",
  "es",
  "it",
  "pt",
  "tr",
  "fa",
  "ur",
  "hi",
  "ru",
  "ja",
  "zh",
] as const;

export type BookLanguageCode = (typeof BOOK_LANGUAGE_CODES)[number];

/**
 * Catalogue display title: Arabic surfaces prefer the Arabic title when we
 * have one; English surfaces keep the record's primary title.
 */
export function displayTitle(
  book: { title: string; titleAr?: string | null },
  locale: string,
): string {
  if (locale === "ar") {
    const titleAr = book.titleAr?.trim();
    if (titleAr) return titleAr;
  }
  return book.title;
}
