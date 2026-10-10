import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { retryableShipmentConflict } from "../lib/seller-shipments";

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("test error", {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta,
  });
}

test("shipment retries PostgreSQL serialization failures surfaced as raw-query P2010", () => {
  assert.equal(retryableShipmentConflict(prismaError("P2010", { code: "40001" })), true);
  assert.equal(retryableShipmentConflict(prismaError("P2010", { code: "23505" })), false);
  assert.equal(retryableShipmentConflict(prismaError("P2010")), false);
  assert.equal(retryableShipmentConflict(prismaError("P2002")), true);
  assert.equal(retryableShipmentConflict(prismaError("P2034")), true);
  assert.equal(retryableShipmentConflict(new Error("SQLSTATE 40001")), false);
});
