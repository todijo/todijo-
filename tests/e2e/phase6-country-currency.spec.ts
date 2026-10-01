import {expect,test,type Page} from "@playwright/test";
test.setTimeout(90_000);

async function initialize(page:Page,options:{geo?:unknown;session?:unknown;locale?:string;storage?:Record<string,string>;cookies?:Record<string,string>;geoFailure?:"http"|"network"|"timeout"}={}){
 await page.route("**/api/auth/session",route=>route.fulfill({json:options.session??{authenticated:false}}));
 await page.route("**/api/geo/country",route=>{
  if(options.geoFailure==="network")return route.abort();
  if(options.geoFailure==="http")return route.fulfill({status:503,json:{error:"unavailable"}});
  if(options.geoFailure==="timeout")return;
  return route.fulfill({json:options.geo??{country:"US"}});
 });
 if(options.storage)await page.addInitScript(values=>{for(const [key,value] of Object.entries(values))localStorage.setItem(key,value);},options.storage);
 if(options.cookies)await page.context().addCookies(Object.entries(options.cookies).map(([name,value])=>({name,value,url:process.env.PLAYWRIGHT_BASE_URL??"http://localhost:3100"})));
 await page.goto(`/${options.locale??"en"}/e2e-ux?view=home`,{waitUntil:"domcontentloaded"});
 const trigger=page.locator(".marketHeader .buyerMarketTrigger");
 await expect(trigger).toBeEnabled({timeout:15_000});
 return trigger;
}

for(const [country,name,currency] of [["FR","France","EUR"],["DE","Germany","EUR"],["US","États-Unis","USD"],["GB","United Kingdom","GBP"]]){
 test(`fresh ${country} visitor gets ${currency} from geo rather than locale`,async({page})=>{
  const trigger=await initialize(page,{geo:{country},locale:country==="US"?"fr":"en"});
  await expect(trigger).toContainText(name);
  await expect(trigger).toContainText(currency);
 });
}

for(const geoFailure of ["http","network","timeout"] as const){
 test(`${geoFailure} geo failure uses France/EUR`,async({page})=>{
  const trigger=await initialize(page,{geoFailure});
  await expect(trigger).toContainText("France");
  await expect(trigger).toContainText("EUR");
 });
}

test("invalid geo uses France/EUR",async({page})=>{
 const trigger=await initialize(page,{geo:{country:"XX"}});
 await expect(trigger).toContainText("France");await expect(trigger).toContainText("EUR");
});

test("account profile country wins over cookie country and geo; cookie currency remains independent",async({page})=>{
 const trigger=await initialize(page,{session:{authenticated:true,userId:"buyer-a",profileCountry:"DE"},cookies:{"todijo-shopping-country-v1":"GB","todijo-buyer-currency-v1":"CHF"}});
 await expect(trigger).toContainText("Germany");await expect(trigger).toContainText("CHF");
});

test("explicit account-scoped preferences win over profile, cookies and geo",async({page})=>{
 const trigger=await initialize(page,{session:{authenticated:true,userId:"buyer-a",profileCountry:"FR"},storage:{"todijo-shopping-country-v1:user%3Abuyer-a":"GB","todijo-buyer-currency-v1:user%3Abuyer-a":"GBP"},cookies:{"todijo-shopping-country-v1":"DE","todijo-buyer-currency-v1":"CHF"}});
 await expect(trigger).toContainText("United Kingdom");await expect(trigger).toContainText("GBP");
});

test("legacy country and scoped currency preferences are restored independently",async({page})=>{
 const trigger=await initialize(page,{geo:{country:"FR"},storage:{"todijo-shopping-country-v1":"US","todijo-buyer-currency-v1:guest":"GBP"}});
 await expect(trigger).toContainText("United States");await expect(trigger).toContainText("GBP");
});

test("cookie-only preference wins over geo and does not leak to another account",async({page})=>{
 const trigger=await initialize(page,{cookies:{"todijo-shopping-country-v1":"GB","todijo-buyer-currency-v1":"CHF","todijo-buyer-market-scope-v1":"guest"}});
 await expect(trigger).toContainText("United Kingdom");await expect(trigger).toContainText("CHF");
 await page.route("**/api/auth/session",route=>route.fulfill({json:{authenticated:true,userId:"buyer-b"}}));
 await page.reload({waitUntil:"domcontentloaded"});await expect(trigger).toBeEnabled();
 await expect(trigger).toContainText("United States");await expect(trigger).toContainText("USD");
});

test("country and currency changes survive reload and later geo changes independently",async({page})=>{
 const trigger=await initialize(page);
 await trigger.click();
 await page.locator(".buyerMarketOptions button").filter({hasText:"Germany"}).click();
 await expect(trigger).toContainText("Germany");await expect(trigger).toContainText("EUR");
 await trigger.click();
 await page.getByLabel("Display currency").selectOption("GBP");
 await page.locator(".buyerMarketOptions button").filter({hasText:"United States"}).click();
 await expect(trigger).toContainText("United States");await expect(trigger).toContainText("GBP");
 await page.route("**/api/geo/country",route=>route.fulfill({json:{country:"FR"}}));
 await page.reload({waitUntil:"domcontentloaded"});await expect(trigger).toBeEnabled();
 await expect(trigger).toContainText("United States");await expect(trigger).toContainText("GBP");
});

test("country and currency preferences persist independently from locale and fit RTL mobile",async({page})=>{
  test.setTimeout(90_000);
  await page.route("**/api/auth/session",route=>route.fulfill({json:{authenticated:false}}));
  await page.route("**/api/geo/country",route=>route.fulfill({json:{country:"FR"}}));
  await page.goto("/en/e2e-ux?view=home",{waitUntil:"domcontentloaded"});
  const trigger=page.locator(".marketHeader .buyerMarketTrigger");
  await expect(trigger).toContainText("France");
  await expect(trigger).toContainText("EUR");
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
