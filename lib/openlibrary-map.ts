/**
 * Pure mapper for the Open Library `jscmd=data` book payload.
 *
 * Kept free of `server-only` so the shape is unit-testable without a running
 * Next.js server. No network access happens here.
 */

export const OL_COVER_HOST = "covers.openlibrary.org";

export type OpenLibraryAuthor = {
  name: string;
  openLibraryKey: string | null;
};

export type OpenLibraryBook = {
  title: string;
  subtitle: string | null;
  authors: OpenLibraryAuthor[];
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  subjects: string[];
  language: string | null;
  openLibraryKey: string | null;
  coverUrl: string | null;
};

const LANGUAGE_MAP: Record<string, string> = {
  eng: "en",
  ara: "ar",
  fra: "fr",
  deu: "de",
  spa: "es",
  ita: "it",
  por: "pt",
  tur: "tr",
  fas: "fa",
  urd: "ur",
  hin: "hi",
  rus: "ru",
  jpn: "ja",
  zho: "zh",
};

const MAX_SUBJECTS = 12;
const MAX_SUBJECT_LENGTH = 60;
const MAX_AUTHOR_LENGTH = 120;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function namedValue(value: unknown): string | null {
  if (typeof value === "string") return cleanString(value);
  if (isRecord(value)) return cleanString(value.name);
  return null;
}

function extractYear(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function extractPageCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? Math.trunc(value) : null;
  }
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (!match) return null;
    const pages = Number(match[0]);
    return pages > 0 ? pages : null;
  }
  return null;
}

function extractLanguage(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    let code: string | null = null;
    if (typeof entry === "string") {
      const match = entry.match(/\/languages\/([A-Za-z]{3})/);
      code = match ? match[1] : entry;
    } else if (isRecord(entry)) {
      const key = cleanString(entry.key);
      if (key) {
        const match = key.match(/\/languages\/([A-Za-z]{3})/);
        code = match ? match[1] : key;
      }
    }
    if (!code) continue;
    const mapped = LANGUAGE_MAP[code.toLowerCase()];
    if (mapped) return mapped;
  }
  return null;
}

function authorKey(entry: UnknownRecord): string | null {
  const direct = cleanString(entry.key);
  if (direct) return direct;

  // jscmd=data sometimes omits `key` but exposes an author URL.
  const url = cleanString(entry.url);
  if (!url) return null;
  const match = url.match(/\/authors\/(OL\d+A)\b/);
  return match ? `/authors/${match[1]}` : null;
}

function extractAuthors(value: unknown): OpenLibraryAuthor[] {
  if (!Array.isArray(value)) return [];

  const authors: OpenLibraryAuthor[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const name = namedValue(entry)?.slice(0, MAX_AUTHOR_LENGTH).trim();
    if (!name) continue;
    const key = isRecord(entry) ? authorKey(entry) : null;
    const dedupeKey = key ?? name.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    authors.push({ name, openLibraryKey: key });
  }

  return authors;
}

function extractSubjects(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const subjects: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const name = namedValue(entry);
    if (!name) continue;
    const trimmed = name.slice(0, MAX_SUBJECT_LENGTH).trim();
    if (!trimmed) continue;
    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    subjects.push(trimmed);
    if (subjects.length >= MAX_SUBJECTS) break;
  }

  return subjects;
}

function allowlistedCoverUrl(candidate: unknown): string | null {
  const raw = cleanString(candidate);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== OL_COVER_HOST) return null;
    url.searchParams.set("default", "false");
    return url.toString();
  } catch {
    return null;
  }
}

function extractCover(entry: UnknownRecord): string | null {
  if (isRecord(entry.cover)) {
    const large = allowlistedCoverUrl(entry.cover.large);
    if (large) return large;
  }

  if (Array.isArray(entry.covers)) {
    const first = entry.covers[0];
    const id =
      typeof first === "number"
        ? first
        : typeof first === "string" && /^\d+$/.test(first.trim())
          ? Number(first.trim())
          : null;
    if (id !== null && Number.isInteger(id) && id > 0) {
      return `https://${OL_COVER_HOST}/b/id/${id}-L.jpg?default=false`;
    }
  }

  return null;
}

/**
 * Map one Open Library entry (the value stored under `ISBN:<isbn>`) to our
 * catalogue DTO. Returns null when the payload has no usable title.
 */
export function mapOpenLibraryBook(entry: unknown): OpenLibraryBook | null {
  if (!isRecord(entry)) return null;

  const title = cleanString(entry.title);
  if (!title) return null;

  return {
    title,
    subtitle: cleanString(entry.subtitle),
    authors: extractAuthors(entry.authors),
    publisher: Array.isArray(entry.publishers)
      ? namedValue(entry.publishers[0])
      : null,
    publishedYear: extractYear(
      typeof entry.publish_date === "string" ? entry.publish_date : null,
    ),
    pageCount: extractPageCount(entry.number_of_pages),
    subjects: extractSubjects(entry.subjects),
    language: extractLanguage(entry.languages),
    openLibraryKey: cleanString(entry.key),
    coverUrl: extractCover(entry),
  };
}

/** True only for the Open Library cover host (write-time validation). */
export function isAllowedCoverUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === OL_COVER_HOST;
  } catch {
    return false;
  }
}
