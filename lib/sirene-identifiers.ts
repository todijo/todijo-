export type SireneIdentifierErrorCode = "SIREN_INVALID_FORMAT" | "SIREN_INVALID_CHECKSUM" | "SIRET_INVALID_FORMAT" | "SIRET_INVALID_CHECKSUM";
export type SireneIdentifierResult = { ok: true; value: string } | { ok: false; code: SireneIdentifierErrorCode };

export function luhnValid(value: string) {
  if (!/^\d+$/.test(value)) return false;
  let sum = 0;
  for (let index = value.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    let digit = Number(value[index]);
    if (position % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
}
function normalize(value: unknown, length: 9 | 14, formatCode: "SIREN_INVALID_FORMAT" | "SIRET_INVALID_FORMAT", checksumCode: "SIREN_INVALID_CHECKSUM" | "SIRET_INVALID_CHECKSUM"): SireneIdentifierResult {
  const normalized = typeof value === "string" ? value.replace(/\s/g, "") : "";
  if (!new RegExp(`^\\d{${length}}$`).test(normalized)) return { ok: false, code: formatCode };
  if (!luhnValid(normalized)) return { ok: false, code: checksumCode };
  return { ok: true, value: normalized };
}

export function normalizeSiren(value: unknown) { return normalize(value, 9, "SIREN_INVALID_FORMAT", "SIREN_INVALID_CHECKSUM"); }
export function normalizeSiret(value: unknown) { return normalize(value, 14, "SIRET_INVALID_FORMAT", "SIRET_INVALID_CHECKSUM"); }
export function sirenForSiret(siret: string) { return siret.slice(0, 9); }
