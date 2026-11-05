/**
 * ISBN-10 / ISBN-13 normalisation and checksum helpers (pure, unit-tested).
 *
 * Rules (PLAN.md §5, M1 contract):
 * - Normalise whitespace, hyphen-like dashes and lowercase `x`.
 * - Validation is checksum-level, not length-only.
 * - Prefer ISBN-13 in storage; derive the 10-digit twin only for 978 prefixes.
 */

export type ParsedIsbn =
  | { kind: "isbn13"; value: string }
  | { kind: "isbn10"; value: string };

const HYPHENS = /[\s\u2010\u2011\u2012\u2013\u2014\u2015-]+/g;

/** Strip spaces/hyphens and uppercase an ISBN's check character. */
export function normalizeIsbn(input: string): string {
  return input.replace(HYPHENS, "").toUpperCase();
}

function isbn10Sum(value: string): number {
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const character = value[index];
    const digit = character === "X" ? 10 : Number(character);
    sum += (10 - index) * digit;
  }
  return sum;
}

/** ISBN-10 checksum: weighted sum (10…1) must divide by 11. */
export function isValidIsbn10(input: string): boolean {
  const value = normalizeIsbn(input);
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  return isbn10Sum(value) % 11 === 0;
}

/** ISBN-13 checksum: alternating 1/3 weights, sum must divide by 10. */
export function isValidIsbn13(input: string): boolean {
  const value = normalizeIsbn(input);
  if (!/^\d{13}$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < 13; index += 1) {
    const digit = Number(value[index]);
    sum += index % 2 === 0 ? digit : digit * 3;
  }
  return sum % 10 === 0;
}

/**
 * Parse the *shape* of an ISBN (10 or 13 characters). Checksums are validated
 * separately by `isValidIsbn` so callers can distinguish "malformed" from
 * "looks right but the check digit is wrong".
 */
export function parseIsbn(input: string): ParsedIsbn | null {
  const value = normalizeIsbn(input);
  if (/^\d{13}$/.test(value)) return { kind: "isbn13", value };
  if (/^\d{9}[\dX]$/.test(value)) return { kind: "isbn10", value };
  return null;
}

/** True when the input parses and its checksum is valid in either format. */
export function isValidIsbn(input: string): boolean {
  const parsed = parseIsbn(input);
  if (!parsed) return false;
  return parsed.kind === "isbn13"
    ? isValidIsbn13(parsed.value)
    : isValidIsbn10(parsed.value);
}

function isbn13CheckDigit(firstTwelve: string): string {
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(firstTwelve[index]);
    sum += index % 2 === 0 ? digit : digit * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

function isbn10CheckDigit(firstNine: string): string {
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += (10 - index) * Number(firstNine[index]);
  }
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? "X" : String(check);
}

/** Convert a valid ISBN-10 to its 978-prefixed ISBN-13 form. */
export function isbn10To13(input: string): string | null {
  if (!isValidIsbn10(input)) return null;
  const value = normalizeIsbn(input);
  const firstTwelve = `978${value.slice(0, 9)}`;
  return `${firstTwelve}${isbn13CheckDigit(firstTwelve)}`;
}

/**
 * Convert a valid 978-prefixed ISBN-13 to ISBN-10. 979-prefixed ISBNs have no
 * ISBN-10 equivalent and return null.
 */
export function isbn13To10(input: string): string | null {
  if (!isValidIsbn13(input)) return null;
  const value = normalizeIsbn(input);
  if (!value.startsWith("978")) return null;
  const firstNine = value.slice(3, 12);
  return `${firstNine}${isbn10CheckDigit(firstNine)}`;
}

/** Canonical pair for storage: ISBN-13 always, ISBN-10 when derivable. */
export function isbnPair(input: string): { isbn13: string; isbn10: string | null } | null {
  const parsed = parseIsbn(input);
  if (!parsed || !isValidIsbn(input)) return null;

  if (parsed.kind === "isbn13") {
    return { isbn13: parsed.value, isbn10: isbn13To10(parsed.value) };
  }

  const isbn13 = isbn10To13(parsed.value);
  return isbn13 ? { isbn13, isbn10: parsed.value } : null;
}
