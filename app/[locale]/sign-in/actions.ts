"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/auth";
import { sanitizeCallbackUrl } from "@/lib/callback-url";
import { RATE_LIMITS, checkRateLimit, getClientIp } from "@/lib/rate-limit";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

function localeFrom(formData: FormData): "ar" | "en" {
  return formData.get("locale") === "en" ? "en" : "ar";
}

function callbackFrom(formData: FormData, locale: "ar" | "en"): string {
  return sanitizeCallbackUrl(formData.get("callbackUrl"), `/${locale}`);
}

export async function signInWithCredentials(
  _previousState: unknown,
  formData: FormData,
) {
  const locale = localeFrom(formData);
  const callbackUrl = callbackFrom(formData, locale);
  const errorHref = (code: string) =>
    `/${locale}/sign-in?error=${code}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const parsed = signInSchema.safeParse({ email, password });
  if (!parsed.success) {
    redirect(errorHref("invalidCredentials"));
  }

  const ipLimit = await checkRateLimit(
    `signin:ip:${await getClientIp()}`,
    RATE_LIMITS.signinIp,
  );
  if (!ipLimit.ok) {
    redirect(errorHref("rateLimited"));
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Same message for an unknown email and a wrong password.
      redirect(errorHref("invalidCredentials"));
    }
    throw error;
  }
}
