import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("footer renders one canonical seller plans entry with unique sibling href keys", () => {
  const footer = readFileSync("components/MarketplaceFooter.tsx", "utf8");
  assert.equal((footer.match(/href: `\/\$\{locale\}\/sell#plans`/g) ?? []).length, 1);
  assert.match(footer, /group\.links\.map\(\(link\) => <a key=\{link\.href\}/);
  assert.doesNotMatch(footer, /createStore[^\n]+sell#plans/);
});
