import{expect,test}from"@playwright/test";

test("shipment tracking card is accessible and contained on narrow RTL mobile",async({page})=>{
 test.setTimeout(90_000);await page.setViewportSize({width:320,height:568});await page.goto("/ar/e2e-ux?view=tracking",{waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("dir","rtl");const card=page.locator(".shipmentTrackingCard");await expect(card).toBeVisible();await expect(card.locator("code")).toContainText("TODIJO-VERY-LONG");await expect(card.getByRole("button")).toHaveAccessibleName(/نسخ/);await expect(card.getByRole("link")).toHaveAttribute("href",/^https:\/\/www\.dhl\.com\//);expect(await page.locator("html").evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
