"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export default function SellerHelpPopover({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <span className="sellerHelpPopoverRoot" ref={root}>
    <button ref={button} className="sellerHelpButton" type="button" aria-label={label}
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span aria-hidden="true">!</span>
    </button>
    <span className="sellerHelpPopover" id={id} role="note" hidden={!open}>{children}</span>
  </span>;
}
