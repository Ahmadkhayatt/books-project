import { describe, expect, it } from "vitest";

import { routing } from "../i18n/routing";
import { cn, formatIndex } from "../lib/utils";

describe("i18n routing", () => {
  it("keeps Arabic as the default locale", () => {
    expect(routing.locales).toEqual(["ar", "en"]);
    expect(routing.defaultLocale).toBe("ar");
  });

  it("always prefixes locales in URLs", () => {
    expect(routing.localePrefix).toBe("always");
  });
});

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("btn", false, undefined, null, "btn--primary")).toBe(
      "btn btn--primary",
    );
  });

  it("returns an empty string with no classes", () => {
    expect(cn()).toBe("");
  });
});

describe("formatIndex", () => {
  it("uses Eastern Arabic-Indic digits for Arabic", () => {
    expect(formatIndex("ar", 3)).toBe("٠٣");
  });
});
