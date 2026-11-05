import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Open Library covers are the only remote images in v1 (PLAN §5, §7).
    // An S3-compatible public base URL joins this list in M2 with the image store.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
        pathname: "/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
