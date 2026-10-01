import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {createElement, type ComponentType} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
import ts from "typescript";
import {isLocale,locales} from "../i18n/config";
import {trackingUi} from "../i18n/tracking-ui";
import {newsMessages} from "../i18n/news";
import {OPEN_COOKIE_PREFERENCES_EVENT} from "../lib/privacy-consent";

// Render the real footer with locale hooks supplied by the test. Each list is
// checked separately: desktop and accordion versions intentionally coexist.
function footerMarkup(locale:string){
  const routeModule:{exports:{default?:ComponentType}}={exports:{}};
  const dependencies:Record<string,unknown>={
    "react/jsx-runtime":jsxRuntime,
    "next-intl":{useLocale:()=>locale,useTranslations:(namespace:string)=>(key:string)=>`${namespace}.${key}`},
    "lucide-react":icons,
    "./LanguageSwitcher":{__esModule:true,default:()=>null},
    "./TodijoLogo":{__esModule:true,default:({href}:{href:string})=>createElement("a",{href},"Todijo")},
    "@/lib/privacy-consent":{OPEN_COOKIE_PREFERENCES_EVENT},
    "@/i18n/tracking-ui":{trackingUi},
    "@/i18n/config":{isLocale},
    "@/i18n/news":{newsMessages},
  };
  const code=ts.transpileModule(readFileSync("components/MarketplaceFooter.tsx","utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
  }).outputText;
  new Function("require","module","exports",code)((name:string)=>{
    assert.ok(Object.hasOwn(dependencies,name),`Unexpected footer dependency: ${name}`);
    return dependencies[name];
  },routeModule,routeModule.exports);
  assert.ok(routeModule.exports.default);
  return renderToStaticMarkup(createElement(routeModule.exports.default));
}

for(const locale of locales){
  test(`${locale} footer has one localized seller-plan entry per navigation list`,()=>{
    const markup=footerMarkup(locale);
    const lists=Array.from(markup.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/g));
    const sellerLists=lists.filter(([nav])=>nav.includes('aria-label="HomeFooter.sellTitle"'));
    assert.equal(sellerLists.length,2,"desktop and mobile footer lists remain present");
    for(const [,contents] of lists){
      const hrefs=Array.from(contents.matchAll(/href="([^"]+)"/g),match=>match[1]);
      assert.equal(new Set(hrefs).size,hrefs.length,"sibling links must have unique destination keys");
      for(const href of hrefs)assert.ok(href.startsWith(`/${locale}/`),`locale preserved: ${href}`);
    }
    for(const [,contents] of sellerLists){
      assert.equal(Array.from(contents.matchAll(new RegExp(`href="/${locale}/sell#plans"`,"g"))).length,1);
      assert.ok(contents.includes("HomeFooter.becomeSeller"));
      assert.ok(contents.includes(`href="/${locale}/dashboard"`));
      assert.ok(contents.includes(`href="/${locale}/info/seller-guide"`));
      assert.ok(!contents.includes("HomeFooter.createStore"));
    }
  });
}
