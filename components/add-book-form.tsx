"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

import {
  createBook,
  type BookFormState,
  type BookFormValues,
} from "@/app/[locale]/books/new/actions";
import { AlertIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";

type AddBookFormProps = {
  defaults: BookFormValues;
  suggestedCoverUrl: string | null;
  languageOptions: Array<{ value: string; label: string }>;
  cancelHref: string;
};

type AuthorRow = {
  name: string;
  openLibraryKey: string | null;
};

const INITIAL_STATE: BookFormState = { ok: true };

export function AddBookForm({
  defaults,
  suggestedCoverUrl,
  languageOptions,
  cancelHref,
}: AddBookFormProps) {
  const t = useTranslations("addBook");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const [state, formAction] = useActionState(createBook, INITIAL_STATE);

  const [authors, setAuthors] = useState<AuthorRow[]>(
    defaults.authors.length > 0
      ? defaults.authors
      : [{ name: "", openLibraryKey: null }],
  );

  const fieldError = (name: string) =>
    state.ok === false ? state.fieldErrors?.[name] : undefined;

  const describedBy = (name: string, hintId?: string) => {
    const ids = hintId ? [hintId] : [];
    if (fieldError(name)) ids.push(`${name}-error`);
    return ids.length > 0 ? ids.join(" ") : undefined;
  };

  const errorText = (name: string) =>
    fieldError(name) ? (
      <p id={`${name}-error`} className="field-hint mt-1 text-stamp-deep">
        {t("fieldError")}
      </p>
    ) : null;

  function updateAuthor(index: number, name: string) {
    setAuthors((current) =>
      current.map((author, position) =>
        position === index ? { ...author, name } : author,
      ),
    );
  }

  function addAuthor() {
    setAuthors((current) =>
      current.length >= 10
        ? current
        : [...current, { name: "", openLibraryKey: null }],
    );
  }

  function removeAuthor(index: number) {
    setAuthors((current) =>
      current.length <= 1
        ? current
        : current.filter((_, position) => position !== index),
    );
  }

  return (
    <form action={formAction} className="form-card">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="isbn13" value={defaults.isbn13 ?? ""} />
      <input type="hidden" name="isbn10" value={defaults.isbn10 ?? ""} />
      <input
        type="hidden"
        name="openLibraryKey"
        value={defaults.openLibraryKey ?? ""}
      />
      {suggestedCoverUrl ? (
        <input type="hidden" name="coverUrl" value={suggestedCoverUrl} />
      ) : null}

      {state.ok === false ? (
        <div role="alert" className="form-alert">
          <AlertIcon className="mt-0.5 shrink-0" />
          <p>{state.message ?? t("errorSummary")}</p>
        </div>
      ) : null}

      <div className={state.ok === false ? "mt-5" : undefined}>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="title" className="text-sm text-ink-soft">
            {t("titleLabel")}
          </label>
          <span className="text-xs text-ink-faint">({tAuth("required")})</span>
        </div>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={defaults.title}
          aria-invalid={Boolean(fieldError("title")) || undefined}
          aria-describedby={describedBy("title")}
          className="field mt-2"
          dir="auto"
        />
        {errorText("title")}
      </div>

      <div className="mt-5">
        <label htmlFor="titleAr" className="text-sm text-ink-soft">
          {t("titleArLabel")}
        </label>
        <input
          id="titleAr"
          name="titleAr"
          type="text"
          maxLength={200}
          defaultValue={defaults.titleAr ?? ""}
          aria-invalid={Boolean(fieldError("titleAr")) || undefined}
          aria-describedby={describedBy("titleAr")}
          className="field mt-2"
          dir="rtl"
        />
        {errorText("titleAr")}
      </div>

      <div className="mt-5">
        <label htmlFor="subtitle" className="text-sm text-ink-soft">
          {t("subtitleLabel")}
        </label>
        <input
          id="subtitle"
          name="subtitle"
          type="text"
          maxLength={300}
          defaultValue={defaults.subtitle ?? ""}
          className="field mt-2"
          dir="auto"
        />
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm text-ink-soft">{t("authorsLabel")}</legend>
        <p className="field-hint mt-1">{t("authorsHint")}</p>

        <div className="mt-3 space-y-3">
          {authors.map((author, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`author-${index}`}
                  className="text-xs text-ink-faint"
                >
                  {t("authorLabel")}
                </label>
                <input
                  id={`author-${index}`}
                  name="authorName"
                  type="text"
                  required
                  maxLength={120}
                  value={author.name}
                  onChange={(event) => updateAuthor(index, event.target.value)}
                  aria-invalid={
                    Boolean(fieldError("authorName")) || undefined
                  }
                  aria-describedby={describedBy("authorName")}
                  className="field mt-1"
                  dir="auto"
                />
              </div>
              <input
                type="hidden"
                name="authorKey"
                value={author.openLibraryKey ?? ""}
              />
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => removeAuthor(index)}
                disabled={authors.length <= 1}
                aria-disabled={authors.length <= 1 || undefined}
              >
                {t("removeAuthor")}
              </button>
            </div>
          ))}
        </div>

        {errorText("authorName")}

        <button
          type="button"
          className="btn btn--secondary btn--sm mt-3"
          onClick={addAuthor}
          disabled={authors.length >= 10}
          aria-disabled={authors.length >= 10 || undefined}
        >
          {t("addAuthor")}
        </button>
      </fieldset>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="publisher" className="text-sm text-ink-soft">
            {t("publisherLabel")}
          </label>
          <input
            id="publisher"
            name="publisher"
            type="text"
            maxLength={200}
            defaultValue={defaults.publisher ?? ""}
            className="field mt-2"
            dir="auto"
          />
        </div>

        <div>
          <label htmlFor="publishedYear" className="text-sm text-ink-soft">
            {t("yearLabel")}
          </label>
          <input
            id="publishedYear"
            name="publishedYear"
            type="number"
            inputMode="numeric"
            min={1000}
            max={2100}
            defaultValue={defaults.publishedYear ?? ""}
            aria-invalid={Boolean(fieldError("publishedYear")) || undefined}
            aria-describedby={describedBy("publishedYear")}
            className="field mt-2"
            dir="ltr"
          />
          {errorText("publishedYear")}
        </div>

        <div>
          <label htmlFor="pageCount" className="text-sm text-ink-soft">
            {t("pagesLabel")}
          </label>
          <input
            id="pageCount"
            name="pageCount"
            type="number"
            inputMode="numeric"
            min={1}
            max={20000}
            defaultValue={defaults.pageCount ?? ""}
            aria-invalid={Boolean(fieldError("pageCount")) || undefined}
            aria-describedby={describedBy("pageCount")}
            className="field mt-2"
            dir="ltr"
          />
          {errorText("pageCount")}
        </div>

        <div>
          <label htmlFor="language" className="text-sm text-ink-soft">
            {t("languageLabel")}
          </label>
          <select
            id="language"
            name="language"
            defaultValue={defaults.language}
            className="field mt-2"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="subjects" className="text-sm text-ink-soft">
          {t("subjectsLabel")}
        </label>
        <input
          id="subjects"
          name="subjects"
          type="text"
          defaultValue={defaults.subjects.join(locale === "ar" ? "، " : ", ")}
          aria-describedby="subjects-hint"
          className="field mt-2"
          dir="auto"
        />
        <p id="subjects-hint" className="field-hint mt-1">
          {t("subjectsHint")}
        </p>
      </div>

      <div className="mt-5">
        <label htmlFor="description" className="text-sm text-ink-soft">
          {t("descriptionLabel")}
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          maxLength={5000}
          defaultValue={defaults.description ?? ""}
          aria-invalid={Boolean(fieldError("description")) || undefined}
          aria-describedby={describedBy("description")}
          className="field mt-2"
          dir="auto"
        />
        {errorText("description")}
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm text-ink-soft">{t("coverLabel")}</legend>
        {suggestedCoverUrl ? (
          <label className="mt-2 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="useCover"
              value="1"
              defaultChecked
              className="h-5 w-5 accent-leather"
            />
            {t("useSuggestedCover")}
          </label>
        ) : null}
        <p className="field-hint mt-1">{t("coverFallbackNote")}</p>
      </fieldset>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <SubmitButton
          label={t("createCta")}
          pendingLabel={t("creatingPending")}
        />
        <Link href={cancelHref} className="btn btn--ghost">
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}
