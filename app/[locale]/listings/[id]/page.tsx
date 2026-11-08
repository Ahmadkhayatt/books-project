import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookCover } from "@/components/book-cover";
import { NoticeBanner } from "@/components/notice-banner";
import { SubmitButton } from "@/components/submit-button";
import { cancelListing, reserveListing } from "@/app/[locale]/listings/[id]/actions";
import { auth } from "@/auth";
import { routing } from "@/i18n/routing";
import { getListingById } from "@/lib/listings";
import { displayTitle, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageParams = { locale: string; id: string };
type PageSearchParams = { notice?: string | string[]; error?: string | string[] };

function firstValue(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const listing = await getListingById(id);
  if (!listing) notFound();

  const t = await getTranslations({ locale, namespace: "listing" });

  return {
    title: t("title"),
    description: listing.book.title,
    alternates: {
      languages: {
        ar: `/ar/listings/${id}`,
        en: `/en/listings/${id}`,
        "x-default": `/ar/listings/${id}`,
      },
    },
  };
}

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const query = await searchParams;
  const notice = firstValue(query.notice);
  const error = firstValue(query.error);

  const listing = await getListingById(id);
  if (!listing) notFound();

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const isOwner = viewerId === listing.seller.id;

  const t = await getTranslations("listing");
  const tBook = await getTranslations("book");

  const noticeKind =
    notice === "listingCreated" ||
    notice === "listingUpdated" ||
    notice === "listingCancelled" ||
    notice === "listingReserved"
      ? notice
      : null;

  const title = displayTitle(listing.book, locale);
  const authorLine = listing.book.authors
    .map((entry) => entry.author.name)
    .join(locale === "ar" ? "، " : ", ");

  const typeLabels: Record<string, string> = {
    SELL: t("typeSell"),
    SWAP: t("typeSwap"),
    FREE: t("typeFree"),
  };
  const conditionLabels: Record<string, string> = {
    NEW: t("conditionNew"),
    LIKE_NEW: t("conditionLikeNew"),
    GOOD: t("conditionGood"),
    ACCEPTABLE: t("conditionAcceptable"),
    WORN: t("conditionWorn"),
  };
  const statusLabels: Record<string, string> = {
    ACTIVE: t("statusActive"),
    RESERVED: t("statusReserved"),
    COMPLETED: t("statusCompleted"),
    CANCELLED: t("statusCancelled"),
  };

  const statusChipClass = (status: string) => {
    switch (status) {
      case "RESERVED":
        return "chip chip--gild";
      case "COMPLETED":
        return "chip chip--ink";
      case "CANCELLED":
        return "chip chip--stamp";
      case "ACTIVE":
      default:
        return "chip chip--cloth";
    }
  };

  const priceLabel =
    listing.priceCents === null
      ? null
      : formatPrice(locale, listing.priceCents, listing.currency);

  const sellerName =
    listing.seller.profile?.displayName ??
    listing.seller.name ??
    listing.seller.username;
  const detailHref = `/${locale}/listings/${listing.id}`;

  const cancelAction = (
    <form action={cancelListing}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="listingId" value={listing.id} />
      <SubmitButton
        label={t("cancelListing")}
        className="btn--danger"
        confirmMessage={t("delistConfirm")}
      />
    </form>
  );

  const reserveAction = isOwner || viewerId === null || listing.status !== "ACTIVE" ? null : (
    <form action={reserveListing}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="listingId" value={listing.id} />
      <SubmitButton label={t("reserve")} />
    </form>
  );

  return (
    <div className="container-page py-10 md:py-14">
      <div className="max-w-2xl">
        <Link href={`/${locale}/listings`} className="btn btn--ghost btn--sm">
          {t("backToListings")}
        </Link>
      </div>

      {error ? (
        <div className="mt-6 max-w-2xl">
          <NoticeBanner kind="error" code={error} dismissHref={detailHref} />
        </div>
      ) : noticeKind ? (
        <div className="mt-6 max-w-2xl">
          <NoticeBanner kind={noticeKind} dismissHref={detailHref} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-8 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-4 lg:col-span-3">
          <div className="cover-mat mx-auto w-full max-w-xs md:sticky md:top-24">
            <BookCover
              coverUrl={listing.book.coverUrl}
              title={title}
              authorLine={authorLine || undefined}
              alt={title}
              sizes="(min-width: 1024px) 300px, (min-width: 768px) 30vw, 70vw"
              seed={listing.book.isbn13 ?? listing.book.id}
              priority
            />
          </div>
        </div>

        <div className="md:col-span-8 lg:col-span-9">
          <span className={statusChipClass(listing.status)}>
            {statusLabels[listing.status] ?? t("statusActive")}
          </span>

          <p className="section-label mt-4">{t("title")}</p>
          <h1 className="mt-3 text-3xl">{title}</h1>
          {authorLine ? (
            <p className="mt-3 text-lg text-ink-soft" dir="auto">
              {authorLine}
            </p>
          ) : null}

          <div className="mt-6">
            <p className="text-sm text-ink-soft">{typeLabels[listing.type]}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {t("condition")}:{" "}
              {conditionLabels[listing.condition] ?? listing.condition}
            </p>
            {priceLabel ? (
              <p className="mt-2 text-lg" dir="auto">
                {priceLabel}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-ink-soft">
              {t("seller")}: <bdi dir="auto">{sellerName}</bdi>
            </p>
            <Link
              href={`/${locale}/books/${listing.book.id}`}
              className="text-link mt-2 inline-block text-sm"
            >
              {tBook("backToCatalog")} — {title}
            </Link>
          </div>

          {listing.description ? (
            <section aria-labelledby="listing-description-heading" className="mt-10">
              <h2 id="listing-description-heading" className="section-label">
                {t("description")}
              </h2>
              <p className="ar-prose mt-3 max-w-2xl whitespace-pre-line leading-relaxed text-ink-soft">
                {listing.description}
              </p>
            </section>
          ) : null}

          {listing.location ? (
            <section aria-labelledby="listing-location-heading" className="mt-8">
              <h2 id="listing-location-heading" className="section-label">
                {t("location")}
              </h2>
              <p className="mt-2 text-ink-soft" dir="auto">
                {listing.location}
              </p>
            </section>
          ) : null}

          {listing.meetupOptions ? (
            <section aria-labelledby="listing-meetup-heading" className="mt-8">
              <h2 id="listing-meetup-heading" className="section-label">
                {t("meetup")}
              </h2>
              <p className="mt-2 text-ink-soft" dir="auto">
                {listing.meetupOptions}
              </p>
            </section>
          ) : null}

          {listing.images.length > 0 ? (
            <section aria-labelledby="listing-images-heading" className="mt-10">
              <h2 id="listing-images-heading" className="section-label">
                {t("photos")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {listing.images.map((imageUrl) => (
                  <div
                    key={imageUrl}
                    className="relative aspect-[2/3] overflow-hidden rounded-[3px] border border-rule bg-paper-raised"
                  >
                    <Image
                      src={imageUrl}
                      alt={title}
                      fill
                      sizes="(min-width: 640px) 40vw, 90vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isOwner ? (
              <>
                {listing.status === "ACTIVE" ? (
                  <Link
                    href={`/${locale}/listings/${listing.id}/edit`}
                    className="btn btn--secondary"
                  >
                    {t("editListing")}
                  </Link>
                ) : null}
                {cancelAction}
              </>
            ) : reserveAction ? (
              reserveAction
            ) : (
              <Link
                href={`/${locale}/sign-in?callbackUrl=${encodeURIComponent(
                  `/${locale}/listings/${listing.id}`,
                )}`}
                className="btn btn--ghost"
              >
                {t("signInToReserve")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
