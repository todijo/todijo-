export type SellerHelpRect = { top: number; right: number; bottom: number; left: number };
export type SellerHelpViewport = { top: number; left: number; width: number; height: number };
export type SellerHelpPopoverPosition = { top: number; left: number; maxHeight: number; width: number; placement: "top" | "bottom" };

/** Places a help panel inside the visible viewport, flipping vertically and mirroring its anchor in RTL. */
export function getSellerHelpPopoverPosition({
  anchor,
  panelWidth,
  panelHeight,
  viewport,
  direction,
  topBoundary = viewport.top,
  bottomBoundary = viewport.top + viewport.height,
}: {
  anchor: SellerHelpRect;
  panelWidth: number;
  panelHeight: number;
  viewport: SellerHelpViewport;
  direction: "ltr" | "rtl";
  topBoundary?: number;
  bottomBoundary?: number;
}): SellerHelpPopoverPosition {
  const margin = 12;
  const gap = 8;
  const width = Math.min(panelWidth, Math.max(0, viewport.width - margin * 2));
  const preferredLeft = direction === "rtl" ? anchor.right - width : anchor.left;
  const minLeft = viewport.left + margin;
  const maxLeft = Math.max(minLeft, viewport.left + viewport.width - margin - width);
  const left = Math.min(Math.max(preferredLeft, minLeft), maxLeft);
  const safeTop = Math.min(Math.max(topBoundary, viewport.top), viewport.top + viewport.height);
  const safeBottom = Math.max(Math.min(bottomBoundary, viewport.top + viewport.height), safeTop);
  const availableAbove = Math.max(0, anchor.top - gap - Math.max(safeTop, viewport.top + margin));
  const availableBelow = Math.max(0, Math.min(safeBottom, viewport.top + viewport.height - margin) - anchor.bottom - gap);
  const placement = availableBelow >= panelHeight || availableBelow >= availableAbove ? "bottom" : "top";
  const maxHeight = Math.min(panelHeight, Math.max(0, placement === "bottom" ? availableBelow : availableAbove));
  const height = maxHeight;
  const top = placement === "bottom" ? anchor.bottom + gap : anchor.top - gap - height;

  return { top, left, maxHeight, width, placement };
}
