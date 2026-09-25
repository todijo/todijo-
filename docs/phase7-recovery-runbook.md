# Pre-launch recovery rehearsal

The disposable local restore described below was executed on 25 September 2026. It does **not** prove production backup retention, media recovery, production-sized restore time, or live rollback. Never use the live database for disposable integration tests. Keep global loyalty disabled throughout the first deployment and migration.

## Executed local drill (disposable data only)

PostgreSQL 17.10 was initialized in a new temporary cluster bound to `127.0.0.1:55432`, separate from the existing Windows PostgreSQL service. The `todijo_e2e` database received all 59 repository migrations and synthetic buyer/seller/store rows. `pg_dump -Fc` produced a 324,280-byte custom-format archive in under one second. After verifying the cluster data directory and target database, only `todijo_e2e` was dropped and recreated; `pg_restore --exit-on-error` completed in about 1.5 seconds. Verification found 59 applied migrations, both users, the seller-owned store, its foreign key, the unique user-email index, and global loyalty disabled. The full backend suite passed 1,285/1,285 with no DB skips against this cluster.

A second disposable database was built from the 57 pre-loyalty migration SQL files. Synthetic buyer, seller, store, product, order and item rows were inserted before applying the two pending loyalty SQL files. They completed in approximately 232 ms and 136 ms respectively on the tiny local dataset. The pre-existing rows survived, the funding-source check and platform-funding unique index existed, and loyalty remained disabled. The application started against that schema and returned HTTP 200 from `/api/health`; the local app process was then stopped. These timings say nothing reliable about lock duration on a production-sized database.

On Windows with the installed PostgreSQL binaries, the equivalent isolated commands were:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\initdb.exe' -D '<new disposable temp directory>' -U e2e -A trust --encoding=UTF8
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D '<same disposable directory>' -o '-h 127.0.0.1 -p 55432' -w start
& 'C:\Program Files\PostgreSQL\17\bin\createdb.exe' -h 127.0.0.1 -p 55432 -U e2e todijo_e2e
$env:DATABASE_URL='postgresql://e2e:e2e@127.0.0.1:55432/todijo_e2e?schema=public'
npx prisma migrate deploy
npm test
& 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe' -h 127.0.0.1 -p 55432 -U e2e -d todijo_e2e -Fc -f '<protected disposable dump>'
# Verify data_directory and database name before replacing this disposable target.
& 'C:\Program Files\PostgreSQL\17\bin\dropdb.exe' -h 127.0.0.1 -p 55432 -U e2e todijo_e2e
& 'C:\Program Files\PostgreSQL\17\bin\createdb.exe' -h 127.0.0.1 -p 55432 -U e2e todijo_e2e
& 'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe' -h 127.0.0.1 -p 55432 -U e2e -d todijo_e2e --exit-on-error '<protected disposable dump>'
```

The `trust` setting is acceptable **only** for a short-lived loopback disposable cluster with synthetic data; never use it for a valuable database or exposed network listener. Stop the dedicated cluster with `pg_ctl -D <same disposable directory> -w stop` when the drill is complete.

## Backup and disposable restore rehearsal

1. Record the deployed commit, container image digest, PostgreSQL version, migration table state, database size, row counts for `User`, `Order`, `OrderGroup`, `StripeWebhookEvent`, `SupplierFulfillment`, `LoyaltyGrant`, and the current Stripe/CJ runner settings. Verify sufficient free storage. Store the evidence privately.
2. Using an approved production read-only backup account and a protected operator machine, create a compressed custom-format backup: `pg_dump --format=custom --no-owner --no-acl --file=<protected-backup-path> <production-connection-uri>`. Do not put credentials in shell history or the repository. Verify `pg_restore --list <protected-backup-path>` succeeds and record a checksum. Back up the Cloudinary/R2 asset inventory and provider retention policy separately; a PostgreSQL dump does not contain media bytes.
3. Provision a **new, empty, isolated** disposable PostgreSQL database with no network path back to production, then restore only into that verified target: `pg_restore --dbname=<verified-disposable-uri> --no-owner --no-acl --exit-on-error <protected-backup-path>`. Before running, confirm the target URI, host, database name and operator role are disposable. Never run `--clean` against a valuable database.
4. Compare the recorded row counts, key foreign-key relationships, migration history, and a sample of non-sensitive order/ledger aggregates on the restored copy. Record start/end times and any restore errors. Destroy the disposable copy according to the approved retention policy; protect the dump as production-sensitive customer data.

## Deployment and migration recovery

1. Confirm a fresh backup and successful restore rehearsal before applying the two pending loyalty migrations (`20260924120000_add_loyalty_ledger`, then `20260924190000_add_platform_funded_loyalty`). Check PostgreSQL disk/headroom, long-running transactions and lock wait metrics. These migrations are additive but include table alterations, checks, indexes and foreign keys that can block writes; schedule a controlled window.
2. Deploy the reviewed image with global loyalty disabled. Run `npx prisma migrate deploy` through the existing deployment path once, then inspect `_prisma_migrations` and validate expected columns, constraints and indexes. Run read-only application and accounting checks before allowing normal traffic. Do not turn on loyalty as part of this step.
3. If app deployment fails **without schema migration**, switch back to the prior image and verify public read, login, checkout and webhook intake. If a migration has applied, do **not** drop columns or rewrite applied migration files. Evaluate backward compatibility and choose a reviewed forward fix or a separately approved restore/roll-forward operation. Stop affected financial jobs while reconciling, not all evidence collection.
4. Preserve Stripe webhook events, request IDs, idempotency keys and persisted `StripeWebhookEvent` rows during recovery. Replaying a Stripe event requires signature verification and the normal idempotent handler; never insert order/payment state manually. Review stuck webhook, transfer, refund and loyalty reservation records before resuming runners.
5. When CJ is unavailable, leave automatic fulfillment disabled. Keep seller CJ orders in the existing manual/admin-controlled state. Investigate ambiguous provider responses and external references before retrying; do not issue a second blind order/payment. Resume tracking sync only after provider access is healthy.
6. Rotate a suspected secret at its provider/secret manager, update runtime and Traefik ingress where relevant, restart through a separately authorized deployment, and revoke the old key. Account for webhook destination secret overlap and retry windows; never print secrets or include them in the incident record.

Operational launch evidence still required: protected backup schedule/retention, measured restore time and successful isolated restore, Cloudinary/R2 asset recovery policy, a tested application rollback, Stripe webhook replay rehearsal, CJ outage drill and secret-rotation rehearsal. This repository alone cannot certify those external actions.
