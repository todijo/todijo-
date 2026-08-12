const BLOCKED = /<(script|style|iframe|object|embed|form|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const TAGS = /<[^>]*>/g;
const OPAQUE_SUPPLIER_CODE = /\b[A-Z]{1,5}\d{5,}(?:-?[A-Z0-9]+)*\b/g;

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
    if (key[0] === "#") { const code = Number.parseInt(key[1].toLowerCase() === "x" ? key.slice(2) : key.slice(1), key[1].toLowerCase() === "x" ? 16 : 10); return Number.isSafeInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ""; }
    return named[key.toLowerCase()] ?? "";
  });
}

export function buyerSafeProductDescription(value: string, supplierManaged: boolean) {
  if (!supplierManaged) return value.split(/\r?\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const text = decodeEntities(value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(BLOCKED, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/(?:p|div|section|article|h[1-6]|ul|ol|li)>/gi, "\n")
    .replace(TAGS, ""))
    .replace(OPAQUE_SUPPLIER_CODE, "")
    .replace(/^\s*(?:color|sku|spu)\s*:\s*[,/;\s-]*$/gim, "")
    .replace(/[ \t]+([,;])/g, "$1")
    .replace(/(?:[,;]\s*){2,}/g, ", ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.split(/\n{2,}|(?=^• )/m).map((part) => part.trim()).filter(Boolean);
}
