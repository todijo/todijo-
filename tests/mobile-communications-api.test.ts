import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { startPrepurchaseConversation } from "../lib/conversation-messages";

const read = (path: string) => readFileSync(path, "utf8");

test("mobile message list derives identity from MobileSession", () => {
  const source = read("app/api/mobile/messages/route.ts");
  assert.match(source, /readMobileSession\(request\)/);
  assert.match(source, /session\.userId/);
  assert.doesNotMatch(source, /body\.userId|searchParams\.get\(["']userId/);
});
test("mobile pre-purchase entry uses bearer identity and shared ownership checks", () => {
  const mobile = read("app/api/mobile/messages/route.ts");
  const web = read("app/api/conversations/route.ts");
  assert.match(mobile, /readMobileSession\(request\)/);
  assert.match(mobile, /startPrepurchaseConversation\(prisma, session\.userId/);
  assert.match(web, /startPrepurchaseConversation\(prisma, session\.userId/);
  assert.doesNotMatch(mobile, /payload\?\.buyerId|payload\?\.sellerId/);
});
test("pre-purchase service reuses a buyer-product conversation and coalesces alerts", async () => {
  const calls: string[] = [];
  const db = {
    product: { findFirst: async () => ({ id: "p", name: "Product", storeId: "s", allowPrepurchaseQuestions: true, store: { ownerId: "seller" } }) },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
      conversation: { upsert: async (query: { where: { buyerId_productId: { buyerId: string; productId: string } } }) => {
        assert.deepEqual(query.where.buyerId_productId, { buyerId: "buyer", productId: "p" });
        calls.push("upsert");
        return { id: "existing" };
      } },
      message: { create: async () => { calls.push("message"); } },
      notification: {
        deleteMany: async () => { calls.push("coalesce"); },
        create: async () => { calls.push("notify"); return { id: "n" }; },
      },
    }),
  } as unknown as PrismaClient;
  const result = await startPrepurchaseConversation(db, "buyer", "p", "A valid question");
  assert.deepEqual(result, { conversationId: "existing", notificationId: "n", status: 201 });
  assert.deepEqual(calls, ["upsert", "message", "coalesce", "notify"]);
  assert.deepEqual(await startPrepurchaseConversation(db, "seller", "p", "A valid question"), { error: "CANNOT_MESSAGE_YOURSELF", status: 400 });
  assert.deepEqual(await startPrepurchaseConversation(db, "buyer", "p", "short"), { error: "INVALID_INPUT", status: 400 });
});
test("mobile conversation detail and send enforce conversation ownership", () => {
  const source = read("app/api/mobile/messages/[conversationId]/route.ts");
  assert.match(source, /conversationForUser\(prisma,\s*conversationId,\s*session\.userId\)/);
  assert.match(source, /sendConversationMessage\(prisma,\s*conversationId,\s*session\.userId/);
  assert.doesNotMatch(source, /body\.userId/);
});

test("web and native sends share the existing conversation transaction", () => {
  const web = read("app/api/conversations/[id]/messages/route.ts");
  const service = read("lib/conversation-messages.ts");
  assert.match(web, /sendConversationMessage/);
  assert.match(service, /\$transaction/);
  assert.match(service, /message\.create/);
  assert.match(service, /notification\.deleteMany/);
  assert.match(service, /notification\.create/);
});

test("mobile notifications are user-scoped and bounded", () => {
  const source = read("app/api/mobile/notifications/route.ts");
  assert.match(source, /readMobileSession\(request\)/);
  assert.match(source, /userId:\s*session\.userId/);
  assert.match(source, /(?:PAGE_)?SIZE\s*=\s*20/);
  assert.match(source, /Math\.min\(10000/);
});

test("notification read mutations cannot target another user", () => {
  const source = read("app/api/mobile/notifications/read/route.ts");
  assert.match(source, /readMobileSession\(request\)/);
  assert.match(source, /userId:\s*session\.userId/);
  assert.doesNotMatch(source, /body\.userId/);
});
