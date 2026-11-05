"use client";

import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export function SignOutButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <form action={signOutAction} className="contents">
      <button type="submit" className={cn("nav-link", className)}>
        {label}
      </button>
    </form>
  );
}
