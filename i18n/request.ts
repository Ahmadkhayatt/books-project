import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import * as rootParams from "next/root-params";
import { notFound } from "next/navigation";

import { routing } from "./routing";

// Next 16: the locale segment is a root param, readable during rendering.
// `setRequestLocale` is legacy and deliberately not used.
export default getRequestConfig(async ({ locale }) => {
  let resolved = locale;

  if (!resolved) {
    const value = await rootParams.locale();
    if (!hasLocale(routing.locales, value)) notFound();
    resolved = value;
  }

  if (!hasLocale(routing.locales, resolved)) notFound();

  return {
    locale: resolved,
    messages: (await import(`../messages/${resolved}.json`)).default,
  };
});
