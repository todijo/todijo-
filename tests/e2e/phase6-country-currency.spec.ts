import {expect,test} from "@playwright/test";

test("country and currency preferences persist independently from locale and fit RTL mobile",async({page})=>{
  test.setTimeout(90_000);
  await page.route("**/api/auth/session",route=>route.fulfill({json:{authenticated:false}}));
  await page.route("**/api/geo/country",route=>route.fulfill({json:{country:"FR"}}));
  await page.goto("/en/e2e-ux?view=home",{waitUntil:"domcontentloaded"});
  const trigger=page.locator(".marketHeader .buyerMarketTrigger");
  await expect(trigger).toContainText("FR");
  await trigger.click();
  const dialog=page.getByRole("dialog",{name:"Shopping preferences"});
  await dialog.getByLabel("Display currency").selectOption("GBP");
  await expect(trigger).toContainText("GBP");
  await page.goto("/fr/e2e-ux?view=home",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".marketHeader .buyerMarketTrigger")).toContainText("GBP");

  await page.setViewportSize({width:320,height:568});
  await page.goto("/ar/e2e-ux?view=home",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).toHaveAttribute("dir","rtl");
  await expect(page.locator(".marketHeader")).not.toHaveCSS("overflow-x","scroll");
  expect(await page.locator("html").evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
