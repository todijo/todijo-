import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("production environment inventory covers critical, optional, and runner contracts", () => {
  const env = read(".env.example"), runbook = read("docs/production-operations-runbook.md");
  for (const name of ["DATABASE_URL", "SESSION_SECRET", "APP_URL", "STRIPE_SECRET_KEY", "STRIPE_MODE", "STRIPE_WEBHOOK_SECRET", "SUPPLIER_SYNC_CRON_SECRET", "SELLER_TRANSFER_CRON_SECRET", "REFUND_FINANCIAL_CRON_SECRET", "CJ_AUTOMATIC_FULFILLMENT_ENABLED", "OPEN_EXCHANGE_RATES_APP_ID"]) assert.match(env, new RegExp(`^${name}=`, "m"));
  for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET", "FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"]) assert.match(env, new RegExp(`^${name}=`, "m"));
  assert.match(runbook, /PRODUCTION_READY_WITH_ACTIONS/);
  assert.match(runbook, /liveness only/);
});

test("read-only production diagnostic covers durable financial and inventory invariants", () => {
  const script = read("scripts/production-readiness-audit.mjs");
  for (const check of ["stale_transfer_submitting", "stale_refund_processing", "stale_reversal_processing", "impossible_group_accounting", "over_refunded_item_quantity", "over_reversed_transfer", "over_restocked_item_quantity", "invalid_stage4_return_identity", "negative_variant_stock", "cj_crossed_marketplace_accounting"]) assert.match(script, new RegExp(check));
  assert.doesNotMatch(script, /\.(?:create|update|updateMany|delete|deleteMany|upsert)\s*\(/);
  assert.doesNotMatch(script, /\$executeRaw|authorization|secret/i);
  assert.match(read("package.json"), /"audit:production-readiness": "node scripts\/production-readiness-audit\.mjs"/);
});

test("production test routes, Stripe mode, runner secrets, and CJ flag fail closed", () => {
  assert.match(read("app/e2e-ux/page.tsx"), /NODE_ENV === "production"\) notFound\(\)/);
  const webhook = read("app/api/stripe/webhook/route.ts"), stripe = read("lib/stripe.ts"), cj = read("lib/suppliers/supplier-fulfillment.ts");
  assert.match(webhook, /request\.text\(\)/); assert.match(webhook, /verifyStripeWebhook/); assert.match(webhook, /assertStripeWebhookMode/);
  assert.match(stripe, /STRIPE_MODE must be explicitly configured/); assert.match(stripe, /STRIPE_SECRET_KEY does not match configured/);
  assert.match(cj, /CJ_AUTOMATIC_FULFILLMENT_ENABLED/);
  for (const [path, secret] of [["app/api/internal/supplier-sync/route.ts", "SUPPLIER_SYNC_CRON_SECRET"], ["app/api/internal/seller-transfers/route.ts", "SELLER_TRANSFER_CRON_SECRET"], ["app/api/internal/refund-financials/route.ts", "REFUND_FINANCIAL_CRON_SECRET"]]) {
    const source = read(path); assert.match(source, new RegExp(secret)); assert.match(source, /timingSafeEqual/); assert.match(source, /status: 401/);
  }
});

test("operations documentation prohibits silent repair and records the paid inventory race", () => {
  const runbook = read("docs/production-operations-runbook.md");
  assert.match(runbook, /never repairs data/i);
  assert.match(runbook, /known oversell window/i);
  assert.match(runbook, /Never repair financial state with ad-hoc SQL/i);
  assert.match(runbook, /Back up PostgreSQL/i);
  assert.match(runbook, /every 15 minutes/i);
  assert.match(runbook, /five advisory entries/);
});
