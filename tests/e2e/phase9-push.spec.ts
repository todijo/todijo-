import { expect,test } from "@playwright/test";

test("Stage 6B push endpoints require authentication and worker payload stays conservative",async({request})=>{const config=await request.get("/api/push/config"),subscribe=await request.post("/api/push/subscriptions",{data:{}}),worker=await request.get("/sw.js");expect(config.status()).toBe(401);expect(subscribe.status()).toBe(401);const source=await worker.text();expect(source).toContain('addEventListener("push"');expect(source).toContain("PUSH_PATH.test");expect(source).not.toContain("value?.title");expect(source).not.toContain("value?.body")});

test("notification permission is not requested on public launch",async({page})=>{await page.goto("/en/offline");const before=await page.evaluate(()=>Notification.permission);await page.reload();await expect(page.getByRole("heading").first()).toBeVisible();expect(await page.evaluate(()=>Notification.permission)).toBe(before)});
