import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("mobile message list derives identity from MobileSession", () => {
  const source = read("app/api/mobile/messages/route.ts");
  assert.match(source, /readMobileSession\(request\)/);
  assert.match(source, /session\.userId/);
  assert.doesNotMatch(source, /body\.userId|searchParams\.get\(["']userId/);
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
