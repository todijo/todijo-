import "server-only";
import { inflateRawSync } from "node:zlib";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

export const SELLER_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const SELLER_IMPORT_MAX_REQUEST_BYTES = 6 * 1024 * 1024;
export const SELLER_IMPORT_MAX_ROWS = 100;
export type SellerImportRows = { headers: string[]; rows: Array<Record<string, string>> };

export class SellerImportParseError extends Error {
  constructor(public readonly code: "IMPORT_FILE_TOO_LARGE" | "IMPORT_REQUEST_TOO_LARGE" | "IMPORT_FORMAT_UNSUPPORTED" | "IMPORT_FILE_INVALID" | "IMPORT_EMPTY" | "IMPORT_TOO_MANY_ROWS") { super(code); }
}

type ImportMultipartFileInfo = { filename: string; mimeType: string };
type ImportMultipartFile = Readable & { truncated?: boolean };
type ImportMultipartParser = {
  on(event: "file", listener: (name: string, stream: ImportMultipartFile, info: ImportMultipartFileInfo) => void): ImportMultipartParser;
  on(event: "field", listener: (name: string, value: string) => void): ImportMultipartParser;
  on(event: "filesLimit" | "fieldsLimit" | "partsLimit" | "error" | "finish", listener: (error?: Error) => void): ImportMultipartParser;
};
type ImportMultipartFactory = (options: { headers: Record<string,string>; limits: { files:number; fields:number; parts:number; fileSize:number; fieldSize:number; fieldNameSize:number } }) => ImportMultipartParser;
const createBusboy = createRequire(__filename)("busboy") as ImportMultipartFactory;

export async function parseSellerProductImportMultipart(body: Buffer, contentType: string): Promise<{storeId:string; filename:string; bytes:Buffer}> {
  if (body.length > SELLER_IMPORT_MAX_REQUEST_BYTES) throw new SellerImportParseError("IMPORT_REQUEST_TOO_LARGE");
  if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new SellerImportParseError("IMPORT_FILE_INVALID");
  return new Promise((resolve, reject) => {
    let settled = false;
    let storeId: string | null = null;
    let filename: string | null = null;
    let fileEnded = false;
    let fileSize = 0;
    let partsSeen = 0;
    const chunks: Buffer[] = [];
    let parser: ImportMultipartParser;
    const fail = (code: SellerImportParseError["code"]) => {
      if (settled) return;
      settled = true;
      input.unpipe(parser as never);
      input.destroy();
      reject(new SellerImportParseError(code));
    };
    const input = Readable.from([body]);
    try { parser = createBusboy({ headers: { "content-type": contentType }, limits: { files:1, fields:1, parts:3, fileSize:SELLER_IMPORT_MAX_FILE_BYTES, fieldSize:200, fieldNameSize:40 } }); }
    catch { reject(new SellerImportParseError("IMPORT_FILE_INVALID")); return; }
    parser.on("field", (name, value) => {
      if (++partsSeen > 2) { fail("IMPORT_FILE_INVALID"); return; }
      if (name !== "storeId" || storeId !== null || !value.trim()) { fail("IMPORT_FILE_INVALID"); return; }
      storeId = value.trim();
    });
    parser.on("file", (name, file, info) => {
      if (++partsSeen > 2) { file.resume(); fail("IMPORT_FILE_INVALID"); return; }
      if (name !== "file" || filename !== null || !info.filename) { file.resume(); fail("IMPORT_FILE_INVALID"); return; }
      filename = info.filename;
      file.on("data", (chunk: Buffer) => {
        fileSize += chunk.length;
        if (fileSize > SELLER_IMPORT_MAX_FILE_BYTES) { fail("IMPORT_FILE_TOO_LARGE"); return; }
        chunks.push(chunk);
      });
      file.on("limit", () => fail("IMPORT_FILE_TOO_LARGE"));
      file.on("error", () => fail("IMPORT_FILE_INVALID"));
      file.on("end", () => { if (!settled && !file.truncated) fileEnded = true; });
    });
    parser.on("filesLimit", () => fail("IMPORT_FILE_INVALID"));
    parser.on("fieldsLimit", () => fail("IMPORT_FILE_INVALID"));
    parser.on("partsLimit", () => fail("IMPORT_FILE_INVALID"));
    parser.on("error", () => fail("IMPORT_FILE_INVALID"));
    parser.on("finish", () => {
      if (settled) return;
      if (!storeId || !filename || !fileEnded || fileSize === 0) { fail("IMPORT_FILE_INVALID"); return; }
      settled = true;
      resolve({ storeId, filename, bytes:Buffer.concat(chunks, fileSize) });
    });
    input.on("error", () => fail("IMPORT_FILE_INVALID"));
    input.pipe(parser as never);
  });
}

export async function readBoundedSellerImportBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > SELLER_IMPORT_MAX_REQUEST_BYTES) throw new SellerImportParseError("IMPORT_REQUEST_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > SELLER_IMPORT_MAX_REQUEST_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new SellerImportParseError("IMPORT_REQUEST_TOO_LARGE");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

function boundedHeaders(values: string[]) {
  if (values.length > 60) throw new SellerImportParseError("IMPORT_FILE_INVALID");
  const counts = new Map<string, number>();
  return values.map((value, index) => {
    const base = (value.trim() || `column_${index + 1}`).slice(0, 100);
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

function boundedCell(value: string) {
  return value.slice(0, 12_000);
}

function xmlDecode(value: string) {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function csvRows(source: string): string[][] {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const separator = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) { if (char === '"' && source[i + 1] === '"') { field += '"'; i++; } else if (char === '"') quoted = false; else field += char; }
    else if (char === '"' && field.length === 0) quoted = true;
    else if (char === separator) { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") { if (char === "\r" && source[i + 1] === "\n") i++; row.push(field); field = ""; if (row.some(value => value.trim())) rows.push(row); row = []; }
    else field += char;
    if (rows.length > SELLER_IMPORT_MAX_ROWS + 1) throw new SellerImportParseError("IMPORT_TOO_MANY_ROWS");
  }
  if (quoted) throw new SellerImportParseError("IMPORT_FILE_INVALID");
  row.push(field); if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function columnIndex(reference: string) { let value = 0; for (const char of reference.replace(/\d/g, "")) value = value * 26 + char.toUpperCase().charCodeAt(0) - 64; return value - 1; }

function unzipXlsx(bytes: Buffer) {
  let end = -1; for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) { if (bytes.readUInt32LE(offset) === 0x06054b50) { end = offset; break; } }
  if (end < 0) throw new SellerImportParseError("IMPORT_FILE_INVALID");
  const count = bytes.readUInt16LE(end + 10), centralOffset = bytes.readUInt32LE(end + 16), centralSize = bytes.readUInt32LE(end + 12);
  if (!count || count > 128 || centralOffset + centralSize > end || centralOffset >= bytes.length) throw new SellerImportParseError("IMPORT_FILE_INVALID");
  const entries = new Map<string, string>(); let offset = centralOffset, expandedTotal = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > bytes.length || offset + 46 > centralOffset + centralSize || bytes.readUInt32LE(offset) !== 0x02014b50) throw new SellerImportParseError("IMPORT_FILE_INVALID");
    const method = bytes.readUInt16LE(offset + 10), compressedSize = bytes.readUInt32LE(offset + 20), expandedSize = bytes.readUInt32LE(offset + 24), nameLength = bytes.readUInt16LE(offset + 28), extraLength = bytes.readUInt16LE(offset + 30), commentLength = bytes.readUInt16LE(offset + 32), localOffset = bytes.readUInt32LE(offset + 42);
    if (offset + 46 + nameLength + extraLength + commentLength > centralOffset + centralSize || localOffset + 30 > bytes.length || method !== 0 && method !== 8) throw new SellerImportParseError("IMPORT_FILE_INVALID");
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (name.includes("..") || name.startsWith("/") || expandedSize > 12 * 1024 * 1024 || compressedSize > bytes.length) throw new SellerImportParseError("IMPORT_FILE_INVALID");
    expandedTotal += expandedSize; if (expandedTotal > 24 * 1024 * 1024) throw new SellerImportParseError("IMPORT_FILE_INVALID");
    if (name.toLowerCase().includes("vbaproject") || name.toLowerCase().includes("externallinks")) throw new SellerImportParseError("IMPORT_FORMAT_UNSUPPORTED");
    if (name.endsWith(".xml") || name.endsWith(".rels")) {
      if (bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new SellerImportParseError("IMPORT_FILE_INVALID");
      const nameSize = bytes.readUInt16LE(localOffset + 26), extraSize = bytes.readUInt16LE(localOffset + 28), start = localOffset + 30 + nameSize + extraSize, compressedEnd = start + compressedSize;
      if (start > bytes.length || compressedEnd > bytes.length) throw new SellerImportParseError("IMPORT_FILE_INVALID");
      const compressed = bytes.subarray(start, compressedEnd);
      let content: Buffer; if (method === 0) content = Buffer.from(compressed); else if (method === 8) { try { content = inflateRawSync(compressed, { maxOutputLength: 12 * 1024 * 1024 }); } catch { throw new SellerImportParseError("IMPORT_FILE_INVALID"); } } else throw new SellerImportParseError("IMPORT_FORMAT_UNSUPPORTED");
      if (content.length !== expandedSize) throw new SellerImportParseError("IMPORT_FILE_INVALID");
      const text = content.toString("utf8"); if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new SellerImportParseError("IMPORT_FILE_INVALID"); entries.set(name, text);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function xlsxRows(bytes: Buffer): string[][] {
  if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) throw new SellerImportParseError("IMPORT_FILE_INVALID");
  const files = unzipXlsx(bytes), shared = [...(files.get("xl/sharedStrings.xml") ?? "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(part => xmlDecode(part[1])).join(""));
  const sheetPath = [...files.keys()].find(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)); const sheet = sheetPath ? files.get(sheetPath) : null;
  if (!sheet || /<!DOCTYPE|<!ENTITY/i.test(sheet)) throw new SellerImportParseError("IMPORT_FILE_INVALID");
  const rowMatches = [...sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)];
  if (rowMatches.length > SELLER_IMPORT_MAX_ROWS + 1) throw new SellerImportParseError("IMPORT_TOO_MANY_ROWS");
  return rowMatches.map(rowMatch => {
    const values: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1], body = cellMatch[2], ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1], index = ref ? columnIndex(ref) : values.length, type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(match => match[1]).join("");
      if (index < 0 || index >= 60) throw new SellerImportParseError("IMPORT_FILE_INVALID");
      values[index] = boundedCell(xmlDecode(type === "s" ? shared[Number(raw)] ?? "" : raw));
    }
    return values;
  });
}

function objectRows(values: unknown[]): SellerImportRows {
  if (!values.length || !values[0] || typeof values[0] !== "object" || Array.isArray(values[0])) throw new SellerImportParseError("IMPORT_EMPTY");
  if (values.length > SELLER_IMPORT_MAX_ROWS) throw new SellerImportParseError("IMPORT_TOO_MANY_ROWS");
  const headers = boundedHeaders(Object.keys(values[0] as Record<string, unknown>));
  const originalHeaders = Object.keys(values[0] as Record<string, unknown>);
  const rows = values.map(value => Object.fromEntries(headers.map((header, index) => {
    const cell = (value as Record<string, unknown>)[originalHeaders[index]];
    let text: string;
    try { text = typeof cell === "string" ? cell : cell == null ? "" : JSON.stringify(cell); }
    catch { throw new SellerImportParseError("IMPORT_FILE_INVALID"); }
    return [header, boundedCell(text)];
  })));
  return { headers, rows };
}

export function parseSellerProductImport(filename: string, bytes: Buffer): SellerImportRows {
  if (bytes.length > SELLER_IMPORT_MAX_FILE_BYTES) throw new SellerImportParseError("IMPORT_FILE_TOO_LARGE");
  const ext = filename.toLowerCase().split(".").pop(); let rows: string[][];
  try {
    if (ext === "csv") rows = csvRows(bytes.toString("utf8").replace(/^\uFEFF/, ""));
    else if (ext === "xlsx") rows = xlsxRows(bytes);
    else if (ext === "json") { const value = JSON.parse(bytes.toString("utf8")); const list = Array.isArray(value) ? value : value && Array.isArray(value.products) ? value.products : null; if (!list) throw new SellerImportParseError("IMPORT_FILE_INVALID"); return objectRows(list); }
    else if (ext === "xml") {
      const xml = bytes.toString("utf8"); if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new SellerImportParseError("IMPORT_FILE_INVALID");
      const products = [...xml.matchAll(/<product\b[^>]*>([\s\S]*?)<\/product>/gi)];
      if (products.length > SELLER_IMPORT_MAX_ROWS) throw new SellerImportParseError("IMPORT_TOO_MANY_ROWS");
      const values = products.map(product => Object.fromEntries([...product[1].matchAll(/<([A-Za-z_][\w:.-]*)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(field => [field[1].split(":").pop()!, xmlDecode(field[2].replace(/<[^>]*>/g, "")).trim()])));
      return objectRows(values);
    } else throw new SellerImportParseError("IMPORT_FORMAT_UNSUPPORTED");
  } catch (error) { if (error instanceof SellerImportParseError) throw error; throw new SellerImportParseError("IMPORT_FILE_INVALID"); }
  if (rows.length < 2) throw new SellerImportParseError("IMPORT_EMPTY");
  if (rows.length - 1 > SELLER_IMPORT_MAX_ROWS) throw new SellerImportParseError("IMPORT_TOO_MANY_ROWS");
  if (rows[0].length > 60) throw new SellerImportParseError("IMPORT_FILE_INVALID");
  const headers = boundedHeaders(rows[0]);
  return { headers, rows: rows.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, boundedCell(String(row[index] ?? ""))]))) };
}
