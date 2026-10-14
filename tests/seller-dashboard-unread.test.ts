import test from "node:test";
import assert from "node:assert/strict";
import { sellerUnreadMessageWhere } from "../lib/seller-dashboard-unread";

test("seller unread-message counts stay within the selected authorized store", () => {
  assert.deepEqual(sellerUnreadMessageWhere("team-user", ["assigned-store", "assigned-store"], true), {
    readAt: null,
    senderId: { not: "team-user" },
    conversation: { storeId: { in: ["assigned-store"] } },
  });
});

test("seller unread-message counts do not query outside permission or store scope", () => {
  assert.equal(sellerUnreadMessageWhere("team-user", ["assigned-store"], false), null);
  assert.equal(sellerUnreadMessageWhere("team-user", [], true), null);
});
