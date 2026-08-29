const obviousPlaceholder = /^(?:test|testing|demo|sample|dummy|placeholder|asdf|qwerty|foo|bar)[\s._-]*\d*$/iu;
const repeatedGarbage = /^(.)\1{2,}$/u;

export type CatalogContentIssue = "PLACEHOLDER_NAME" | "GARBAGE_NAME";

export function catalogNameIssue(value: string): CatalogContentIssue | null {
  const name = value.normalize("NFKC").trim();
  if (obviousPlaceholder.test(name)) return "PLACEHOLDER_NAME";
  const compact = name.replace(/[\p{Z}\p{P}\p{S}_]+/gu, "");
  if (compact.length < 2 || repeatedGarbage.test(compact)) return "GARBAGE_NAME";
  return null;
}

export function assertCatalogNameQuality(value: string) {
  const issue = catalogNameIssue(value);
  if (issue) throw new CatalogContentQualityError(issue);
}

export class CatalogContentQualityError extends Error {
  constructor(public readonly code: CatalogContentIssue) { super(code); }
}
