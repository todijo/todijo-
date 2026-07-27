# Prisma production migration runbook

This project has a checked-in baseline migration followed by forward-only
migrations. Production schema changes use `prisma migrate deploy`; production
must not use `prisma db push`.

The baseline represents the exact Prisma schema at Git commit
`1167bf82c57b52d07bfc7af6273fcc1e2fa70a6a`, immediately before
`20260721170000_add_stripe_payments`.

## Existing production database

Do not run the baseline SQL against an existing database. Do not mark the
baseline as applied until every verification below succeeds.

1. Schedule a maintenance window and prevent concurrent application
   deployments.
2. Take a provider-supported, transactionally consistent database backup.
3. Restore that backup into an isolated non-production database and verify:
   - the restore completes without errors;
   - expected tables and representative row counts are present;
   - the restored application data can be queried.
4. Record the current migration history without changing it:

   ```sql
   SELECT
     "migration_name",
     "started_at",
     "finished_at",
     "rolled_back_at",
     "applied_steps_count",
     "logs"
   FROM "_prisma_migrations"
   ORDER BY "started_at";
   ```

   If `_prisma_migrations` does not exist, record that fact. If any row is
   unfinished, rolled back unexpectedly, or contains failure logs, stop and
   investigate before continuing.
5. Run the read-only status check with the production `DATABASE_URL` supplied
   through the deployment platform:

   ```bash
   npx prisma migrate status
   ```

6. Compare the actual database schema with the historical baseline and every
   already-recorded migration. At minimum, inspect tables, columns, PostgreSQL
   enum values, indexes, unique constraints, foreign keys, defaults, nullability,
   and mapped physical column names. Use a schema-only dump or the database
   provider's schema inspector. Do not rely only on table names.
7. Have a second operator review the backup evidence, migration history, and
   schema comparison.
8. Only when the existing database is manually confirmed to already contain
   the baseline objects, record the baseline as applied:

   ```bash
   npx prisma migrate resolve --applied 20260720000000_baseline
   ```

   This command changes only Prisma migration history; it must not execute the
   baseline SQL. If verification is incomplete or the schema differs, stop.
9. Re-run:

   ```bash
   npx prisma migrate status
   ```

10. Review the migrations Prisma reports as pending, then deploy them:

    ```bash
    npx prisma migrate deploy
    ```

11. Confirm deployment success, re-run `npx prisma migrate status`, and verify
    application health and representative read paths before ending the
    maintenance window.

## Fresh database

For an empty database, do not resolve the baseline as applied. Run:

```bash
npx prisma migrate deploy
```

Prisma will execute the baseline first and then preserve the chronological
order of all existing migrations.

## Stop conditions

Stop without resolving or deploying when:

- a verified restorable backup is unavailable;
- production migration history is unknown or contains a failed migration;
- the actual schema cannot be reconciled with the baseline and recorded
  migrations;
- the database is not confirmed to be the intended environment;
- a pending migration contains unexpected SQL.

Do not reset, drop, recreate, or automatically reconcile the production
database.

## Rollback

`prisma migrate deploy` is forward-only. Before deployment, the rollback is to
stop and leave the database unchanged. After a failed or harmful deployment:

1. stop application writes;
2. preserve database and deployment logs;
3. roll back the application release only if it remains compatible with the
   migrated schema;
4. otherwise restore the verified pre-deployment backup into a controlled
   recovery environment and follow the database provider's approved recovery
   procedure.

Do not edit migration history or apply improvised reverse SQL during an
incident.
