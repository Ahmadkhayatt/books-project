import Link from "next/link";

import { BookCover } from "@/components/book-cover";
import type { CatalogBook } from "@/lib/books";
import { displayTitle, formatYear } from "@/lib/utils";

type CatalogCardProps = {
  book: CatalogBook;
  locale: string;
  coverAlt: string;
  headingLevel?: 2 | 3;
  priority?: boolean;
};

export function CatalogCard({
  book,
  locale,
  coverAlt,
  headingLevel = 2,
  priority = false,
}: CatalogCardProps) {
  const title = displayTitle(book, locale);
  const authorLine = book.authors
    .map((entry) => entry.author.name)
    .join(locale === "ar" ? "، " : ", ");
  const href = `/${locale}/books/${book.id}`;
  const TitleTag = headingLevel === 2 ? "h2" : "h3";

  return (
    <article className="catalog-card">
      <BookCover
        coverUrl={book.coverUrl}
        title={title}
        authorLine={authorLine || undefined}
        publisher={book.publisher}
        alt={coverAlt}
        sizes="(min-width: 1024px) 190px, (min-width: 640px) 26vw, 44vw"
        seed={book.isbn13 ?? book.id}
        priority={priority}
      />

      <div className="catalog-card__body">
        <TitleTag className="catalog-card__title">
          <Link href={href} className="catalog-card__link">
            {title}
          </Link>
        </TitleTag>

        {authorLine ? (
          <p className="catalog-card__author" dir="auto">
            {authorLine}
          </p>
        ) : null}

        <div className="catalog-card__footer">
          <span>{book.publishedYear ? formatYear(locale, book.publishedYear) : "—"}</span>
        </div>
      </div>
    </article>
  );
}
