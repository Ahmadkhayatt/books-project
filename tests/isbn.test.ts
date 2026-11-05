import { describe, expect, it } from "vitest";

import {
  isbn10To13,
  isbn13To10,
  isbnPair,
  isValidIsbn,
  isValidIsbn10,
  isValidIsbn13,
  normalizeIsbn,
  parseIsbn,
} from "../lib/isbn";

describe("normalizeIsbn", () => {
  it("strips spaces and hyphens and uppercases x", () => {
    expect(normalizeIsbn(" 0-14-143951-3 ")).toBe("0141439513");
    expect(normalizeIsbn("0 8044 2957 x")).toBe("080442957X");
    expect(normalizeIsbn("978\u20100\u201014\u2010143\u2010951\u20108")).toBe(
      "9780141439518",
    );
  });
});

describe("isValidIsbn10", () => {
  it("accepts valid ISBN-10s with digits or X", () => {
    expect(isValidIsbn10("0141439513")).toBe(true);
    expect(isValidIsbn10("080442957x")).toBe(true);
  });

  it("rejects wrong check digits and malformed strings", () => {
    expect(isValidIsbn10("0141439514")).toBe(false);
    expect(isValidIsbn10("014143951X")).toBe(false);
    expect(isValidIsbn10("014143951")).toBe(false);
    expect(isValidIsbn10("01414395131")).toBe(false);
  });
});

describe("isValidIsbn13", () => {
  it("accepts valid ISBN-13s", () => {
    expect(isValidIsbn13("9780141439518")).toBe(true);
    expect(isValidIsbn13("978-0-306-40615-7")).toBe(true);
  });

  it("rejects wrong check digits", () => {
    expect(isValidIsbn13("9780141439519")).toBe(false);
    expect(isValidIsbn13("978014143951")).toBe(false);
  });
});

describe("parseIsbn", () => {
  it("recognises the structural format without validating checksums", () => {
    expect(parseIsbn("9780141439518")).toEqual({
      kind: "isbn13",
      value: "9780141439518",
    });
    expect(parseIsbn("0-14-143951-3")).toEqual({
      kind: "isbn10",
      value: "0141439513",
    });
    expect(parseIsbn("9780141439519")).toEqual({
      kind: "isbn13",
      value: "9780141439519",
    });
  });

  it("returns null for edge strings", () => {
    expect(parseIsbn("")).toBeNull();
    expect(parseIsbn("not-an-isbn")).toBeNull();
    expect(parseIsbn("978014143951")).toBeNull();
    expect(parseIsbn("1234567890")).not.toBeNull(); // shape ok, checksum checked later
    expect(isValidIsbn("1234567890")).toBe(false);
  });
});

describe("isbn10To13", () => {
  it("converts a valid ISBN-10 to a 978 ISBN-13", () => {
    expect(isbn10To13("0141439513")).toBe("9780141439518");
    expect(isbn10To13("080442957X")).toBe("9780804429573");
  });

  it("returns null for invalid input", () => {
    expect(isbn10To13("0141439514")).toBeNull();
    expect(isbn10To13("9780141439518")).toBeNull();
  });
});

describe("isbn13To10", () => {
  it("converts 978-prefixed ISBN-13s only", () => {
    expect(isbn13To10("9780141439518")).toBe("0141439513");
    expect(isbn13To10("9791234567896")).toBeNull();
  });

  it("returns null when the checksum is invalid", () => {
    expect(isbn13To10("9780141439519")).toBeNull();
  });
});

describe("isbnPair", () => {
  it("prefers ISBN-13 and keeps both formats when derivable", () => {
    expect(isbnPair("0-14-143951-3")).toEqual({
      isbn13: "9780141439518",
      isbn10: "0141439513",
    });
    expect(isbnPair("9780141439518")).toEqual({
      isbn13: "9780141439518",
      isbn10: "0141439513",
    });
  });

  it("stores 979-prefixed ISBNs as ISBN-13 only", () => {
    expect(isbnPair("9791234567896")).toEqual({
      isbn13: "9791234567896",
      isbn10: null,
    });
  });

  it("rejects invalid checksums", () => {
    expect(isbnPair("9780141439519")).toBeNull();
    expect(isbnPair("abc")).toBeNull();
  });
});
