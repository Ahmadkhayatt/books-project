"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { rateBook } from "@/app/[locale]/books/[id]/actions";
import { StarIcon } from "@/components/icons";

type RatingInputProps = {
  bookId: string;
  currentValue: number | null;
  locale: string;
  labels: {
    group: string;
    save: string;
    saved: string;
    stars: string[];
  };
};

/**
 * One of the three M1 client islands. Selection is local; the rating is only
 * written when the reader explicitly saves it (upsert → one row per user/book).
 */
export function RatingInput({
  bookId,
  currentValue,
  locale,
  labels,
}: RatingInputProps) {
  const [selected, setSelected] = useState(currentValue ?? 0);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    if (selected < 1) return;
    startTransition(async () => {
      const result = await rateBook(bookId, selected, locale);
      if (result.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="rating-input">
      <fieldset>
        <legend className="sr-only">{labels.group}</legend>
        <div className="rating-input__stars">
          {[5, 4, 3, 2, 1].map((value) => (
            <label
              key={value}
              className="rating-input__option"
              data-filled={value <= selected}
            >
              <input
                type="radio"
                name={`rating-${bookId}`}
                value={value}
                checked={selected === value}
                onChange={() => {
                  setSelected(value);
                  setSaved(false);
                }}
                className="sr-only"
              />
              <StarIcon filled={value <= selected} />
              <span className="sr-only">{labels.stars[value - 1]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn--primary"
          onClick={save}
          disabled={pending || selected < 1}
          aria-disabled={pending || selected < 1 || undefined}
        >
          {labels.save}
        </button>
        <span
          role="status"
          aria-live="polite"
          className="text-sm text-cloth-deep"
        >
          {saved ? labels.saved : ""}
        </span>
      </div>
    </div>
  );
}
