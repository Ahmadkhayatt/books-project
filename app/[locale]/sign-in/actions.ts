"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/auth";
import { RATE_LIMITS, checkRateLimit, getClientIp } from "@/lib/rate-limit";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

function localeFrom(formData: FormData): "ar" | "en" {
  return formData.get("locale") === "en" ? "en" : "ar";
}

export async function signInWithCredentials(
  _previousState: unknown,
  formData: FormData,
) {
  const locale = localeFrom(formData);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const parsed = signInSchema.safeParse({ email, password });
  if (!parsed.success) {
    redirect(`/${locale}/sign-in?error=invalidCredentials`);
  }

  const ipLimit = await checkRateLimit(
    `signin:ip:${await getClientIp()}`,
    RATE_LIMITS.signinIp,
  );
  if (!ipLimit.ok) {
    redirect(`/${locale}/sign-in?error=rateLimited`);
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: `/${locale}`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Same message for an unknown email and a wrong password.
      redirect(`/${locale}/sign-in?error=invalidCredentials`);
    }
    throw error;
  }
}
