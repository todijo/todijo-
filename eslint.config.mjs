import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: directory });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { rules: { "@next/next/no-html-link-for-pages": "off" } },
  { files: ["tests/**/*.ts"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
  { ignores: [".next/**", ".test-dist/**", "node_modules/**", "next-env.d.ts"] },
];

export default config;
