import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;

export type AuthRateLimitStore = {
  consume(key: string, now: Date, windowMs: number): Promise<number>;
};

type RateLimitDatabase = {
  $queryRaw<T>(query: Prisma.Sql): Promise<T>;
};

export class PostgresAuthRateLimitStore implements AuthRateLimitStore {
  constructor(private readonly db: RateLimitDatabase = prisma) {}

  async consume(key: string, now: Date, windowMs: number) {
    const expiresAt = new Date(now.getTime() + windowMs);
    const rows = await this.db.$queryRaw<Array<{ requestCount: number }>>(Prisma.sql`
      WITH expired AS (
        DELETE FROM "AuthRateLimitBucket"
        WHERE "expiresAt" <= ${now} AND "key" <> ${key}
      ), consumed AS (
        INSERT INTO "AuthRateLimitBucket" ("key", "requestCount", "windowStartedAt", "expiresAt")
        VALUES (${key}, 1, ${now}, ${expiresAt})
        ON CONFLICT ("key") DO UPDATE SET
          "requestCount" = CASE
            WHEN "AuthRateLimitBucket"."expiresAt" <= ${now} THEN 1
            ELSE "AuthRateLimitBucket"."requestCount" + 1
          END,
          "windowStartedAt" = CASE
            WHEN "AuthRateLimitBucket"."expiresAt" <= ${now} THEN ${now}
            ELSE "AuthRateLimitBucket"."windowStartedAt"
          END,
          "expiresAt" = CASE
            WHEN "AuthRateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt}
            ELSE "AuthRateLimitBucket"."expiresAt"
          END
        RETURNING "requestCount"
      )
      SELECT "requestCount" FROM consumed
    `);
    return rows[0]?.requestCount ?? MAX_REQUESTS + 1;
  }
}

export function createMemoryAuthRateLimitStore(): AuthRateLimitStore {
  const attempts = new Map<string, number[]>();
  return {
    async consume(key, now, windowMs) {
      for (const [candidate, values] of attempts) {
        const recent = values.filter((value) => value > now.getTime() - windowMs);
        if (recent.length) attempts.set(candidate, recent);
        else attempts.delete(candidate);
      }
      const recent = attempts.get(key) ?? [];
      recent.push(now.getTime());
      attempts.set(key, recent);
      return recent.length;
    },
  };
}

const postgresStore = new PostgresAuthRateLimitStore();
const developmentStore = createMemoryAuthRateLimitStore();

export function authRequestKey(scope: string, identity: string, request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const client = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? forwarded ?? "unknown";
  return createHash("sha256").update(`${scope}:${identity}:${client}`).digest("hex");
}

export async function allowAuthRequest(key: string, now = Date.now(), store?: AuthRateLimitStore) {
  const selected = store ?? (process.env.NODE_ENV === "production" ? postgresStore : developmentStore);
  try {
    return await selected.consume(key, new Date(now), WINDOW_MS) <= MAX_REQUESTS;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      console.error("Shared authentication rate limiter unavailable.", error instanceof Error ? error.name : "UnknownError");
      return false;
    }
    return selected === developmentStore ? false : await developmentStore.consume(key, new Date(now), WINDOW_MS) <= MAX_REQUESTS;
  }
}
