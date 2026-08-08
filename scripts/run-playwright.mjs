import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const serverEnvironment = {
  ...process.env,
  DATABASE_URL: "postgresql://e2e:e2e@127.0.0.1:5432/todijo_e2e?schema=public",
  APP_URL: baseURL,
  SESSION_SECRET: "e2e-only-placeholder-secret-at-least-32-characters",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  STRIPE_CONNECT_REFRESH_URL: "",
  STRIPE_CONNECT_RETURN_URL: "",
  STRIPE_SELLER_BASIC_PRICE_ID: "",
  STRIPE_SELLER_PRO_PRICE_ID: "",
  SMTP_USER: "",
  SMTP_PASS: "",
  R2_ACCOUNT_ID: "",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  R2_BUCKET_NAME: "",
  TURNSTILE_SECRET_KEY: "",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
};
const nextCli = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const playwrightCli = join(process.cwd(), "node_modules", "@playwright", "test", "cli.js");
const server = spawn(process.execPath, [nextCli, "dev", "--hostname", "localhost", "--port", "3100"], {
  env: serverEnvironment,
  stdio: "ignore",
});

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode != null) throw new Error(`Next.js exited before E2E startup (code ${server.exitCode}).`);
    try {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the local E2E server.");
}

function stopServer() {
  if (!server.pid || server.exitCode != null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
}

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await new Promise((resolve, reject) => {
    const tests = spawn(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
      env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL },
      stdio: "inherit",
    });
    tests.once("error", reject);
    tests.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
} finally {
  stopServer();
}

process.exitCode = exitCode;
