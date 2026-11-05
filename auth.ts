import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";

import authConfig from "@/auth.config";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS, checkRateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const googleId = process.env.AUTH_GOOGLE_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();

        const limit = await checkRateLimit(
          `signin:email:${email}`,
          RATE_LIMITS.signinEmail,
        );
        if (!limit.ok) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          // Deliberate, single override of the global passwordHash omission.
          omit: { passwordHash: false },
        });
        if (!user?.passwordHash) return null;
        if (user.status !== "ACTIVE") return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
    // Both-or-none: a half-configured Google app is never registered.
    ...(googleId && googleSecret
      ? [Google({ clientId: googleId, clientSecret: googleSecret })]
      : []),
  ],
  callbacks: {
    authorized: authConfig.callbacks.authorized,
    async jwt({ token, user, trigger }) {
      if (trigger === "signIn" && user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id ?? "";
      session.user.role = token.role ?? "MEMBER";
      return session;
    },
  },
});
