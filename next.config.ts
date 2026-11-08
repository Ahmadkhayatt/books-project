import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const s3PublicBaseUrl = process.env.S3_PUBLIC_BASE_URL ?? "";
let s3RemotePattern: { protocol: "https"; hostname: string; pathname: string } | null = null;
try {
  if (s3PublicBaseUrl) {
    const parsed = new URL(s3PublicBaseUrl);
    if (parsed.protocol === "https:") {
      s3RemotePattern = {
        protocol: "https",
        hostname: parsed.hostname,
        pathname: "/**",
      };
    }
  }
} catch {
  s3RemotePattern = null;
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Open Library covers + the S3 public base are the only remote image
    // hosts in v1 (PLAN §5, §7). Local `/uploads/*` needs no remote config.
    // Never `images.domains` (deprecated) — remotePatterns only.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
        pathname: "/**",
      },
      ...(s3RemotePattern ? [s3RemotePattern] : []),
    ],
  },
};

export default withNextIntl(nextConfig);
