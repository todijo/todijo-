import "server-only";

const BASE_URL = "https://api.insee.fr/api-sirene/3.11";
const TIMEOUT_MS = 5000;

export type SireneFailure = "NOT_CONFIGURED" | "NOT_FOUND" | "RATE_LIMITED" | "TIMEOUT" | "UPSTREAM_ERROR" | "INVALID_RESPONSE";
export type SireneResult<T> = { ok: true; value: T } | { ok: false; reason: SireneFailure; retryAfterMs?: number };

export type LegalUnit = { siren: string; status: string | null; name: string | null; diffusionRestricted: boolean };
export type Establishment = { siret: string; siren: string | null; status: string | null; name: string | null; address: string | null; postalCode: string | null; city: string | null; diffusionRestricted: boolean };

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function text(value: unknown, max = 240): string | null { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null; }
function addressOf(value: unknown) {
  const a = record(value);
  const parts = [a.numeroVoieEtablissement, a.indiceRepetitionEtablissement, a.typeVoieEtablissement, a.libelleVoieEtablissement, a.complementAdresseEtablissement]
    .map((part) => text(part, 80)).filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" ").slice(0, 240) : null;
}
function retryDelay(value: string | null) {
  if (!value) return 60_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(24 * 60 * 60_000, Math.max(1000, seconds * 1000));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.min(24 * 60 * 60_000, Math.max(1000, date - Date.now())) : 60_000;
}
export class InseeSireneV311 {
  constructor(private readonly apiKey = process.env.INSEE_SIRENE_API_KEY, private readonly fetcher: typeof fetch = fetch) {}

  async lookupLegalUnit(siren: string): Promise<SireneResult<LegalUnit>> {
    const result = await this.get(`/siren/${siren}`);
    if (!result.ok) return result;
    const unit = record(record(result.value).uniteLegale);
    const resolvedSiren = text(unit.siren, 9);
    if (resolvedSiren !== siren) return { ok: false, reason: "INVALID_RESPONSE" };
    const name = text(unit.denominationUniteLegale) ?? text(unit.nomUsageUniteLegale) ?? text(unit.nomUniteLegale);
    const diffusionRestricted = unit.statutDiffusionUniteLegale === "P";
    return { ok: true, value: { siren, status: text(unit.etatAdministratifUniteLegale, 12), name: diffusionRestricted ? null : name, diffusionRestricted } };
  }

  async lookupEstablishment(siret: string): Promise<SireneResult<Establishment>> {
    const result = await this.get(`/siret/${siret}`);
    if (!result.ok) return result;
    const establishment = record(record(result.value).etablissement);
    if (text(establishment.siret, 14) !== siret) return { ok: false, reason: "INVALID_RESPONSE" };
    const unit = record(establishment.uniteLegale);
    const siren = text(establishment.siren, 9) ?? text(unit.siren, 9);
    const restricted = establishment.statutDiffusionEtablissement === "P" || unit.statutDiffusionUniteLegale === "P";
    const addressData = record(establishment.adresseEtablissement);
    const name = text(unit.denominationUniteLegale) ?? text(unit.nomUsageUniteLegale) ?? text(unit.nomUniteLegale);
    return { ok: true, value: {
      siret, siren, status: text(establishment.etatAdministratifEtablissement, 12),
      name: restricted ? null : name, address: restricted ? null : addressOf(addressData),
      postalCode: restricted ? null : text(addressData.codePostalEtablissement, 32),
      city: restricted ? null : text(addressData.libelleCommuneEtablissement, 120), diffusionRestricted: restricted,
    } };
  }

  private async get(path: string): Promise<SireneResult<JsonRecord>> {
    if (!this.apiKey) return { ok: false, reason: "NOT_CONFIGURED" };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.fetcher(`${BASE_URL}${path}`, {
          method: "GET", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { Accept: "application/json", "X-INSEE-Api-Key-Integration": this.apiKey },
        });
        if (response.status === 404) return { ok: false, reason: "NOT_FOUND" };
        if (response.status === 429) return { ok: false, reason: "RATE_LIMITED", retryAfterMs: retryDelay(response.headers.get("retry-after")) };
        if (response.status >= 500) { if (attempt === 0) continue; return { ok: false, reason: "UPSTREAM_ERROR", retryAfterMs: 60_000 }; }
        if (!response.ok) return { ok: false, reason: "UPSTREAM_ERROR" };
        let payload: unknown;
        try { payload = await response.json(); } catch { return { ok: false, reason: "INVALID_RESPONSE" }; }
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, reason: "INVALID_RESPONSE" };
        return { ok: true, value: record(payload) };
      } catch (error) {
        if (attempt === 0) continue;
        return { ok: false, reason: error instanceof Error && error.name === "TimeoutError" ? "TIMEOUT" : "UPSTREAM_ERROR", retryAfterMs: 60_000 };
      }
    }
    return { ok: false, reason: "UPSTREAM_ERROR", retryAfterMs: 60_000 };
  }
}
