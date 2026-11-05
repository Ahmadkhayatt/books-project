"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { CloseIcon, MenuIcon } from "@/components/icons";

type MobileNavProps = {
  label: string;
  closeLabel: string;
  children: ReactNode;
};

export function MobileNav({ label, closeLabel, children }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        className="icon-button relative"
        aria-expanded={open}
        aria-controls="site-nav-panel"
        aria-label={open ? closeLabel : label}
        onClick={() => setOpen((value) => !value)}
      >
        <MenuIcon
          className={
            open
              ? "absolute opacity-0 transition-opacity duration-150"
              : "opacity-100 transition-opacity duration-150"
          }
        />
        <CloseIcon
          className={
            open
              ? "opacity-100 transition-opacity duration-150"
              : "absolute opacity-0 transition-opacity duration-150"
          }
        />
      </button>

      <div
        id="site-nav-panel"
        hidden={!open}
        className="mobile-panel"
      >
        {children}
      </div>
    </div>
  );
}
