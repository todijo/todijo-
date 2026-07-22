import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const source = await readFile(new URL("../app/icon.svg", import.meta.url));
await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await sharp(source).resize(180, 180).png().toFile(fileURLToPath(new URL("../app/apple-icon.png", import.meta.url)));

const faviconPng = await sharp(source).resize(64, 64).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(64, 6);
header.writeUInt8(64, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(faviconPng.length, 14);
header.writeUInt32LE(22, 18);
await writeFile(new URL("../public/favicon.ico", import.meta.url), Buffer.concat([header, faviconPng]));
