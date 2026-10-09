import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

const requireFromRepository = createRequire(path.join(process.cwd(), "package.json"));
const { buildMigrationPlan } = requireFromRepository("./scripts/seller-lifecycle-migration-plan.cjs") as typeof import("../scripts/seller-lifecycle-migration-plan.cjs");

const trial = "20261008100000_seller_subscription_trial";
const closure = "20261008103000_seller_closure_and_reactivation";

test("migration plan splits exactly before Phase 3 and includes every later migration in chronological order", () => {
  const names = [
    "20261009120000_add_item_level_shipments_buyer_emails",
    closure,
    "20261007120000_before_phase3",
    trial,
    "20261008110000_after_phase3",
  ];
  const plan = buildMigrationPlan(names, trial, closure);
  assert.deepEqual(plan.ordered, ["20261007120000_before_phase3", trial, closure, "20261008110000_after_phase3", "20261009120000_add_item_level_shipments_buyer_emails"]);
  assert.deepEqual(plan.prePhase3, ["20261007120000_before_phase3"]);
  assert.deepEqual(plan.phase3AndLater, [trial, closure, "20261008110000_after_phase3", "20261009120000_add_item_level_shipments_buyer_emails"]);
});

test("migration plan fails closed when a Phase 3 migration is missing or not adjacent", () => {
  assert.throws(() => buildMigrationPlan([trial], trial, closure), /missing/);
  assert.throws(() => buildMigrationPlan([trial, "20261008101500_unexpected", closure], trial, closure), /adjacent/);
  assert.throws(() => buildMigrationPlan([trial, trial, closure], trial, closure), /unique/);
});
