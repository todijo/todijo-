#!/usr/bin/env bash
set -euo pipefail

image="${1:-todijo-production-entrypoint-test}"
suffix="${GITHUB_RUN_ID:-local}-${RANDOM}"
network="todijo-entrypoint-${suffix}"
postgres_container="todijo-entrypoint-postgres-${suffix}"
old_app_container="todijo-entrypoint-old-${suffix}"
valid_app_container="todijo-entrypoint-valid-${suffix}"
invalid_app_container="todijo-entrypoint-invalid-${suffix}"
work_dir="$(mktemp -d)"

cleanup() {
  set +e
  for container in \
    "${invalid_app_container}" \
    "${valid_app_container}" \
    "${old_app_container}" \
    "todijo-entrypoint-runner-a-${suffix}" \
    "todijo-entrypoint-runner-b-${suffix}" \
    "${postgres_container}"; do
    if docker inspect "${container}" >/dev/null 2>&1; then
      docker rm --force "${container}" >/dev/null
    fi
  done
  if docker network inspect "${network}" >/dev/null 2>&1; then
    docker network rm "${network}" >/dev/null
  fi
  rm -rf "${work_dir}"
}
trap cleanup EXIT

wait_for_postgres() {
  for _ in {1..30}; do
    if docker exec "${postgres_container}" pg_isready -U todijo -d postgres >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  docker logs "${postgres_container}"
  return 1
}

wait_for_health() {
  local container="$1"
  for _ in {1..60}; do
    if docker exec "${container}" curl --fail --silent --show-error http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
      return 0
    fi
    if test "$(docker inspect --format '{{.State.Status}}' "${container}")" = "exited"; then
      docker logs "${container}"
      return 1
    fi
    sleep 1
  done
  docker logs "${container}"
  return 1
}

database_url() {
  printf 'postgresql://todijo:todijo@%s:5432/%s?schema=public' "${postgres_container}" "$1"
}

create_database() {
  docker exec "${postgres_container}" createdb -U todijo "$1"
}

build_probe_image() {
  local tag="$1"
  local base_image="$2"
  local migration_name="$3"
  local migration_sql="$4"
  local context="${work_dir}/${migration_name}"
  mkdir -p "${context}/${migration_name}"
  printf '%s\n' "${migration_sql}" > "${context}/${migration_name}/migration.sql"
  cat > "${context}/Dockerfile" <<EOF
ARG BASE_IMAGE
FROM \${BASE_IMAGE}
USER root
COPY --chown=nextjs:nodejs ${migration_name}/ /app/prisma/migrations/${migration_name}/
USER nextjs
EOF
  docker build --build-arg "BASE_IMAGE=${base_image}" --tag "${tag}" "${context}"
}

docker network create "${network}" >/dev/null
docker run --detach --name "${postgres_container}" --network "${network}" \
  --env POSTGRES_USER=todijo \
  --env POSTGRES_PASSWORD=todijo \
  --env POSTGRES_DB=postgres \
  public.ecr.aws/docker/library/postgres:16 >/dev/null
wait_for_postgres

create_database no_pending
docker run --rm --network "${network}" \
  --env "DATABASE_URL=$(database_url no_pending)" \
  --entrypoint ./node_modules/.bin/prisma \
  "${image}" migrate deploy

docker run --detach --name "${old_app_container}" --network "${network}" \
  --env "DATABASE_URL=$(database_url no_pending)" \
  --env SESSION_SECRET=ci-only-placeholder-secret-at-least-32-characters \
  "${image}" >/dev/null
wait_for_health "${old_app_container}"
test "$(docker exec "${old_app_container}" id -u)" = "1001"
test "$(docker exec "${old_app_container}" id -g)" = "1001"
docker exec "${old_app_container}" test -x node_modules/.bin/prisma
docker exec "${old_app_container}" test -f prisma/schema.prisma
docker exec "${old_app_container}" test -d prisma/migrations
old_logs="$(docker logs "${old_app_container}" 2>&1)"
test "$(printf '%s\n' "${old_logs}" | grep -n 'todijo-entrypoint: applying Prisma migrations' | cut -d: -f1)" -lt \
  "$(printf '%s\n' "${old_logs}" | grep -n 'todijo-entrypoint: migrations complete; starting application' | cut -d: -f1)"

valid_migration="29990101000000_deployment_pipeline_probe"
valid_image="${image}-valid"
build_probe_image "${valid_image}" "${image}" "${valid_migration}" \
  'SELECT pg_sleep(3); CREATE TABLE "DeploymentPipelineProbe" ("id" INTEGER PRIMARY KEY);'

create_database valid_startup
docker run --rm --network "${network}" \
  --env "DATABASE_URL=$(database_url valid_startup)" \
  --entrypoint ./node_modules/.bin/prisma \
  "${image}" migrate deploy
docker run --detach --name "${valid_app_container}" --network "${network}" \
  --env "DATABASE_URL=$(database_url valid_startup)" \
  --env SESSION_SECRET=ci-only-placeholder-secret-at-least-32-characters \
  "${valid_image}" >/dev/null
sleep 1
if docker exec "${valid_app_container}" curl --fail --silent --show-error http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo 'Application became healthy before its pending migration completed' >&2
  exit 1
fi
test "$(docker inspect --format '{{.State.Status}}' "${valid_app_container}")" = "running"
wait_for_health "${valid_app_container}"
docker exec "${postgres_container}" psql -U todijo -d valid_startup -v ON_ERROR_STOP=1 -Atc \
  "SELECT to_regclass('\"DeploymentPipelineProbe\"') IS NOT NULL;" | grep -Fx t
docker exec "${postgres_container}" psql -U todijo -d valid_startup -v ON_ERROR_STOP=1 -Atc \
  "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name = '${valid_migration}' AND finished_at IS NOT NULL;" | grep -Fx 1

concurrent_migration="29990101001000_deployment_pipeline_concurrency"
concurrent_image="${image}-concurrent"
build_probe_image "${concurrent_image}" "${image}" "${concurrent_migration}" \
  'SELECT pg_sleep(2); CREATE TABLE "DeploymentPipelineConcurrency" ("id" INTEGER PRIMARY KEY);'
create_database concurrent_startup
docker run --rm --network "${network}" \
  --env "DATABASE_URL=$(database_url concurrent_startup)" \
  --entrypoint ./node_modules/.bin/prisma \
  "${image}" migrate deploy
docker run --detach --name "todijo-entrypoint-runner-a-${suffix}" --network "${network}" \
  --env "DATABASE_URL=$(database_url concurrent_startup)" \
  --entrypoint ./node_modules/.bin/prisma \
  "${concurrent_image}" migrate deploy >/dev/null
docker run --detach --name "todijo-entrypoint-runner-b-${suffix}" --network "${network}" \
  --env "DATABASE_URL=$(database_url concurrent_startup)" \
  --entrypoint ./node_modules/.bin/prisma \
  "${concurrent_image}" migrate deploy >/dev/null
test "$(docker wait "todijo-entrypoint-runner-a-${suffix}")" = "0"
test "$(docker wait "todijo-entrypoint-runner-b-${suffix}")" = "0"
docker exec "${postgres_container}" psql -U todijo -d concurrent_startup -v ON_ERROR_STOP=1 -Atc \
  "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name = '${concurrent_migration}' AND finished_at IS NOT NULL;" | grep -Fx 1

invalid_migration="29990101002000_deployment_pipeline_failure"
invalid_image="${image}-invalid"
build_probe_image "${invalid_image}" "${valid_image}" "${invalid_migration}" \
  'THIS IS DELIBERATELY INVALID SQL;'
docker rm --force "${valid_app_container}" >/dev/null
set +e
docker run --name "${invalid_app_container}" --network "${network}" \
  --env "DATABASE_URL=$(database_url valid_startup)" \
  --env SESSION_SECRET=ci-only-placeholder-secret-at-least-32-characters \
  "${invalid_image}" >"${work_dir}/invalid.log" 2>&1
invalid_exit="$?"
set -e
test "${invalid_exit}" -ne 0
grep -F 'todijo-entrypoint: applying Prisma migrations' "${work_dir}/invalid.log"
if grep -F 'todijo-entrypoint: migrations complete; starting application' "${work_dir}/invalid.log"; then
  echo 'Application started after a failed migration' >&2
  exit 1
fi
grep -E 'migration|syntax error|P30[0-9][0-9]' "${work_dir}/invalid.log"
wait_for_health "${old_app_container}"

echo 'Production entrypoint integration tests passed.'
