"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getSellerHelpPopoverPosition, type SellerHelpPopoverPosition, type SellerHelpViewport } from "./seller-help-popover-position";

function getViewport(): SellerHelpViewport {
  const visual = window.visualViewport;
  return visual
    ? { top: visual.offsetTop, left: visual.offsetLeft, width: visual.width, height: visual.height }
    : { top: 0, left: 0, width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight };
}

function findStickyBoundaries(left: number, width: number, viewport: SellerHelpViewport, panel: HTMLElement) {
  const points = [left + 8, left + width / 2, left + width - 8];
  let top = viewport.top;
  let bottom = viewport.top + viewport.height;

  for (const x of points) {
    for (const y of [viewport.top + 2, viewport.top + viewport.height - 2]) {
      for (const element of document.elementsFromPoint(x, y)) {
        if (panel.contains(element) || element === document.body || element === document.documentElement) continue;
        for (let candidate: HTMLElement | null = element as HTMLElement; candidate && candidate !== document.body; candidate = candidate.parentElement) {
          const position = window.getComputedStyle(candidate).position;
          if (position !== "fixed" && position !== "sticky") continue;
          const rect = candidate.getBoundingClientRect();
          if (y < viewport.top + viewport.height / 2 && rect.bottom > top) top = rect.bottom;
          if (y >= viewport.top + viewport.height / 2 && rect.top < bottom) bottom = rect.top;
          break;
        }
      }
    }
  }
  return { top, bottom };
}

export default function SellerHelpPopover({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<SellerHelpPopoverPosition | null>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !root.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
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

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const anchor = button.current;
    const popover = panel.current;
    if (!anchor || !popover) return;

    let frame = 0;
    const update = () => {
      const viewport = getViewport();
      const anchorRect = anchor.getBoundingClientRect();
      const panelRect = popover.getBoundingClientRect();
      const initial = getSellerHelpPopoverPosition({
        anchor: anchorRect,
        panelWidth: panelRect.width,
        panelHeight: popover.scrollHeight,
        viewport,
        direction: window.getComputedStyle(anchor).direction === "rtl" ? "rtl" : "ltr",
      });
      const sticky = findStickyBoundaries(initial.left, initial.width, viewport, popover);
      const next = getSellerHelpPopoverPosition({
        anchor: anchorRect,
        panelWidth: panelRect.width,
        panelHeight: popover.scrollHeight,
        viewport,
        direction: window.getComputedStyle(anchor).direction === "rtl" ? "rtl" : "ltr",
        topBoundary: sticky.top,
        bottomBoundary: sticky.bottom,
      });
      setPosition(next);
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);
    observer?.observe(anchor);
    observer?.observe(popover);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
      observer?.disconnect();
    };
  }, [open, children]);

  const panelStyle: CSSProperties = {
    position: "fixed",
    inset: "auto",
    boxSizing: "border-box",
    left: position?.left,
    top: position?.top,
    width: position?.width,
    maxHeight: position?.maxHeight,
    visibility: position ? "visible" : "hidden",
  };
  const panelDirection = button.current && typeof window !== "undefined"
    ? window.getComputedStyle(button.current).direction
    : undefined;

  return <>
    <span className="sellerHelpPopoverRoot" ref={root}>
      <button ref={button} className="sellerHelpButton" type="button" aria-label={label}
        aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        <span aria-hidden="true">!</span>
      </button>
    </span>
    {open && typeof document !== "undefined" ? createPortal(
      <span ref={panel} className="sellerHelpPopover" id={id} role="note" dir={panelDirection} style={panelStyle}>{children}</span>,
      document.body,
    ) : null}
  </>;
}
