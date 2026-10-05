import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { SignJWT } from "jose";
import sharp from "sharp";

const baseURL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3120";
const outputDir = resolve(process.env.SCREENSHOT_OUTPUT_DIR ?? "responsive-screenshots");
const baseHost = new URL(baseURL).hostname;
if (!new Set(["localhost", "127.0.0.1", "::1"]).has(baseHost)) {
  throw new Error("Responsive screenshot capture is restricted to loopback hosts.");
}
const viewports = [
  { name: "desktop-1440", width: 1440, height: 1000 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-narrow-320", width: 320, height: 568 },
];

// Supply a JSON array [{name, path, expectedText?, scrollTo?}] via
// SCREENSHOT_ROUTES. Each viewport gets a new context/page; captures are
// viewport-sized page screenshots, never OS-level screen captures.
const routes = JSON.parse(process.env.SCREENSHOT_ROUTES ?? "[]");
if (!Array.isArray(routes) || routes.some((route) => !route.name || !route.path)) {
  throw new Error("SCREENSHOT_ROUTES must be a JSON array of {name, path} entries.");
}
if (routes.length === 0) throw new Error("No screenshot routes supplied.");
const sessionSecret = process.env.SCREENSHOT_SESSION_SECRET ?? "e2e-only-placeholder-secret-at-least-32-characters";
if (sessionSecret.length < 32) throw new Error("SCREENSHOT_SESSION_SECRET must contain at least 32 characters.");

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const manifest = [];
const failures = [];
try {
  for (const route of routes) {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        // Keep CSS viewport values exact. Mobile emulation can scale/round the
        // layout viewport (for example 390 CSS px becoming window.innerWidth 396).
        isMobile: false,
        hasTouch: viewport.width <= 768,
        ...(route.storageState ? { storageState: route.storageState } : {}),
      });
      try {
        const page = await context.newPage();
        if (route.sessionUserId) {
          if (!["CUSTOMER", "SELLER", "ADMIN"].includes(route.sessionRole)) {
            throw new Error(`${route.name}: authenticated route requires sessionRole CUSTOMER, SELLER, or ADMIN.`);
          }
          const token = await new SignJWT({ userId: route.sessionUserId, role: route.sessionRole, authVersion: 0 })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(new TextEncoder().encode(sessionSecret));
          await context.addCookies([{ name: "todijo_session", value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
        }
        const url = new URL(route.path, baseURL).toString();
        const response = await page.goto(url, { waitUntil: "load", timeout: 60_000 });
        if (!response?.ok()) throw new Error(`${route.name}: ${url} returned ${response?.status() ?? "no response"}`);
        await page.evaluate(() => document.fonts?.ready);
        await page.waitForTimeout(400);
        if (route.sessionUserId && new URL(page.url()).pathname !== new URL(url).pathname) {
          throw new Error(`${route.name}: authenticated route redirected to ${page.url()}`);
        }
        const visibleText = await page.locator("body").innerText();
        const frameworkOverlay = await page.evaluate(() => document.querySelector("nextjs-portal")?.shadowRoot?.textContent ?? "");
        if (/MISSING_MESSAGE|Unhandled Runtime Error|Application error: a server-side exception occurred|Impossible de charger cette page/i.test(`${visibleText}\n${frameworkOverlay}`)) {
          throw new Error(`${route.name}: application rendered a runtime/server error instead of the requested screen.`);
        }
        if (route.expectedText && !visibleText.toLocaleLowerCase().includes(route.expectedText.toLocaleLowerCase())) {
          throw new Error(`${route.name}: expected page marker not found (${route.expectedText}).`);
        }
        if (route.scrollTo) {
          const target = page.locator(route.scrollTo).first();
          if (route.scrollOffset !== undefined) {
            await target.evaluate((element, offset) => {
              const rect = element.getBoundingClientRect();
              window.scrollTo(0, window.scrollY + rect.top - offset);
            }, route.scrollOffset);
          } else {
            await target.scrollIntoViewIfNeeded();
          }
        }
        try {
          await page.locator(".cookieReject").click({ timeout: 2_500 });
        } catch {
          // No banner, or no visible reject action; this context is disposable.
        }

        const browserMetrics = await page.evaluate(() => ({
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
        }));
        const pageViewport = page.viewportSize();
        const expected = { width: viewport.width, height: viewport.height };
        if (browserMetrics.innerWidth !== viewport.width || browserMetrics.innerHeight !== viewport.height) {
          throw new Error(`${route.name}/${viewport.name}: window metrics mismatch ${JSON.stringify(browserMetrics)}`);
        }
        if (!pageViewport || pageViewport.width !== viewport.width || pageViewport.height !== viewport.height) {
          throw new Error(`${route.name}/${viewport.name}: Playwright viewport mismatch ${JSON.stringify(pageViewport)}`);
        }

        const file = join(outputDir, `${route.name}-${viewport.name}.png`);
        await page.screenshot({ path: file, animations: "disabled" });
        const image = await sharp(file).metadata();
        const expectedPixels = {
          width: Math.round(viewport.width * browserMetrics.devicePixelRatio),
          height: Math.round(viewport.height * browserMetrics.devicePixelRatio),
        };
        if (image.width !== expectedPixels.width || image.height !== expectedPixels.height) {
          throw new Error(`${route.name}/${viewport.name}: image ${image.width}x${image.height}, expected viewport raster ${expectedPixels.width}x${expectedPixels.height}`);
        }
        manifest.push({
          name: route.name,
          url,
          file,
          cssViewport: expected,
          browserMetrics,
          playwrightViewport: pageViewport,
          savedImagePixels: { width: image.width, height: image.height },
        });
      } catch (error) {
        const failure = { name: route.name, path: route.path, viewport, error: error instanceof Error ? error.message : String(error) };
        failures.push(failure);
        console.error(`FAILED ${route.name}/${viewport.name}: ${failure.error}`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

const manifestPath = join(outputDir, "manifest.json");
let existing = { captures: [], failures: [] };
try {
  existing = JSON.parse(await readFile(manifestPath, "utf8"));
} catch {
  // First run in an empty output directory.
}
const captureKey = (item) => `${item.name}|${item.cssViewport?.width ?? item.viewport?.width}x${item.cssViewport?.height ?? item.viewport?.height}`;
const capturesByKey = new Map(existing.captures.map((item) => [captureKey(item), item]));
const failuresByKey = new Map(existing.failures.map((item) => [captureKey(item), item]));
for (const item of manifest) {
  const key = captureKey(item);
  capturesByKey.set(key, item);
  failuresByKey.delete(key);
}
for (const item of failures) failuresByKey.set(captureKey(item), item);
const finalManifest = { captures: [...capturesByKey.values()], failures: [...failuresByKey.values()] };
await writeFile(manifestPath, `${JSON.stringify(finalManifest, null, 2)}\n`, "utf8");
console.log(`Captured ${manifest.length} page screenshots; ${failures.length} failures. Manifest: ${manifestPath}`);
for (const item of manifest) {
  console.log(`${item.name} ${item.cssViewport.width}x${item.cssViewport.height} CSS, DPR ${item.browserMetrics.devicePixelRatio}, ${item.savedImagePixels.width}x${item.savedImagePixels.height}px: ${item.file}`);
}
if (failures.length) process.exitCode = 1;
