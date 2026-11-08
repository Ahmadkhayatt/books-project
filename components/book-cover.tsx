import Image from "next/image";

import { cn } from "@/lib/utils";

type BookCoverProps = {
  coverUrl: string | null;
  title: string;
  authorLine?: string;
  publisher?: string | null;
  alt: string;
  sizes: string;
  seed?: string;
  priority?: boolean;
  className?: string;
};

const VARIANTS = ["leather", "cloth", "stamp", "ink"] as const;

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * Covers are always 2:3. Open Library covers are hot-linked through
 * next/image (the only remote host allowlisted in next.config.ts); a missing
 * cover becomes the typographic cover from DESIGN.md §4.8 — never a broken
 * `<img>` and never a local copy of Open Library bytes.
 */
export function BookCover({
  coverUrl,
  title,
  authorLine,
  publisher,
  alt,
  sizes,
  seed,
  priority = false,
  className,
}: BookCoverProps) {
  const variant =
    VARIANTS[hashSeed(seed ?? title ?? "") % VARIANTS.length] ?? "leather";

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "relative aspect-[2/3] w-full overflow-hidden rounded-[3px]",
        className,
      )}
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          className={cn("typo-cover", `typo-cover--${variant}`)}
          aria-hidden="true"
        >
          <span className="typo-cover__title">{title}</span>
          {authorLine ? (
            <span className="typo-cover__author">{authorLine}</span>
          ) : null}
          {publisher ? (
            <span
              lang={hasArabic(publisher) ? "ar" : "en"}
              dir="auto"
              className="typo-cover__foot"
            >
              {publisher}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
