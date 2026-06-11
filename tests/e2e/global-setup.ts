/* eslint-disable no-console */
/**
 * Global setup for the Playwright suite.
 *
 * Creates a fresh test user (with a unique email per run) via the
 * production /api/auth/register endpoint, then runs the credentials
 * sign-in flow in a real browser context so NextAuth's CSRF tokens
 * and JWT session cookies are minted exactly the way a normal browser
 * would receive them. The resulting storage state is written to
 * `tests/e2e/.auth/user.json` and Playwright projects pick it up via
 * `test.use({ storageState })` in individual specs.
 *
 * The run ID is exposed via PLAYWRIGHT_RUN_ID so individual specs +
 * the global teardown can identify rows they own (test users + orgs +
 * donor lists + campaigns).
 */

import { chromium, request, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const STATE_DIR = path.join(__dirname, ".auth");
const STATE_FILE = path.join(STATE_DIR, "user.json");
const META_FILE = path.join(STATE_DIR, "meta.json");

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3100";
  const runId = Date.now().toString(36);
  process.env.PLAYWRIGHT_RUN_ID = runId;

  const email = `playwright-${runId}@vibrantcauses.test`;
  const password = "PlaywrightTest123!";
  const name = "Playwright Tester";
  const orgName = `Playwright Test Org ${runId}`;
  const mission = "Automated test fixture org for end-to-end testing.";

  fs.mkdirSync(STATE_DIR, { recursive: true });

  // ── Register via API (mirrors what the signup form does) ────────
  const api = await request.newContext({ baseURL });
  const reg = await api.post("/api/auth/register", {
    data: {
      name,
      email,
      password,
      orgName,
      mission,
      senderName: name,
      senderTitle: "QA Director",
      acceptTerms: true,
    },
  });
  if (!reg.ok()) {
    const body = await reg.text();
    throw new Error(`register failed (${reg.status()}): ${body}`);
  }
  await api.dispose();

  // ── Sign in via the browser so cookies match the runtime path ───
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("you@yourorg.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });

  await ctx.storageState({ path: STATE_FILE });
  await browser.close();

  fs.writeFileSync(
    META_FILE,
    JSON.stringify({ runId, email, password, name, orgName }, null, 2),
  );
  console.log(
    `[playwright] global setup complete · user=${email} runId=${runId}`,
  );
}
