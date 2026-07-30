function rfc5987Encode(value: string) { return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`); }

export function refundEvidenceContentDisposition(filename: string) {
  const ascii = filename.normalize("NFKC").replace(/[\r\n"\\]/g, "_").replace(/[^\x20-\x7e]/g, "_").trim().slice(0, 180) || "evidence";
  return `inline; filename="${ascii}"; filename*=UTF-8''${rfc5987Encode(filename)}`;
}
