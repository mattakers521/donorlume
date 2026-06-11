# Testing

DonorLume ships two kinds of automated coverage:

| Layer | What it covers | How to run |
| --- | --- | --- |
| Unit / pipeline | CSV detection + projection + RFM/engagement scoring | `npx tsx scripts/test-csv-formats.ts` |
| End-to-end | User flows in a real browser against the Next.js dev server | `npm run test:e2e` |

If you're touching scoring, detection, or any user-visible flow, run both before shipping. `npx tsc --noEmit` is a third gate worth running for type safety after schema or shared-type changes.

---

## CSV format / scoring regression suite

`scripts/test-csv-formats.ts` runs each fixture in `test-data/` through the exact upload pipeline (Papaparse → `detectColumns` → `projectRow` → year-bearing column scan → tag bag → `scoreAll` + `scoreEngagement`). PASS gates per file:

- Parses with zero Papaparse errors
- Name and email columns detected
- ≥ 80% of rows project to a usable record
- Score variance > 0 (the pipeline computes meaningful, non-constant output)

```bash
npx tsx scripts/test-csv-formats.ts
```

Expected output ends with:

```
✅ PASS  onecause-export.csv
✅ PASS  givebutter-export.csv
✅ PASS  salesforce-export.csv
✅ PASS  spreadsheet-manual.csv
✅ PASS  mailchimp-export.csv
5/5 files passed
```

Add new fixtures to `test-data/` and the `files` array in `scripts/test-csv-formats.ts` whenever you support a new CRM export shape.

---

## Playwright end-to-end suite

Runs Chromium against a real Next.js server. Covers:

1. **Landing page** renders the hero headline and primary CTAs.
2. **Signup flow** — email/password → account step → org step → dashboard.
3. **Mailchimp upload** — attendee-style CSV produces engagement scores in `/lapsed`.
4. **Salesforce upload** — donor-style CSV produces RFM tier badges in `/lapsed`.
5. **Outreach picker** — both uploaded contacts appear at `/outreach/new`.
6. **Draft generation** — selecting a recipient and clicking Generate produces a draft (the AI call is short-circuited by a deterministic test-mode shim so the test doesn't burn Anthropic credits).
7. **Reports page** — `/reports` loads with the org-scoped data the prior steps seeded.
8. **Admin gate** — non-admin users are redirected from `/admin` to `/dashboard`.

### Prerequisites

- Node 20+ (the repo's `~/.nvm/versions/node/v20.20.2` profile is fine).
- A reachable `DATABASE_URL` (Neon dev DB works; tests create + clean up their own user).
- `.env` populated with `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`. `ANTHROPIC_API_KEY` is **not** required — the suite sets `PLAYWRIGHT_TEST_MODE=true` which bypasses the upstream call.
- Chromium installed once: `npx playwright install chromium`.

### Run

```bash
npm run test:e2e
```

The runner:

1. Boots the dev server on port `3100` (configurable via `PLAYWRIGHT_PORT`) with `PLAYWRIGHT_TEST_MODE=true` in env.
2. Calls `/api/auth/register` to mint a fresh `playwright-<runId>@vibrantcauses.test` user + org, then signs in via the live login flow and saves the cookie jar to `tests/e2e/.auth/user.json`.
3. Runs every spec serially (one worker) because the flow tests build on each other's state.
4. Tears down: deletes the test user + cascaded org/lists/campaigns and removes the auth-state directory.

### Watch a single spec

```bash
npm run test:e2e -- tests/e2e/landing.spec.ts
```

### Debug a failure

```bash
npm run test:e2e:headed     # see the browser
npm run test:e2e:ui         # Playwright's interactive UI mode
```

Traces, screenshots, and videos for failing tests land in `playwright-report/` and `test-results/`. Open the HTML report with `npx playwright show-report`.

### Anthropic test shim

`lib/outreach/anthropic.ts` checks `process.env.PLAYWRIGHT_TEST_MODE === "true"` and returns a deterministic canned draft (`"Test subject for <Donor Name>"`) instead of calling Claude. This keeps the suite hermetic and free. The env var is set by `playwright.config.ts`'s `webServer.env` — do **not** set it in production `.env`.

### Re-running after a failed teardown

If the suite crashes between setup and teardown, you'll have a leftover `playwright-<id>@vibrantcauses.test` user in the DB. Clean it up manually:

```bash
npx tsx -e "import('@prisma/client').then(async ({ PrismaClient }) => {
  const db = new PrismaClient();
  const stale = await db.user.findMany({ where: { email: { startsWith: 'playwright-' } } });
  for (const u of stale) await db.user.delete({ where: { id: u.id } });
  console.log('deleted', stale.length);
  await db.\$disconnect();
});"
```

### What's intentionally not tested

- **Live Anthropic calls.** Covered by the test-mode shim instead.
- **Live Resend sends.** The send route requires a verified domain; covered only as a 502 path in unit-level checks.
- **Stripe checkout / webhooks.** Out of scope for the user-flow suite — those need Stripe test keys + the Stripe CLI for webhook tunneling.
- **Visual regression.** No baseline images yet; if we add them, drop them under `tests/e2e/__screenshots__/`.
