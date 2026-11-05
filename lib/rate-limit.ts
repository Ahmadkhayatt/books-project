import "server-only";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

// Sliding-window rate limit in Postgres (PLAN.md §12). No Redis in v1.
// Keys are scoped strings, e.g. `signin:email:<email>`, `msg:send:<userId>`.
export type RateLimitOptions = {
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfter: number };

export const RATE_LIMITS = {
  signinIp: { limit: 5, windowSeconds: 300 },
  signinEmail: { limit: 5, windowSeconds: 300 },
  signupIp: { limit: 5, windowSeconds: 3600 },
  msgSend: { limit: 30, windowSeconds: 60 },
  reportCreate: { limit: 10, windowSeconds: 3600 },
  listingCreate: { limit: 20, windowSeconds: 86400 },
  reviewCreate: { limit: 30, windowSeconds: 86400 },
  isbnLookup: { limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitOptions>;

const PRUNE_EVERY = 50;
const PRUNE_AGE_MS = 48 * 60 * 60 * 1000;

let calls = 0;

/**
 * Count events inside the window; insert one only when under the limit.
 * The 1-in-50 opportunistic prune deletes stale rows for the same key only.
 */
export async function checkRateLimit(
  key: string,
  { limit, windowSeconds }: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  calls += 1;
  if (calls % PRUNE_EVERY === 0) {
    await prisma.rateLimitEvent.deleteMany({
      where: { key, createdAt: { lt: new Date(now.getTime() - PRUNE_AGE_MS) } },
    });
  }

  const count = await prisma.rateLimitEvent.count({
    where: { key, createdAt: { gt: windowStart } },
  });

  if (count >= limit) {
    const oldest = await prisma.rateLimitEvent.findFirst({
      where: { key, createdAt: { gt: windowStart } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const retryAfter = oldest
      ? Math.max(
          1,
          Math.ceil(
            (oldest.createdAt.getTime() + windowSeconds * 1000 - now.getTime()) / 1000,
          ),
        )
      : windowSeconds;
    return { ok: false, retryAfter };
  }

  await prisma.rateLimitEvent.create({ data: { key } });
  return { ok: true, remaining: limit - count - 1 };
}

/** Best-effort client IP for sign-in/sign-up throttle keys. */
export async function getClientIp(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
