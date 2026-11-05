import { cn } from "@/lib/utils";

type SealProps = {
  locale: string;
  text: string;
  className?: string;
};

/**
 * Round library seal (DESIGN.md §5.7). Decorative: the adjacent heading
 * carries the meaning, so the SVG is hidden from assistive tech.
 */
export function Seal({ locale, text, className }: SealProps) {
  return (
    <svg
      viewBox="0 0 160 160"
      className={cn("seal", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <path
          id="seal-arc"
          d="M 80 80 m -59 0 a 59 59 0 1 1 118 0 a 59 59 0 1 1 -118 0"
        />
      </defs>
      <circle cx="80" cy="80" r="74" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="80" cy="80" r="42" fill="none" stroke="currentColor" strokeWidth="1" />
      <text
        className={locale === "ar" ? "seal-text seal-text-ar" : "seal-text seal-text-en"}
        fill="currentColor"
        direction={locale === "ar" ? "rtl" : "ltr"}
      >
        <textPath href="#seal-arc" startOffset="50%" textAnchor="middle">
          {text}
        </textPath>
      </text>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M80 66c-6.5-3.5-13.6-4.5-20.5-3.6v28.2c6.9-.9 14 .1 20.5 3.6 6.5-3.5 13.6-4.5 20.5-3.6V62.4c-6.9-.9-14 .1-20.5 3.6Z" />
        <path d="M80 66v28.2" />
        <path d="M66 76h8M66 82h8M86 76h8M86 82h8" />
      </g>
    </svg>
  );
}
