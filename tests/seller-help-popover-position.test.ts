import assert from "node:assert/strict";
import test from "node:test";
import { getSellerHelpPopoverPosition } from "../components/seller-help-popover-position";

const viewport = { top: 0, left: 0, width: 400, height: 700 };

test("popover clamps to the right viewport edge", () => {
  const result = getSellerHelpPopoverPosition({
    anchor: { top: 120, right: 390, bottom: 142, left: 368 },
    panelWidth: 360,
    panelHeight: 180,
    viewport,
    direction: "ltr",
  });

  assert.equal(result.left, 28);
  assert.ok(result.left + result.width <= viewport.width - 12);
});

test("popover mirrors its anchor in RTL and clamps at the left edge", () => {
  const result = getSellerHelpPopoverPosition({
    anchor: { top: 120, right: 32, bottom: 142, left: 10 },
    panelWidth: 360,
    panelHeight: 180,
    viewport,
    direction: "rtl",
  });

  assert.equal(result.left, 12);
  assert.ok(result.left >= 12);
});

test("popover opens above when the lower viewport space is insufficient", () => {
  const result = getSellerHelpPopoverPosition({
    anchor: { top: 590, right: 160, bottom: 612, left: 138 },
    panelWidth: 300,
    panelHeight: 220,
    viewport,
    direction: "ltr",
  });

  assert.equal(result.placement, "top");
  assert.equal(result.top + result.maxHeight, 582);
  assert.ok(result.top >= 12);
});

test("popover uses available space below a sticky header and remains scrollable", () => {
  const result = getSellerHelpPopoverPosition({
    anchor: { top: 96, right: 240, bottom: 118, left: 218 },
    panelWidth: 320,
    panelHeight: 500,
    viewport: { ...viewport, height: 450 },
    direction: "ltr",
    topBoundary: 72,
  });

  assert.equal(result.placement, "bottom");
  assert.ok(result.maxHeight < 500);
  assert.ok(result.top >= 126);
  assert.ok(result.top + result.maxHeight <= 450 - 12);
});

test("popover fits a narrow mobile viewport", () => {
  const mobileViewport = { top: 0, left: 0, width: 320, height: 568 };
  const result = getSellerHelpPopoverPosition({
    anchor: { top: 260, right: 310, bottom: 282, left: 288 },
    panelWidth: 360,
    panelHeight: 400,
    viewport: mobileViewport,
    direction: "ltr",
  });

  assert.equal(result.width, 296);
  assert.ok(result.left >= 12);
  assert.ok(result.left + result.width <= 308);
  assert.ok(result.top >= 12);
  assert.ok(result.top + result.maxHeight <= mobileViewport.height - 12);
});
