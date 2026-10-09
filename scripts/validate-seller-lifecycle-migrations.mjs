import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const prismaRoot = join(repositoryRoot, "prisma");
const prismaCli = join(repositoryRoot, "node_modules", "prisma", "build", "index.js");
const migrationNames = [
  "20261008100000_seller_subscription_trial",
  "20261008103000_seller_closure_and_reactivation",
];
const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));

if (
  !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
  !["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname) ||
  decodeURIComponent(databaseUrl.username) !== "lifecycle" ||
  databaseName !== "todijo_lifecycle_validation"
) {
  throw new Error("Refusing to run: this helper is restricted to its disposable loopback CI database.");
}

if (!existsSync(prismaCli)) throw new Error("Prisma CLI is not installed; run npm ci first.");

const psqlEnvironment = {
  ...process.env,
  PGHOST: databaseUrl.hostname,
  PGPORT: databaseUrl.port || "5432",
  PGUSER: decodeURIComponent(databaseUrl.username),
  PGPASSWORD: decodeURIComponent(databaseUrl.password),
  PGDATABASE: databaseName,
  PGSSLMODE: "disable",
};
delete psqlEnvironment.DATABASE_URL;

const runId = `${process.env.GITHUB_RUN_ID ?? "local"}_${randomUUID().replaceAll("-", "").slice(0, 8)}`
  .toLowerCase()
  .replace(/[^a-z0-9_]/g, "_");
const schemas = [
  `seller_lifecycle_fresh_${runId}`,
  `seller_lifecycle_upgrade_${runId}`,
];
const tempRoot = mkdtempSync(join(tmpdir(), "todijo-seller-lifecycle-migrations-"));
const safeOutput = (value) => value.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[DATABASE_URL]");

function runPsql(args) {
  const result = spawnSync("psql", ["--no-psqlrc", "--no-align", "--tuples-only", "--set=ON_ERROR_STOP=1", ...args], {
    cwd: repositoryRoot,
    env: psqlEnvironment,
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.error || result.status !== 0) {
    const detail = safeOutput(`${result.stdout ?? ""}\n${result.stderr ?? ""}`).trim();
    throw new Error(`psql validation command failed${detail ? `: ${detail}` : "."}`);
  }
  return (result.stdout ?? "").trim();
}

function runPrisma(schemaFile, schemaName, command) {
  const schemaUrl = new URL(databaseUrl);
  schemaUrl.search = "";
  schemaUrl.searchParams.set("schema", schemaName);
  const result = spawnSync(process.execPath, [prismaCli, ...command, "--schema", schemaFile], {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: schemaUrl.toString() },
    encoding: "utf8",
    timeout: 240_000,
  });
  const output = safeOutput(`${result.stdout ?? ""}${result.stderr ?? ""}`).trim();
  if (result.error || result.status !== 0) {
    throw new Error(`Prisma ${command.join(" ")} failed for schema ${schemaName}${output ? `:\n${output}` : "."}`);
  }
  if (output) process.stdout.write(`${output}\n`);
}

function runPsqlInSchema(schemaName, sql) {
  return runPsql(["--command", `SET search_path TO "${schemaName}"`, "--command", sql]);
}

function assertSql(schemaName, sql, label) {
  const result = runPsqlInSchema(schemaName, sql);
  if (result !== "PASS") throw new Error(`${label} did not pass (database assertion returned ${result || "no result"}).`);
}

function copyPrismaTree(destination, excludedMigrations = []) {
  mkdirSync(destination, { recursive: true });
  cpSync(join(prismaRoot, "schema.prisma"), join(destination, "schema.prisma"));
  const sourceMigrations = join(prismaRoot, "migrations");
  const destinationMigrations = join(destination, "migrations");
  mkdirSync(destinationMigrations, { recursive: true });
  cpSync(join(sourceMigrations, "migration_lock.toml"), join(destinationMigrations, "migration_lock.toml"));
  const directories = readdirSync(sourceMigrations, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of directories) {
    if (!excludedMigrations.includes(name)) cpSync(join(sourceMigrations, name), join(destinationMigrations, name), { recursive: true });
  }
  return join(destination, "schema.prisma");
}

function seedPrePhase3Records(schemaName) {
  const seed = `
INSERT INTO "User" ("id", "firstName", "lastName", "email", "role", "emailVerified", "createdAt", "updatedAt") VALUES
 ('owner-free', 'Free', 'Seller', 'free-owner@example.test', 'SELLER', true, TIMESTAMP '2024-01-01', TIMESTAMP '2024-01-01'),
 ('owner-plus', 'Plus', 'Seller', 'plus-owner@example.test', 'SELLER', true, TIMESTAMP '2024-01-01', TIMESTAMP '2024-01-01'),
 ('owner-pro', 'Pro', 'Seller', 'pro-owner@example.test', 'SELLER', true, TIMESTAMP '2024-01-01', TIMESTAMP '2024-01-01'),
 ('buyer-history', 'Buyer', 'History', 'buyer-history@example.test', 'CUSTOMER', true, TIMESTAMP '2024-01-01', TIMESTAMP '2024-01-01'),
 ('team-worker', 'Team', 'Worker', 'team-worker@example.test', 'CUSTOMER', true, TIMESTAMP '2024-01-01', TIMESTAMP '2024-01-01');

INSERT INTO "SellerBusiness" ("id", "ownerId", "maxStores", "createdAt", "updatedAt") VALUES
 ('business-free', 'owner-free', 1, TIMESTAMP '2024-01-01', TIMESTAMP '2024-01-01'),
 ('business-plus', 'owner-plus', 1, TIMESTAMP '2024-01-01', TIMESTAMP '2024-01-01'),
 ('business-pro', 'owner-pro', 3, TIMESTAMP '2024-01-01', TIMESTAMP '2024-01-01');

INSERT INTO "Store" ("id", "name", "slug", "country", "city", "contactEmail", "status", "ownerId", "businessId", "createdAt", "updatedAt") VALUES
 ('store-free', 'Free Test Store', 'free-test-store', 'FR', 'Paris', 'free-owner@example.test', 'ACTIVE', 'owner-free', 'business-free', TIMESTAMP '2024-01-01', TIMESTAMP '2024-01-01'),
 ('store-plus', 'Plus Test Store', 'plus-test-store', 'FR', 'Lyon', 'plus-owner@example.test', 'ACTIVE', 'owner-plus', 'business-plus', TIMESTAMP '2024-01-01', TIMESTAMP '2024-01-01'),
 ('store-pro-primary', 'Pro Primary Test Store', 'pro-primary-test-store', 'FR', 'Marseille', 'pro-owner@example.test', 'ACTIVE', 'owner-pro', 'business-pro', TIMESTAMP '2024-01-01', TIMESTAMP '2024-01-01'),
 ('store-pro-secondary', 'Pro Secondary Test Store', 'pro-secondary-test-store', 'FR', 'Nice', 'pro-owner@example.test', 'ACTIVE', 'owner-pro', 'business-pro', TIMESTAMP '2024-01-01', TIMESTAMP '2024-01-01');

UPDATE "SellerBusiness" SET "billingStoreId" = 'store-free' WHERE "id" = 'business-free';
UPDATE "SellerBusiness" SET "billingStoreId" = 'store-plus' WHERE "id" = 'business-plus';
UPDATE "SellerBusiness" SET "billingStoreId" = 'store-pro-primary' WHERE "id" = 'business-pro';
UPDATE "User" SET "primaryStoreId" = 'store-free' WHERE "id" = 'owner-free';
UPDATE "User" SET "primaryStoreId" = 'store-plus' WHERE "id" = 'owner-plus';
UPDATE "User" SET "primaryStoreId" = 'store-pro-primary' WHERE "id" = 'owner-pro';

INSERT INTO "SellerSubscription" ("id", "storeId", "stripeSubscriptionId", "stripePriceId", "plan", "billingInterval", "status", "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd", "scheduledPlan", "scheduledBillingInterval", "scheduledChangeAt", "createdAt", "updatedAt") VALUES
 ('subscription-plus', 'store-plus', 'sub_synthetic_plus', 'price_synthetic_plus', 'plus', 'annual', 'ACTIVE', TIMESTAMP '2025-04-01', TIMESTAMP '2026-04-01', false, NULL, NULL, NULL, TIMESTAMP '2025-04-01', TIMESTAMP '2025-04-01'),
 ('subscription-pro-primary', 'store-pro-primary', 'sub_synthetic_pro_primary', 'price_synthetic_pro', 'pro', 'monthly', 'ACTIVE', TIMESTAMP '2025-04-01', TIMESTAMP '2025-05-01', true, 'plus', 'monthly', TIMESTAMP '2025-05-01', TIMESTAMP '2025-04-01', TIMESTAMP '2025-04-01'),
 ('subscription-pro-secondary', 'store-pro-secondary', 'sub_synthetic_pro_secondary', 'price_synthetic_pro', 'pro', 'annual', 'ACTIVE', TIMESTAMP '2025-03-01', TIMESTAMP '2026-03-01', false, NULL, NULL, NULL, TIMESTAMP '2025-03-01', TIMESTAMP '2025-03-01');

INSERT INTO "Product" ("id", "name", "slug", "description", "price", "category", "stock", "condition", "images", "status", "deactivationReason", "storeId", "createdAt", "updatedAt") VALUES
 ('product-published', 'Historical published item', 'historical-published-item', 'Synthetic preserved item', 12.50, 'home', 4, 'NEW', ARRAY[]::TEXT[], 'PUBLISHED', 'NONE', 'store-pro-primary', TIMESTAMP '2025-04-01', TIMESTAMP '2025-04-01'),
 ('product-inactive', 'Historical inactive item', 'historical-inactive-item', 'Synthetic inactive item', 8.00, 'home', 2, 'NEW', ARRAY[]::TEXT[], 'DRAFT', 'SUBSCRIPTION_INACTIVE', 'store-pro-primary', TIMESTAMP '2025-04-01', TIMESTAMP '2025-04-01');

INSERT INTO "Order" ("id", "buyerId", "status", "currency", "total", "checkoutRequestId", "storeIdSnapshot", "storeNameSnapshot", "sellerInvoiceReference", "sellerInvoiceUrl", "sellerInvoiceIssuedAt", "createdAt", "updatedAt") VALUES
 ('order-history', 'buyer-history', 'PAID', 'EUR', 12.50, 'synthetic-checkout-history', 'store-pro-primary', 'Pro Primary Test Store', 'INV-SYNTHETIC-001', 'https://example.test/invoice/synthetic-001', TIMESTAMP '2025-04-02', TIMESTAMP '2025-04-02', TIMESTAMP '2025-04-02');

INSERT INTO "OrderItem" ("id", "orderId", "productId", "quantity", "unitPrice", "lineKey", "productNameSnapshot", "createdAt") VALUES
 ('order-item-history', 'order-history', 'product-published', 1, 12.50, 'line-1', 'Historical published item', TIMESTAMP '2025-04-02');

INSERT INTO "SellerTeamMembership" ("id", "businessId", "userId", "roleTemplate", "permissions", "createdAt", "updatedAt") VALUES
 ('team-membership-history', 'business-pro', 'team-worker', 'PRODUCT_MANAGER', ARRAY['PRODUCT_VIEW']::"TeamPermission"[], TIMESTAMP '2025-04-01', TIMESTAMP '2025-04-01');

INSERT INTO "SellerTeamStoreAssignment" ("id", "membershipId", "storeId", "productScope", "categoryKeys", "createdAt") VALUES
 ('team-assignment-history', 'team-membership-history', 'store-pro-secondary', 'ALL_PRODUCTS', ARRAY[]::TEXT[], TIMESTAMP '2025-04-01');
`;
  runPsql(["--single-transaction", "--command", `SET search_path TO "${schemaName}"`, "--command", seed]);
  assertSql(schemaName, `DO $$ BEGIN
    IF (SELECT count(*) FROM "SellerBusiness") <> 3 THEN RAISE EXCEPTION 'synthetic business fixture count mismatch'; END IF;
    IF (SELECT count(*) FROM "SellerSubscription") <> 3 THEN RAISE EXCEPTION 'synthetic subscription fixture count mismatch'; END IF;
    IF (SELECT count(*) FROM "SellerTeamStoreAssignment") <> 1 THEN RAISE EXCEPTION 'synthetic team fixture missing'; END IF;
    RAISE NOTICE 'PASS';
  END $$;
  SELECT 'PASS';`, "pre-migration synthetic fixture verification");
}

function verifyUpgrade(schemaName) {
  assertSql(schemaName, `DO $$
  DECLARE plus_trial TIMESTAMP(3); pro_trial TIMESTAMP(3); free_trial TIMESTAMP(3);
  BEGIN
    SELECT "firstPaidTrialGrantedAt" INTO plus_trial FROM "SellerBusiness" WHERE id = 'business-plus';
    SELECT "firstPaidTrialGrantedAt" INTO pro_trial FROM "SellerBusiness" WHERE id = 'business-pro';
    SELECT "firstPaidTrialGrantedAt" INTO free_trial FROM "SellerBusiness" WHERE id = 'business-free';
    IF plus_trial IS DISTINCT FROM TIMESTAMP '2025-04-01' THEN RAISE EXCEPTION 'PLUS history did not prevent a repeat trial'; END IF;
    IF pro_trial IS DISTINCT FROM TIMESTAMP '2025-03-01' THEN RAISE EXCEPTION 'PRO multi-store history did not use the earliest paid period'; END IF;
    IF free_trial IS NOT NULL THEN RAISE EXCEPTION 'FREE business was incorrectly marked as having used a paid trial'; END IF;
    IF (SELECT count(*) FROM "SellerSubscription" WHERE "trialEnd" IS NOT NULL) <> 0 THEN RAISE EXCEPTION 'migration granted a trial to an existing subscription'; END IF;
    IF (SELECT count(*) FROM "SellerBusiness" WHERE "sellerClosedAt" IS NOT NULL OR "reactivationStockReviewRequired" OR "stripeCancellationPending") <> 0 THEN RAISE EXCEPTION 'migration closed or gated an existing seller'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "SellerSubscription" WHERE id = 'subscription-pro-primary' AND "cancelAtPeriodEnd" AND "scheduledPlan" = 'plus' AND "scheduledChangeAt" = TIMESTAMP '2025-05-01') THEN RAISE EXCEPTION 'scheduled cancellation/change state was not preserved'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "Product" WHERE id = 'product-published' AND status = 'PUBLISHED' AND stock = 4) THEN RAISE EXCEPTION 'published inventory changed'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "Product" WHERE id = 'product-inactive' AND status = 'DRAFT' AND "deactivationReason" = 'SUBSCRIPTION_INACTIVE' AND stock = 2) THEN RAISE EXCEPTION 'inactive inventory was republished or changed'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "Order" WHERE id = 'order-history' AND "sellerInvoiceReference" = 'INV-SYNTHETIC-001' AND "sellerInvoiceUrl" = 'https://example.test/invoice/synthetic-001') THEN RAISE EXCEPTION 'historical order or invoice changed'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "OrderItem" WHERE id = 'order-item-history' AND "productId" = 'product-published') THEN RAISE EXCEPTION 'historical order item relationship changed'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "SellerTeamMembership" membership JOIN "SellerTeamStoreAssignment" assignment ON assignment."membershipId" = membership.id JOIN "Store" store ON store.id = assignment."storeId" WHERE membership.id = 'team-membership-history' AND store."businessId" = 'business-pro') THEN RAISE EXCEPTION 'PRO team/multistore relationship changed'; END IF;
    IF to_regclass('"SellerClosureToken"') IS NULL THEN RAISE EXCEPTION 'closure token table missing'; END IF;
    IF (SELECT count(*) FROM pg_constraint WHERE conrelid = '"SellerClosureToken"'::regclass AND contype = 'f') <> 2 THEN RAISE EXCEPTION 'closure token foreign keys missing'; END IF;
    RAISE NOTICE 'PASS';
  END $$;
  SELECT 'PASS';`, "post-migration data, default, relationship and constraint verification");
}

function verifyMigrationHistory(schemaName) {
  const result = runPsqlInSchema(schemaName, `SELECT count(*) FROM "_prisma_migrations" WHERE migration_name IN ('${migrationNames.join("','")}') AND finished_at IS NOT NULL AND rolled_back_at IS NULL`);
  if (result !== "2") throw new Error(`Expected both Phase 3 migrations applied in ${schemaName}; found ${result || "no history"}.`);
}

try {
  if (!existsSync(join(repositoryRoot, "node_modules"))) throw new Error("node_modules is missing; run npm ci first.");
  const migrationDirectories = readdirSync(join(prismaRoot, "migrations"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const migration of migrationNames) {
    if (!migrationDirectories.includes(migration)) throw new Error(`Required migration is missing: ${migration}`);
  }
  const sorted = [...migrationDirectories].sort();
  if (sorted.slice(-migrationNames.length).join("\n") !== [...migrationNames].sort().join("\n")) {
    throw new Error("Phase 3 migrations are not the final ordered migrations; review the upgrade fixture before running.");
  }

  for (const schema of schemas) createSchema(schema);

  console.log("Applying the complete migration chain to a fresh disposable schema.");
  const freshSchemaFile = join(prismaRoot, "schema.prisma");
  runPrisma(freshSchemaFile, schemas[0], ["migrate", "deploy"]);
  runPrisma(freshSchemaFile, schemas[0], ["migrate", "status"]);
  verifyMigrationHistory(schemas[0]);

  console.log("Applying the pre-Phase-3 history, seeding synthetic prior data, then applying the two Phase 3 migrations.");
  const stagedPrisma = join(tempRoot, "prisma");
  const stagedSchema = copyPrismaTree(stagedPrisma, migrationNames);
  runPrisma(stagedSchema, schemas[1], ["migrate", "deploy"]);
  runPrisma(stagedSchema, schemas[1], ["migrate", "status"]);
  seedPrePhase3Records(schemas[1]);
  const stagedMigrations = join(stagedPrisma, "migrations");
  for (const name of migrationNames) {
    cpSync(join(prismaRoot, "migrations", name), join(stagedMigrations, name), { recursive: true });
  }
  runPrisma(stagedSchema, schemas[1], ["migrate", "deploy"]);
  runPrisma(stagedSchema, schemas[1], ["migrate", "status"]);
  verifyMigrationHistory(schemas[1]);
  verifyUpgrade(schemas[1]);
  console.log(`Migration validation passed on PostgreSQL ${process.env.POSTGRES_VERSION ?? "CI service"}: full chain plus synthetic pre-Phase-3 upgrade.`);
} finally {
  for (const schema of schemas) {
    try {
      runPsql(["--command", `DROP SCHEMA IF EXISTS "${schema}" CASCADE`]);
      const remaining = runPsql(["--command", `SELECT to_regnamespace('${schema}') IS NOT NULL`]);
      if (remaining !== "f") console.warn(`Temporary schema cleanup could not be confirmed for ${schema}.`);
    } catch {
      console.warn(`Temporary schema cleanup could not be confirmed for ${schema}; it exists only in the disposable CI database.`);
    }
  }
  rmSync(tempRoot, { recursive: true, force: true });
}
