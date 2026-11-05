import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const locales = ["ar", "en"];

function readMessages(locale) {
  return JSON.parse(
    readFileSync(path.join(root, "messages", `${locale}.json`), "utf8"),
  );
}

function flatten(value, prefix = "", output = {}) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    output[prefix] = value;
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, output);
  }
  return output;
}

const flat = Object.fromEntries(
  locales.map((locale) => [locale, flatten(readMessages(locale))]),
);

let failed = false;

const keySets = Object.fromEntries(
  locales.map((locale) => [locale, new Set(Object.keys(flat[locale]))]),
);

const allKeys = new Set(locales.flatMap((locale) => [...keySets[locale]]));

for (const key of [...allKeys].sort()) {
  for (const locale of locales) {
    if (!keySets[locale].has(key)) {
      console.error(`[i18n] missing key "${key}" in messages/${locale}.json`);
      failed = true;
    }
  }
}

for (const locale of locales) {
  for (const [key, value] of Object.entries(flat[locale])) {
    if (typeof value !== "string" || value.trim() === "") {
      console.error(`[i18n] empty or non-string value for "${key}" in ${locale}.json`);
      failed = true;
    }
  }
}

const BIDI_DANGEROUS = /(isbn|url|email|username|handle|website|link)/i;
const bidiKeys = [...allKeys].filter((key) => BIDI_DANGEROUS.test(key)).sort();

if (bidiKeys.length > 0) {
  console.log("[i18n] bidi audit — render these inside <bdi dir=\"ltr\">:");
  for (const key of bidiKeys) {
    console.log(`  - ${key}`);
  }
} else {
  console.log("[i18n] bidi audit — no dangerous keys found.");
}

console.log(
  `[i18n] ar: ${keySets.ar.size} keys · en: ${keySets.en.size} keys · shared: ${allKeys.size}`,
);

if (failed) {
  process.exit(1);
}

console.log("[i18n] key parity and non-empty values OK.");
