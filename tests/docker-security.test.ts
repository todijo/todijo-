import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(__dirname, "../..");

test("Docker build does not declare sensitive values as ARG or ENV", () => {
  const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");
  const sensitiveNames = [
    "SESSION_SECRET",
    "DATABASE_URL",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "SMTP_PASS",
    "STRIPE_SECRET_KEY",
    "CJ_API_KEY",
    "CJ_ACCESS_TOKEN",
  ];

  for (const name of sensitiveNames) {
    assert.doesNotMatch(
      dockerfile,
      new RegExp(`^\\s*(?:ARG|ENV)\\s+${name}(?:[=\\s]|$)`, "m"),
      `${name} must be supplied only to the runtime container`,
    );
  }
});

test("Docker context excludes local environment files", () => {
  const dockerignore = readFileSync(resolve(root, ".dockerignore"), "utf8");

  assert.match(dockerignore, /^\.env$/m);
  assert.match(dockerignore, /^\.env\.\*$/m);
  assert.match(dockerignore, /^!\.env\.example$/m);
});

test("production container runs as the unprivileged application user", () => {
  const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");

  assert.match(dockerfile, /^USER nextjs$/m);
});
