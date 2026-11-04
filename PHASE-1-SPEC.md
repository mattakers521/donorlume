# DonorLume Phase 1 Spec — Fundraising Layer (Nov 2026)

**Read this whole document before writing any code. Follow the Build Rules section exactly. One feature at a time, in order. Do not start a feature until the previous one is done per the Definition of Done.**

---

## Context

DonorLume (donorlume.com, repo `mattakers521/donorlume`) is a live multi-tenant donor intelligence SaaS: CSV upload → engagement/RFM scoring → AI outreach drafting → send via Resend → open tracking. Stack: Next.js on Vercel (auto-deploys from `main`), Neon Postgres (free tier — cold starts happen), Prisma, Resend (verified sender: hello@donorlume.com), Anthropic API for drafting, Stripe in TEST mode, Google OAuth. Admin console gated to matt.akers@vibrantcauses.com.

Last known good state: `main` at commit `19b6cd6` ("Flow audit: close the signup-to-first-send gaps"), 8/8 Playwright tests green (`npm run test:e2e`, port 3100, `PLAYWRIGHT_TEST_MODE` shim in `lib/outreach/anthropic.ts` returns canned drafts and is production-guarded).

**Phase 1 goal:** evolve DonorLume from "score + email" into a fundraising workspace by adding three features: an Organization Profile that grounds all AI output, an AI Assistants hub, and public Need/Impact Cards. This phase moves NO money.

---

## Phase 0 — Health check (required first, its own session)

Before any new feature:

1. `git status` — confirm on `main`, clean tree, synced with `origin/main`.
2. `npm install` — flag any security advisories; do not upgrade major versions without asking.
3. `npm run build` — must pass.
4. `npm run test:e2e` — all 8 existing Playwright tests must pass. Neon cold starts can cause transient DB connection failures (P1001); retry once before diagnosing.
5. Confirm the production deployment on Vercel is "Ready" and donorlume.com loads.
6. Report status in plain language: what passed, what failed, what looks stale. If anything fails, diagnose and propose a fix — get approval before changing code.

**Do not begin Feature 1 until Phase 0 is fully green and Matt has confirmed.**

---

## Feature 1 — Organization Profile ("Your Why")

The profile is the foundation: every AI feature in Phase 1 reads from it.

**Data (Prisma migration on the org/tenant model):**
- `missionStatement` (text — "our why," 2–4 sentences)
- `communityServed` (short text, e.g. "Indianapolis, IN — veterans and their families")
- `focusAreas` (string array / tags, e.g. ["Veterans", "Food security"])
- `websiteUrl`, `donationPageUrl` (the org's existing external giving page — used by Feature 3)
- `logoUrl` (optional; simple upload or URL field — do not build a media library)

**UI:**
- New "Organization Profile" section in Settings, matching the existing Apple Warm aesthetic (Instrument Serif + Plus Jakarta Sans, amber #E8860C).
- Profile-strength indicator (simple % complete based on filled fields).
- Add "Complete your organization profile" as an item in the existing dashboard onboarding checklist.

**Wiring:**
- Inject profile fields into the outreach prompt context in `lib/outreach/prompt.ts` so every draft is grounded in the org's mission, community, and focus areas. Keep the existing lapsed-reactivation rules (thank first, story second, soft ask, no guilt vocabulary) intact.

**Tests (add to Playwright suite):**
- Save and reload profile fields.
- Profile completeness updates.
- A generated draft in test mode receives profile context (assert the prompt assembly includes it; canned output is fine).

---

## Feature 2 — AI Assistants hub

Package AI drafting into named assistants with one-click starting points, all grounded in the Feature 1 profile. Reuse the existing Anthropic client, prompt patterns, and `PLAYWRIGHT_TEST_MODE` shim — do not create a second AI pipeline.

**Assistants (Phase 1 scope — exactly two):**
1. **Content Writer** — quick-starts: Thank-you email, Year-end appeal, Giving Tuesday post, Newsletter blurb. Output is editable text the user copies or pushes into the existing outreach flow.
2. **Campaign Creator** — quick-starts: Giving Tuesday campaign, 30-day challenge, Event follow-up. Output: a campaign brief (audience, message arc, timeline) plus a 3-email sequence draft.

**UI:**
- An "Assistants" page: one card per assistant with description and quick-start chips; clicking a chip opens a simple generate → edit → copy/save flow.
- Each assistant visibly shows what context it used ("Grounded in your organization profile" with a link to edit it).

**Explicitly NOT in scope:** a chat interface, a "Donor Researcher" that searches the web, or anything calling external data sources.

**Tests:** each assistant generates in test mode with canned output; empty-profile state prompts the user to complete their profile first (no silent generic output).

---

## Feature 3 — Need Cards & Impact Cards (no payments)

Public, shareable fundraising pages that close the transparency loop. **Phase 1 moves no money:** the donate button links OUT to the org's existing `donationPageUrl` (or a per-card override URL). Progress is updated manually by the org.

**Data (new `Card` model):**
- `type` ("need" | "impact"), `title`, `story` (text), `category`, `location`
- Need fields: `goalAmount`, `raisedAmount` (manual entry), `deadline`, `donateUrl` (defaults to org `donationPageUrl`)
- Impact fields: `outcomeSummary`, `dollarsInvested`, `volunteersMobilized`, `hoursDonated`
- `status` (draft | published | fulfilled), `slug`, optional `linkedNeedCardId` (an Impact Card can close the loop on a Need Card)
- Org-scoped; enforce tenant isolation exactly like existing models.

**Public page:**
- Route: `/c/[orgSlug]/[cardSlug]` — no auth required, published cards only.
- Need Card: title, story, progress bar (raised/goal), deadline, location, prominent "Give now" button → external `donateUrl` (opens new tab), org name + logo from profile.
- Impact Card: outcomes, dollars invested, volunteers, hours, linked Need Card reference if present.
- Proper OG/Twitter meta tags so cards unfurl correctly when shared (title, story excerpt, org name).
- Mobile-first layout; these get opened from social and SMS.

**Dashboard:**
- "Cards" section: list, create, edit, publish/unpublish, update raised amount, "Mark fulfilled → create Impact Card" flow that pre-fills from the Need Card.
- AI assist button: "Draft this card for me" — user gives 2–3 bullets, Content Writer plumbing generates title + story grounded in the org profile.

**Tests:** create/publish card; public page renders for an unauthenticated visitor; unpublished card returns 404; donate button carries the correct external URL; OG tags present; tenant isolation (org A cannot see org B's cards).

---

## Build Rules (non-negotiable — from BUILD-RULES-FOR-FUTURE-PROJECTS.md)

1. **One feature at a time.** Finish Feature 1 before touching Feature 2.
2. **Tests alongside features.** Every feature lands with its Playwright coverage; the full suite (existing 8 + new) must be green before any push.
3. **Real data before "ready."** Verify each feature against the real VETLIFE org data already in the system, not just seeded samples.
4. **No "Coming Soon" placeholders.** If it isn't built, it doesn't appear in the UI.
5. **`main` auto-deploys to donorlume.com.** Never push until build + full test suite are green locally. Work in small commits; push only at feature completion.
6. **Production guards.** Any test-mode or sample-data behavior must be production-guarded like the existing `PLAYWRIGHT_TEST_MODE` shim.
7. **Ship when genuinely ready.** Code passing is not "done" — done includes Matt's manual walkthrough (below).

---

## Explicit non-goals for Phase 1

- No payment processing (no Stripe Connect, no donation checkout, no receipts)
- No Grant Finder (Phase 2), no corporate sponsor finder (Phase 3)
- No public org directory/marketplace, no "nonprofit brain"
- No pricing/billing changes (Stripe stays in test mode)

---

## Definition of Done

**Per feature:** migration applied, UI matches existing design system, new tests green, full suite green, feature verified with VETLIFE data, committed and pushed, production deploy Ready.

**Phase 1 done:** all three features live; Matt completes an incognito walkthrough — fresh signup → complete org profile → generate with each assistant → create, publish, and share a Need Card → mark it fulfilled into an Impact Card — with zero confusion points. The bar remains: "would Cortnie understand this without Matt on the phone?"
