import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("authenticated buyer navigation exposes the localized Notifications route", () => {
  const dashboard = read("app/dashboard/page.tsx");
  const account = read("app/account/AccountSettings.tsx");
  assert.match(dashboard, /label: p\("notifications"\), href: `\/\$\{locale\}\/notifications`/);
  assert.match(account, /href=\{`\/\$\{locale\}\/notifications`\}/);
  assert.match(account, /dashboard\("notifications"\)/);
});

test("mobile Notifications navigation is authenticated, localized and preserves existing actions", () => {
  const mobile = read("components/BuyerMobileNavigation.tsx");
  assert.match(mobile, /localizedPath\(locale, "\/notifications"\)/);
  assert.match(mobile, /accountName \? <a href=\{notificationsHref\}/);
  assert.match(mobile, /dashboard\("notifications"\)/);
  assert.doesNotMatch(mobile, /href=\{"?\/fr\/notifications/);
  for (const existing of ["ordersHref", "messagesHref", "favoritesHref", "accountHref", "cartHref"]) assert.match(mobile, new RegExp(existing));
});

test("all supported locales provide a non-empty Notifications label", () => {
  const files = fs.readdirSync("messages/dashboard-premium").filter((file) => file.endsWith(".json"));
  assert.equal(files.length, 14);
  for (const file of files) {
    const messages = JSON.parse(read(`messages/dashboard-premium/${file}`));
    assert.equal(typeof messages.notifications, "string", file);
    assert.ok(messages.notifications.trim(), file);
  }
  assert.equal(JSON.parse(read("messages/dashboard-premium/fr.json")).notifications, "Notifications");
  assert.equal(JSON.parse(read("messages/dashboard-premium/en.json")).notifications, "Notifications");
  assert.equal(JSON.parse(read("messages/dashboard-premium/ar.json")).notifications, "الإشعارات");
});

test("the Notifications route retains its unauthenticated redirect and private query ownership", () => {
  const page = read("app/notifications/page.tsx");
  assert.match(page, /if\(!session\) redirect\(`\/\$\{locale\}\/login\?next=\/\$\{locale\}\/notifications`\)/);
  assert.match(page, /userId:session\.userId/);
});

test("account and mobile links have semantic, focused, RTL-safe contained presentation", () => {
  const account = read("app/account/AccountSettings.tsx");
  const css = read("app/globals.css");
  assert.match(account, /<nav className="accountSettingsNavigation"/);
  assert.match(account, /<Link href=/);
  assert.match(css, /\.accountSettingsNavigation a:focus-visible/);
  assert.match(css, /max-width:100%/);
  assert.match(css, /@media\(max-width:600px\)[^{]*\{[\s\S]*?\.accountSettingsNavigation a\{width:100%/);
  assert.match(css, /html\[dir="rtl"\] \.buyerMobileDrawer nav a\.active/);
});
