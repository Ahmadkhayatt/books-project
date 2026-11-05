import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";

import authConfig from "./auth.config";
import { routing } from "./i18n/routing";

// Next 16 replaces middleware.ts with proxy.ts (Node.js runtime).
// Only the edge-safe auth config is imported here — never Prisma/bcrypt.
const intlMiddleware = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

export default auth((request) => intlMiddleware(request));

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
