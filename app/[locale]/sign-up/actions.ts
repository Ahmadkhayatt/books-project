"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS, checkRateLimit, getClientIp } from "@/lib/rate-limit";

const USERNAME_PATTERN = /^[a-z0-9_]+$/;

const signUpSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  username: z.string().trim().min(3).max(24).regex(USERNAME_PATTERN),
  email: z.email(),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Za-z]/)
    .regex(/[0-9]/),
});

function localeFrom(formData: FormData): "ar" | "en" {
  return formData.get("locale") === "en" ? "en" : "ar";
}

function isUniqueConstraintError(
  error: unknown,
): error is { code: "P2002" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function signUp(_previousState: unknown, formData: FormData) {
  const locale = localeFrom(formData);
  const displayName = String(formData.get("displayName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const parsed = signUpSchema.safeParse({
    displayName,
    username,
    email,
    password,
  });

  if (!parsed.success) {
    const weakPassword = parsed.error.issues.some(
      (issue) => issue.path[0] === "password",
    );
    redirect(
      `/${locale}/sign-up?error=${weakPassword ? "passwordWeak" : "generic"}`,
    );
  }

  const ipLimit = await checkRateLimit(
    `signup:ip:${await getClientIp()}`,
    RATE_LIMITS.signupIp,
  );
  if (!ipLimit.ok) {
    redirect(`/${locale}/sign-up?error=rateLimited`);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: parsed.data.email,
          username: parsed.data.username,
          name: parsed.data.displayName,
          passwordHash,
        },
        select: { id: true },
      });

      await tx.profile.create({
        data: {
          userId: user.id,
          displayName: parsed.data.displayName,
          locale,
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: parsed.data.email },
        select: { id: true },
      });
      redirect(
        `/${locale}/sign-up?error=${existingEmail ? "emailTaken" : "usernameTaken"}`,
      );
    }
    redirect(`/${locale}/sign-up?error=generic`);
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: `/${locale}`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/${locale}/sign-in?error=generic`);
    }
    throw error;
  }
}
