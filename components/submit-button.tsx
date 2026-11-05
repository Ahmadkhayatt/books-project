"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  className?: string;
  confirmMessage?: string;
};

/**
 * The one client-side submit affordance: disables itself while the enclosing
 * server action is pending (double-submit safety) and optionally asks for
 * native confirmation before destructive posts.
 */
export function SubmitButton({
  label,
  pendingLabel,
  className = "btn--primary",
  confirmMessage,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending || undefined}
      className={cn("btn", className)}
      onClick={
        confirmMessage
          ? (event) => {
              if (!window.confirm(confirmMessage)) {
                event.preventDefault();
              }
            }
          : undefined
      }
    >
      {pending ? (pendingLabel ?? label) : label}
    </button>
  );
}
