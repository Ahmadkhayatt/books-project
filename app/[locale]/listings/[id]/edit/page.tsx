import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { updateListing } from "@/app/[locale]/listings/[id]/actions";
import { auth } from "@/auth";
import { NoticeBanner } from "@/components/notice-banner";
import { SubmitButton } from "@/components/submit-button";
import { routing } from "@/i18n/routing";
import { getListingById } from "@/lib/listings";
import { displayTitle, formatIndex } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageParams = { locale: string; id: string };
type PageSearchParams = { error?: string | string[] };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function defaultCurrency(): string {
  const raw = process.env.DEFAULT_CURRENCY?.trim().toUpperCase();
  return raw && /^[A-Z]{3,8}$/.test(raw) ? raw : "EGP";
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
    title: t("editListing"),
    description: listing.book.title,
    alternates: {
      languages: {
        ar: `/ar/listings/${id}/edit`,
        en: `/en/listings/${id}/edit`,
        "x-default": `/ar/listings/${id}/edit`,
      },
    },
  };
}

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const query = await searchParams;
  const errorCode = firstValue(query.error) ?? null;

  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const t = await getTranslations("listing");
  const tAuth = await getTranslations("auth");

  const listingHref = `/${locale}/listings/${id}`;
  const listingsHref = `/${locale}/listings`;
  const signInHref = `/${locale}/sign-in?callbackUrl=${encodeURIComponent(listingHref)}`;

  const listing = await getListingById(id);
  if (!listing) notFound();

  let content: ReactNode;

  if (viewerId === null) {
    content = (
      <section
        aria-labelledby="gate-heading"
        className="form-card mt-8 max-w-xl"
      >
        <p className="section-label">{t("gateTitle")}</p>
        <h2 id="gate-heading" className="mt-2 text-2xl">
          {t("gateTitle")}
        </h2>
        <p className="ar-prose mt-2 text-ink-soft">{t("gateBody")}</p>
        <Link href={signInHref} className="btn btn--primary mt-5">
          {tAuth("signInTitle")}
        </Link>
      </section>
    );
  } else if (listing.seller.id !== viewerId) {
    notFound();
  } else if (listing.status !== "ACTIVE") {
    redirect(listingHref);
  } else {
    const priceMajor =
      listing.priceCents == null
        ? ""
        : String(Math.trunc(listing.priceCents / 100));
    content = (
      <section aria-labelledby="listing-form-heading" className="mt-8 max-w-2xl">
        <h2 id="listing-form-heading" className="text-2xl">
          {t("editListing")}
        </h2>
        <p className="ar-prose mt-1 text-sm text-ink-soft">
          {t("bookLabel")}: {displayTitle(listing.book, locale)}
        </p>

        {errorCode ? (
          <div className="mt-4">
            <NoticeBanner
              kind="error"
              code={errorCode}
              dismissHref={listingHref}
            />
          </div>
        ) : null}

        <div className="mt-4">
          <form action={updateListing} className="form-card">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="listingId" value={listing.id} />
            <input type="hidden" name="bookId" value={listing.book.id} />
            <input type="hidden" name="currency" value={defaultCurrency()} />

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="type" className="text-sm text-ink-soft">
                  {t("type")}
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={listing.type}
                  className="field mt-2"
                >
                  <option value="SELL">{t("typeSell")}</option>
                  <option value="SWAP">{t("typeSwap")}</option>
                  <option value="FREE">{t("typeFree")}</option>
                </select>
              </div>

              <div>
                <label htmlFor="condition" className="text-sm text-ink-soft">
                  {t("condition")}
                </label>
                <select
                  id="condition"
                  name="condition"
                  defaultValue={listing.condition}
                  className="field mt-2"
                >
                  <option value="NEW">{t("conditionNew")}</option>
                  <option value="LIKE_NEW">{t("conditionLikeNew")}</option>
                  <option value="GOOD">{t("conditionGood")}</option>
                  <option value="ACCEPTABLE">{t("conditionAcceptable")}</option>
                  <option value="WORN">{t("conditionWorn")}</option>
                </select>
              </div>

              <div>
                <label htmlFor="priceCents" className="text-sm text-ink-soft">
                  {t("priceLabel")}
                </label>
                <input
                  id="priceCents"
                  name="priceCents"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  defaultValue={priceMajor}
                  className="field mt-2"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="description" className="text-sm text-ink-soft">
                {t("description")}
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                maxLength={2000}
                defaultValue={listing.description ?? ""}
                className="field mt-2"
                dir="auto"
              />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="location" className="text-sm text-ink-soft">
                  {t("location")}
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  maxLength={200}
                  defaultValue={listing.location ?? ""}
                  className="field mt-2"
                  dir="auto"
                />
              </div>

              <div>
                <label
                  htmlFor="meetupOptions"
                  className="text-sm text-ink-soft"
                >
                  {t("meetup")}
                </label>
                <input
                  id="meetupOptions"
                  name="meetupOptions"
                  type="text"
                  maxLength={500}
                  defaultValue={listing.meetupOptions ?? ""}
                  className="field mt-2"
                  dir="auto"
                />
              </div>
            </div>

            {listing.images.length > 0 ? (
              <div className="mt-5">
                <p className="text-sm text-ink-soft">{t("photos")}</p>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  {listing.images.map((imageUrl) => (
                    <div
                      key={imageUrl}
                      className="relative aspect-[2/3] overflow-hidden rounded-[3px] border border-rule bg-paper-raised"
                    >
                      <Image
                        src={imageUrl}
                        alt=""
                        fill
                        sizes="(min-width: 640px) 30vw, 80vw"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <label htmlFor="images" className="text-sm text-ink-soft">
                {t("photos")}
              </label>
              <input
                id="images"
                name="images"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="field mt-2"
              />
              <p className="field-hint mt-1">{t("imagesHint", { max: 6 })}</p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <SubmitButton
                label={t("updateCta")}
                pendingLabel={t("updatingPending")}
              />
              <Link href={listingHref} className="btn btn--ghost">
                {t("cancel")}
              </Link>
            </div>
          </form>
        </div>
      </section>
    );
  }

  return (
    <div className="container-page py-10 md:py-14">
      <header className="max-w-2xl">
        <p className="section-label">
          <span className="section-label__index" dir="ltr">
            {formatIndex(locale, 3)}
          </span>
          <span aria-hidden="true">—</span>
          <span>{t("title")}</span>
        </p>
        <h1 className="mt-3 text-3xl">{t("editListing")}</h1>
        <div className="mt-2">
          <Link href={listingsHref} className="text-link text-sm">
            {t("backToListings")}
          </Link>
        </div>
      </header>

      <div className="rule-double mt-8" aria-hidden="true" />

      {content}
    </div>
  );
}
