import { describe, expect, it } from "vitest";

import {
  isAllowedCoverUrl,
  mapOpenLibraryBook,
} from "../lib/openlibrary-map";

const fixture = {
  url: "https://openlibrary.org/books/OL7353617M/Pride_and_Prejudice",
  key: "/books/OL7353617M",
  title: "Pride and Prejudice",
  subtitle: "A Novel",
  authors: [
    { name: "Jane Austen", url: "https://openlibrary.org/authors/OL21594A/Jane_Austen" },
    { name: "Jane Austen", key: "/authors/OL21594A" },
  ],
  publishers: [{ name: "Penguin Books" }, { name: "Another House" }],
  publish_date: "October 2004",
  number_of_pages: "435",
  subjects: [
    { name: "Fiction" },
    { name: "Romance" },
    "Classics",
    { name: "Fiction" },
  ],
  languages: [{ key: "/languages/eng" }],
  cover: {
    small: "https://covers.openlibrary.org/b/id/1-S.jpg",
    large: "https://covers.openlibrary.org/b/id/12645114-L.jpg",
  },
};

describe("mapOpenLibraryBook", () => {
  it("maps the jscmd=data payload to our DTO", () => {
    const book = mapOpenLibraryBook(fixture);

    expect(book).not.toBeNull();
    expect(book).toMatchObject({
      title: "Pride and Prejudice",
      subtitle: "A Novel",
      publisher: "Penguin Books",
      publishedYear: 2004,
      pageCount: 435,
      language: "en",
      openLibraryKey: "/books/OL7353617M",
      coverUrl:
        "https://covers.openlibrary.org/b/id/12645114-L.jpg?default=false",
    });
    expect(book?.authors).toEqual([
      { name: "Jane Austen", openLibraryKey: "/authors/OL21594A" },
    ]);
    expect(book?.subjects).toEqual(["Fiction", "Romance", "Classics"]);
  });

  it("returns null without a usable title", () => {
    expect(mapOpenLibraryBook({})).toBeNull();
    expect(mapOpenLibraryBook({ title: "   " })).toBeNull();
    expect(mapOpenLibraryBook(null)).toBeNull();
  });

  it("extracts years from the three publish_date shapes", () => {
    expect(
      mapOpenLibraryBook({ title: "A", publish_date: "2004-10-01" })?.publishedYear,
    ).toBe(2004);
    expect(
      mapOpenLibraryBook({ title: "A", publish_date: "2004" })?.publishedYear,
    ).toBe(2004);
    expect(
      mapOpenLibraryBook({ title: "A", publish_date: "no date" })?.publishedYear,
    ).toBeNull();
  });

  it("parses string page counts and ignores bad ones", () => {
    expect(
      mapOpenLibraryBook({ title: "A", number_of_pages: "xlii, 435 p." })
        ?.pageCount,
    ).toBe(435);
    expect(
      mapOpenLibraryBook({ title: "A", number_of_pages: "unknown" })?.pageCount,
    ).toBeNull();
  });

  it("maps known languages and returns null for unknown ones", () => {
    expect(
      mapOpenLibraryBook({ title: "A", languages: ["/languages/ara"] })?.language,
    ).toBe("ar");
    expect(
      mapOpenLibraryBook({ title: "A", languages: [{ key: "/languages/fra" }] })
        ?.language,
    ).toBe("fr");
    expect(
      mapOpenLibraryBook({ title: "A", languages: [{ key: "/languages/xyz" }] })
        ?.language,
    ).toBeNull();
  });

  it("falls back to the first covers id when cover.large is absent", () => {
    expect(
      mapOpenLibraryBook({ title: "A", covers: [12645114] })?.coverUrl,
    ).toBe("https://covers.openlibrary.org/b/id/12645114-L.jpg?default=false");
    expect(
      mapOpenLibraryBook({ title: "A", covers: [-1] })?.coverUrl,
    ).toBeNull();
    expect(mapOpenLibraryBook({ title: "A" })?.coverUrl).toBeNull();
  });

  it("drops cover URLs on non-allowlisted hosts", () => {
    expect(
      mapOpenLibraryBook({
        title: "A",
        cover: { large: "https://evil.example/cover.jpg" },
      })?.coverUrl,
    ).toBeNull();
    expect(isAllowedCoverUrl("https://covers.openlibrary.org/b/id/1-L.jpg")).toBe(
      true,
    );
    expect(isAllowedCoverUrl("https://evil.example/cover.jpg")).toBe(false);
    expect(isAllowedCoverUrl("not a url")).toBe(false);
  });

  it("caps and dedupes subjects", () => {
    const subjects = Array.from({ length: 20 }, (_, index) => `Subject ${index}`);
    const book = mapOpenLibraryBook({ title: "A", subjects });
    expect(book?.subjects).toHaveLength(12);
  });
});
