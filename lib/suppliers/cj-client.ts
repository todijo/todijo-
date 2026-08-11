import type { SupplierCatalogProvider, SupplierProductSnapshot, SupplierVariantSnapshot } from "./types";
import { CjAuthService, cjAuth } from "./cj-auth";

const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function list(value: unknown) { return Array.isArray(value) ? value : []; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }

export function normalizeCjProduct(productValue: unknown, variantValue: unknown, inventoryValue: unknown): SupplierProductSnapshot {
  const product = object(productValue);
  const variantsRaw = list(object(variantValue).list ?? variantValue);
  const inventoryRoot = object(inventoryValue);
  const variantInventories = list(object(inventoryRoot.data ?? inventoryRoot).variantInventories);
  const inventoryByVariant = new Map(variantInventories.map((entry) => {
    const row = object(entry); const total = list(row.inventory).reduce((sum, item) => sum + Math.max(0, number(object(item).totalInventory) ?? 0), 0);
    return [text(row.vid), total] as const;
  }));
  const variants: SupplierVariantSnapshot[] = variantsRaw.slice(0, 200).map((entry, index) => {
    const row = object(entry); const id = text(row.vid ?? row.variantId); const stock = inventoryByVariant.get(id) ?? Math.max(0, number(row.variantInventory ?? row.stock) ?? 0);
    return { supplierVariantId:id, sku:text(row.variantSku ?? row.sku) || null, title:text(row.variantNameEn ?? row.variantName ?? row.variantKey) || `Variant ${index + 1}`, cost:number(row.variantSellPrice ?? row.sellPrice), currency:"USD", stock, available:Boolean(id) && stock > 0 };
  }).filter((variant) => variant.supplierVariantId);
  const imageUrls = [...new Set([text(product.bigImage), ...list(product.productImageSet).map(text)].filter(Boolean))].slice(0, 15);
  const videoUrl = text(product.productVideo ?? product.videoUrl);
  const stock = variants.length ? variants.reduce((sum, variant) => sum + variant.stock, 0) : Math.max(0, number(product.inventory) ?? 0);
  const productId = text(product.pid ?? product.productId);
  return {
    provider:"CJ", supplierProductId:productId, sku:text(product.productSku) || null,
    title:text(product.productNameEn ?? product.productName) || "Imported CJ product",
    description:text(product.description) || "Supplier product pending seller review.",
    categoryReference:text(product.categoryId) || null,
    sourceUrl:productId ? `https://cjdropshipping.com/product-${encodeURIComponent(productId)}.html` : null,
    cost:number(product.sellPrice ?? product.productPrice), currency:"USD", stock,
    available:text(product.saleStatus) !== "0" && (variants.length ? variants.some((variant) => variant.available) : stock > 0),
    weightGrams:number(product.productWeight), variants,
    media:[...imageUrls.map((url) => ({type:"IMAGE" as const,url})), ...(videoUrl ? [{type:"VIDEO" as const,url:videoUrl}] : [])],
    rawMetadata:{ categoryId:product.categoryId ?? null, productType:product.productType ?? null, deliveryCycle:product.deliveryCycle ?? null },
  };
}

export class CjCatalogProvider implements SupplierCatalogProvider {
  readonly id = "CJ" as const;
  constructor(private readonly auth: Pick<CjAuthService, "isConfigured" | "getAccessToken" | "invalidateAccessToken"> = cjAuth) {}
  isConfigured() { return this.auth.isConfigured(); }
  private async get(path: string) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const accessToken = await this.auth.getAccessToken();
      let response: Response;
      try {
        response = await fetch(`${CJ_BASE_URL}${path}`, { headers:{"CJ-Access-Token":accessToken,"Accept":"application/json"}, signal:AbortSignal.timeout(15000), cache:"no-store" });
      } catch { throw new Error("CJ_UNAVAILABLE"); }
      let payload: { code?:number; result?:boolean; success?:boolean; data?:unknown };
      try { payload = await response.json() as typeof payload; } catch { throw new Error(response.ok ? "CJ_API_REQUEST_FAILED" : "CJ_UNAVAILABLE"); }
      const authFailed = response.status === 401 || payload.code === 1600001 || payload.code === 1600002;
      if (authFailed && attempt === 0) { this.auth.invalidateAccessToken(); continue; }
      if (authFailed) throw new Error("CJ_AUTHENTICATION_FAILED");
      if (!response.ok) throw new Error(response.status >= 500 ? "CJ_UNAVAILABLE" : "CJ_API_REQUEST_FAILED");
      if (payload.result === false || payload.success === false) throw new Error("CJ_API_REQUEST_FAILED");
      return payload.data;
    }
    throw new Error("CJ_AUTHENTICATION_FAILED");
  }
  async testConnection() { await this.get("/setting/get"); }
  async getProduct(supplierProductId: string) {
    const pid = supplierProductId.trim();
    if (!/^[A-Za-z0-9-]{4,200}$/.test(pid)) throw new Error("CJ_PRODUCT_ID_INVALID");
    const [product, variants, inventory] = await Promise.all([
      this.get(`/product/query?pid=${encodeURIComponent(pid)}&features=enable_video,enable_description`),
      this.get(`/product/variant/query?pid=${encodeURIComponent(pid)}`),
      this.get(`/product/stock/getInventoryByPid?pid=${encodeURIComponent(pid)}`),
    ]);
    return normalizeCjProduct(product, variants, inventory);
  }
}
