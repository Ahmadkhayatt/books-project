import type { NextAuthConfig } from "next-auth";

// Proxy/edge-safe half of the Auth.js config: no Prisma, no bcrypt.
// The full config (adapter + providers) lives in auth.ts.
const authConfig = {
  pages: { signIn: "/sign-in" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    authorized() {
      // M0 has no protected pages yet; M5 hardens role-gated areas.
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

export default authConfig;
