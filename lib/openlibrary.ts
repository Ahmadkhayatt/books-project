import "server-only";

import { isbnPair, parseIsbn } from "@/lib/isbn";
import {
  mapOpenLibraryBook,
  type OpenLibraryBook,
} from "@/lib/openlibrary-map";

/**
 * Server-only Open Library client (PLAN.md §5).
 *
 * - `jscmd=data` (never viewapi): it carries title, authors, publishers,
 *   pagination and subjects.
 * - 30-day Next fetch revalidation + per-process in-flight memoisation so
 *   repeat lookups and concurrent requests never stampede Open Library.
 * - A single 2 s back-off retry on HTTP 429, then a graceful `unavailable`
 *   result (the add-book form falls back to manual entry — never a dead end).
 */

export type LookupResult =
  | { kind: "found"; book: OpenLibraryBook }
  | { kind: "not-found" }
  | { kind: "unavailable" }
  | { kind: "invalid" };

const OPEN_LIBRARY_ENDPOINT = "https://openlibrary.org/api/books";
const USER_AGENT = "BookshelfExchange/1.0 (github.com/Ahmadkhayatt/books-project)";
const REVALIDATE_SECONDS = 60 * 60 * 24 * 30;
const TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 2_000;

const inFlight = new Map<string, Promise<LookupResult>>();

function lookupUrl(isbn13: string): string {
  const params = new URLSearchParams({
    bibkeys: `ISBN:${isbn13}`,
    jscmd: "data",
    format: "json",
  });
  return `${OPEN_LIBRARY_ENDPOINT}?${params.toString()}`;
}

async function fetchOnce(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function lookupUncached(isbn13: string): Promise<LookupResult> {
  const url = lookupUrl(isbn13);

  try {
    let response = await fetchOnce(url);

    if (response.status === 429) {
      await wait(RETRY_DELAY_MS);
      response = await fetchOnce(url);
    }

    if (response.status === 429 || response.status >= 500) {
      return { kind: "unavailable" };
    }

    if (response.status === 404) {
      return { kind: "not-found" };
    }

    if (!response.ok) {
      return { kind: "unavailable" };
    }

    const text = await response.text();
    if (!text.trim()) return { kind: "not-found" };

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return { kind: "unavailable" };
    }

    const key = `ISBN:${isbn13}`;
    if (typeof payload !== "object" || payload === null) {
      return { kind: "not-found" };
    }

    const entry = (payload as Record<string, unknown>)[key];
    if (entry === undefined || entry === null) {
      return { kind: "not-found" };
    }

    const book = mapOpenLibraryBook(entry);
    return book ? { kind: "found", book } : { kind: "not-found" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { kind: "unavailable" };
    }
    return { kind: "unavailable" };
  }
}

/**
 * Look up one ISBN. Accepts ISBN-10 or ISBN-13, normalises to ISBN-13 and
 * returns an invalid result before touching the network when the checksum
 * does not hold.
 */
export async function lookupBookByIsbn(input: string): Promise<LookupResult> {
  const parsed = parseIsbn(input);
  if (!parsed) return { kind: "invalid" };

  const pair = isbnPair(parsed.value);
  if (!pair) return { kind: "invalid" };

  const isbn13 = pair.isbn13;
  const pending = inFlight.get(isbn13);
  if (pending) return pending;

  const request = lookupUncached(isbn13).finally(() => {
    inFlight.delete(isbn13);
  });

  inFlight.set(isbn13, request);
  return request;
}
