"use client";

import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type LocaleSwitcherProps = {
  locale: string;
  labels: { ar: string; en: string; label: string };
  tone?: "light" | "dark";
  className?: string;
};

export function LocaleSwitcher({
  locale,
  labels,
  tone = "light",
  className,
}: LocaleSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(target: "ar" | "en") {
    if (target === locale) return;
    const segments = (pathname || "/").split("/");
    if (segments[1] === "ar" || segments[1] === "en") {
      segments[1] = target;
    } else {
      segments.splice(1, 0, target);
    }
    router.replace(segments.join("/") || `/${target}`);
  }

  return (
    <div
      role="group"
      aria-label={labels.label}
      className={cn(
        "segmented",
        tone === "dark" && "segmented--on-ink",
        className,
      )}
    >
      <button
        type="button"
        lang="ar"
        aria-pressed={locale === "ar"}
        onClick={() => switchTo("ar")}
      >
        {labels.ar}
      </button>
      <button
        type="button"
        lang="en"
        aria-pressed={locale === "en"}
        onClick={() => switchTo("en")}
      >
        {labels.en}
      </button>
    </div>
  );
}
