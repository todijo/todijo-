import type { SupplierCatalogProvider, SupplierProductSnapshot, SupplierVariantSnapshot } from "./types";
import { CjAuthService, cjAuth } from "./cj-auth";
import { logCjFailure } from "./cj-diagnostics";

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
  private nextRequestAt = 0;
  constructor(
    private readonly auth: Pick<CjAuthService, "isConfigured" | "getAccessToken" | "invalidateAccessToken"> = cjAuth,
    private readonly options: { fetcher?:typeof fetch; minimumRequestIntervalMs?:number } = {},
  ) {}
  isConfigured() { return this.auth.isConfigured(); }
  private async throttle() {
    const waitMs = Math.max(0, this.nextRequestAt - Date.now());
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.nextRequestAt = Date.now() + (this.options.minimumRequestIntervalMs ?? 1_050);
  }
  private async get(operation: string, path: string, context: Record<string,string> = {}) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const accessToken = await this.auth.getAccessToken();
      await this.throttle();
      let response: Response;
      try {
        response = await (this.options.fetcher ?? fetch)(`${CJ_BASE_URL}${path}`, { headers:{"CJ-Access-Token":accessToken,"Accept":"application/json"}, signal:AbortSignal.timeout(15000), cache:"no-store" });
      } catch (error) {
        logCjFailure({operation,stage:"product-retrieval",path,responseMessage:error instanceof Error?error.message:"Network request failed",context},[accessToken]);
        throw new Error("CJ_UNAVAILABLE");
      }
      let payload: { code?:number|string; result?:boolean; success?:boolean; message?:string; requestId?:string; data?:unknown };
      try { payload = await response.json() as typeof payload; } catch {
        logCjFailure({operation,stage:"product-retrieval",path,httpStatus:response.status,responseMessage:"CJ returned a non-JSON response",context},[accessToken]);
        throw new Error(response.ok ? "CJ_API_REQUEST_FAILED" : "CJ_UNAVAILABLE");
      }
      const authFailed = response.status === 401 || payload.code === 1600001 || payload.code === 1600002;
      if (authFailed && attempt === 0) { this.auth.invalidateAccessToken(); continue; }
      if (authFailed || !response.ok || payload.result === false || payload.success === false) {
        logCjFailure({operation,stage:"product-retrieval",path,httpStatus:response.status,responseCode:payload.code,responseMessage:payload.message,requestId:payload.requestId,context},[accessToken]);
        if (authFailed) throw new Error("CJ_AUTHENTICATION_FAILED");
        if (payload.code === 1602001 || payload.code === "1602001") throw new Error("CJ_PRODUCT_NOT_FOUND");
        throw new Error(response.status >= 500 ? "CJ_UNAVAILABLE" : "CJ_API_REQUEST_FAILED");
      }
      return payload.data;
    }
    throw new Error("CJ_AUTHENTICATION_FAILED");
  }
  async testConnection() { await this.get("test-connection","/setting/get"); }
  async getProduct(supplierProductId: string) {
    const identifier = supplierProductId.trim();
    if (!/^[A-Za-z0-9-]{4,200}$/.test(identifier)) throw new Error("CJ_PRODUCT_ID_INVALID");
    const isSku = /^CJ[A-Za-z0-9-]+$/i.test(identifier);
    const context = { supplierProductIdentifier:identifier, identifierType:isSku?"productSku":"pid" };
    const query = isSku ? `productSku=${encodeURIComponent(identifier)}` : `pid=${encodeURIComponent(identifier)}`;
    const product = await this.get(isSku?"resolve-product-sku":"get-product-detail",`/product/query?${query}&features=enable_video`,context);
    const canonicalPid = text(object(product).pid ?? object(product).productId);
    if (!canonicalPid) throw new Error("CJ_PRODUCT_NOT_FOUND");
    const canonicalContext = {...context,canonicalPid};
    const variants = await this.get("get-product-variants",`/product/variant/query?pid=${encodeURIComponent(canonicalPid)}`,canonicalContext);
    const inventory = await this.get("get-product-inventory",`/product/stock/getInventoryByPid?pid=${encodeURIComponent(canonicalPid)}`,canonicalContext);
    return normalizeCjProduct(product, variants, inventory);
  }
}
