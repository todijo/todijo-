import { CjAuthService, cjAuth } from "./cj-auth";
import { logCjFulfillment } from "./cj-diagnostics";

const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function list(value: unknown) { return Array.isArray(value) ? value : []; }

export class CjFulfillmentApiError extends Error {
  constructor(public code: string, public ambiguous: boolean, public retryable: boolean, public safeMessage = code) { super(code); }
}

export type CjCreateOrderInput = {
  fulfillmentId: string;
  externalReference: string;
  originCountry: string;
  destinationCountry: string;
  shippingMethod: string;
  recipient: { name: string; address1: string; address2?: string; city: string; state?: string; postalCode: string; phone?: string };
  products: Array<{ supplierVariantId: string; quantity: number }>;
};

export type CjOrderDetail = {
  supplierOrderId: string | null;
  supplierOrderNumber: string | null;
  status: string;
  tracking: Array<{ supplierShipmentId: string | null; carrier: string | null; trackingNumber: string }>;
};

export class CjFulfillmentClient {
  private nextRequestAt = 0;
  constructor(private readonly auth: Pick<CjAuthService, "getAccessToken" | "invalidateAccessToken"> = cjAuth, private readonly options: { fetcher?: typeof fetch; minimumRequestIntervalMs?: number } = {}) {}

  private async request(operation: string, path: string, fulfillmentId: string, externalReference: string, method: "GET" | "POST", body?: unknown) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await this.auth.getAccessToken();
      const wait = Math.max(0, this.nextRequestAt - Date.now());
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      this.nextRequestAt = Date.now() + (this.options.minimumRequestIntervalMs ?? 1_050);
      let response: Response;
      try {
        response = await (this.options.fetcher ?? fetch)(`${CJ_BASE_URL}${path}`, { method, headers: { "CJ-Access-Token": token, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000), cache: "no-store" });
      } catch {
        logCjFulfillment({ operation, stage: "fulfillment", path, fulfillmentId, externalReference, outcome: "ambiguous_network_failure", responseMessage: "Network request failed" }, [token]);
        throw new CjFulfillmentApiError("CJ_FULFILLMENT_AMBIGUOUS", true, false);
      }
      let payload: { code?: number | string; result?: boolean; success?: boolean; message?: string; requestId?: string; data?: unknown };
      try { payload = await response.json() as typeof payload; } catch {
        logCjFulfillment({ operation, stage: "fulfillment", path, fulfillmentId, externalReference, outcome: "invalid_response", httpStatus: response.status, responseMessage: "Non-JSON response" }, [token]);
        throw new CjFulfillmentApiError("CJ_RESPONSE_INVALID", false, response.status >= 500);
      }
      const authFailed = response.status === 401 || payload.code === 1600001 || payload.code === 1600002;
      if (authFailed && attempt === 0) { this.auth.invalidateAccessToken(); continue; }
      const responseCodeFailed = payload.code !== undefined && String(payload.code) !== "200";
      const failed = authFailed || !response.ok || payload.result === false || payload.success === false || responseCodeFailed;
      if (failed) {
        logCjFulfillment({ operation, stage: "fulfillment", path, fulfillmentId, externalReference, outcome: "rejected", httpStatus: response.status, responseCode: payload.code, responseMessage: payload.message, requestId: payload.requestId }, [token]);
        throw new CjFulfillmentApiError(authFailed ? "CJ_AUTHENTICATION_FAILED" : `CJ_${payload.code ?? response.status}`, false, response.status === 429 || response.status >= 500);
      }
      logCjFulfillment({ operation, stage: "fulfillment", path, fulfillmentId, externalReference, outcome: "success", httpStatus: response.status, responseCode: payload.code, responseMessage: payload.message, requestId: payload.requestId }, [token]);
      return payload.data;
    }
    throw new CjFulfillmentApiError("CJ_AUTHENTICATION_FAILED", false, true);
  }

  async createOrder(input: CjCreateOrderInput): Promise<CjOrderDetail> {
    const data = await this.request("create-order-v2", "/shopping/order/createOrderV2", input.fulfillmentId, input.externalReference, "POST", {
      orderNumber: input.externalReference,
      shippingCountryCode: input.destinationCountry,
      shippingCountry: input.destinationCountry,
      shippingProvince: input.recipient.state || input.recipient.city,
      shippingCity: input.recipient.city,
      shippingCustomerName: input.recipient.name,
      shippingAddress: [input.recipient.address1, input.recipient.address2].filter(Boolean).join(", "),
      shippingZip: input.recipient.postalCode,
      shippingPhone: input.recipient.phone || undefined,
      logisticName: input.shippingMethod,
      fromCountryCode: input.originCountry,
      // CJ documents payType=2 as balance payment. This keeps creation/payment in one
      // provider operation; insufficient balance remains a persisted supplier failure.
      payType: 2,
      products: input.products.map((line) => ({ vid: line.supplierVariantId, quantity: line.quantity })),
    });
    return normalizeOrderDetail(data);
  }

  async getOrderDetail(fulfillmentId: string, externalReference: string) {
    const data = await this.request("get-order-detail", `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(externalReference)}`, fulfillmentId, externalReference, "GET");
    const detail = normalizeOrderDetail(data);
    if (!detail.supplierOrderId) return detail;
    const logistics = await this.request("get-order-logistics", `/shopping/order/getOrderLogisticsInfo?orderCode=${encodeURIComponent(detail.supplierOrderId)}`, fulfillmentId, externalReference, "GET");
    return { ...detail, tracking: normalizeTracking(logistics, detail.tracking) };
  }
}

export function normalizeTracking(value: unknown, fallback: CjOrderDetail["tracking"] = []) {
  const root = object(value); const rows = list(root.data ?? value);
  const unique = new Map<string, CjOrderDetail["tracking"][number]>();
  for (const value of rows) {
    const row = object(value); const trackingNumber = text(row.trackNumber ?? row.trackingNumber);
    if (!trackingNumber) continue;
    unique.set(trackingNumber, { supplierShipmentId: text(row.shipmentOrderId ?? row.orderId) || null, carrier: text(row.trackingProvider ?? row.logisticName) || null, trackingNumber });
  }
  for (const item of fallback) if (!unique.has(item.trackingNumber)) unique.set(item.trackingNumber, item);
  return [...unique.values()];
}

export function normalizeOrderDetail(value: unknown): CjOrderDetail {
  const root = object(value); const detail = object(root.data ?? root);
  const trackingNumber = text(detail.trackNumber); const carrier = text(detail.trackingProvider ?? detail.logisticName);
  return {
    supplierOrderId: text(detail.cjOrderId ?? detail.orderId) || null,
    supplierOrderNumber: text(detail.orderNum ?? detail.orderNumber) || null,
    status: text(detail.orderStatus ?? detail.status) || "UNKNOWN",
    tracking: trackingNumber ? [{ supplierShipmentId: text(detail.shipmentOrderId) || null, carrier: carrier || null, trackingNumber }] : [],
  };
}
