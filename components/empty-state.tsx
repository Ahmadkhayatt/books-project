import type { ReactNode } from "react";

type EmptyStateProps = {
  index?: string;
  title: string;
  body?: string;
  cta?: ReactNode;
};

/**
 * DESIGN.md §5.5 empty state: index numeral, inked stamp ring (80px), a
 * headline and one line of body. The stamp is decorative; the adjacent text
 * always carries the meaning.
 */
export function EmptyState({
  index = "0000",
  title,
  body,
  cta,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <svg
        viewBox="0 0 96 96"
        className="empty-state__stamp"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="48"
          cy="48"
          r="44"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle
          cx="48"
          cy="48"
          r="38"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M48 34c-5.4-3-11.4-3.6-17-2.9v30c5.6-.7 11.6-.1 17 2.9 5.4-3 11.4-3.6 17-2.9v-30c-5.6-.7-11.6.1-17 2.9Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M48 34v30" stroke="currentColor" strokeWidth="1.6" />
      </svg>

      <p className="empty-state__index" dir="ltr">
        № {index}
      </p>
      <p className="empty-state__title">{title}</p>
      {body ? <p className="empty-state__body">{body}</p> : null}
      {cta ? <div className="mt-3">{cta}</div> : null}
    </div>
  );
}
