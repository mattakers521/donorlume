import { expect, test, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

import { findMarkdown } from "../../lib/outreach/plain-text";
import { formatPromptDate } from "../../lib/outreach/prompt";

// Phase 1 · Feature 1 — Organization Profile ("Your Why").
// Shares the global-setup user. That user signs up with a name +
// mission only, so the profile starts at 1 of 6 fields (17%).
test.use({ storageState: "tests/e2e/.auth/user.json" });
test.describe.configure({ mode: "serial" });

const PROFILE = {
  community: "Indianapolis, IN — veterans and their families",
  focusAreas: ["Veterans", "Food security"],
  website: "vetlife-test.example.org",
  donationPage: "vetlife-test.example.org/give",
  logo: "https://vetlife-test.example.org/logo.png",
};

const strengthPercent = (page: Page) =>
  page.getByTestId("profile-strength-percent");

async function save(page: Page) {
  await page.getByRole("button", { name: "Save profile" }).click();
}

test("fresh org shows a partial profile and an open checklist step", async ({
  page,
}) => {
  await page.goto("/settings/organization");
  await expect(
    page.getByRole("heading", { name: "Your why" }),
  ).toBeVisible();
  await expect(strengthPercent(page)).toHaveText("17%");
  // The signup user is the org OWNER — full edit access.
  await expect(page.getByText("View only")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save profile" })).toBeVisible();

  await page.goto("/dashboard");
  const step = page.getByTestId("onboarding-step-profile");
  await expect(step).toContainText("Complete your organization profile");
  await expect(step).toHaveAttribute("data-done", "false");
  // CTA lands on the profile page, not generic Preferences.
  await expect(
    step.getByRole("link", { name: /complete profile/i }),
  ).toHaveAttribute("href", "/settings/organization");
});

test("rejects a non-web URL", async ({ page }) => {
  await page.goto("/settings/organization");
  await page.getByLabel("Website").fill("javascript:alert(1)");
  await save(page);
  await expect(
    page.getByText("Website must start with http:// or https://."),
  ).toBeVisible();
  await expect(strengthPercent(page)).toHaveText("17%");
});

test("saves and reloads every profile field", async ({ page }) => {
  await page.goto("/settings/organization");

  await page.getByLabel("Community served").fill(PROFILE.community);
  const focus = page.getByLabel("Focus areas");
  // Enter commits a tag (and must NOT submit the form)…
  await focus.fill(PROFILE.focusAreas[0]);
  await focus.press("Enter");
  // …and so does a comma.
  await focus.pressSequentially(`${PROFILE.focusAreas[1]},`);
  await expect(page.getByTestId("focus-area-tag")).toHaveText(
    PROFILE.focusAreas,
  );
  await expect(page.getByText("Organization profile saved.")).toHaveCount(0);

  // Bare domains are accepted and normalized to https.
  await page.getByLabel("Website").fill(PROFILE.website);
  await page.getByLabel("Donation page").fill(PROFILE.donationPage);
  await page.getByLabel("Logo URL").fill(PROFILE.logo);
  await save(page);

  await expect(page.getByText("Organization profile saved.")).toBeVisible();
  await expect(strengthPercent(page)).toHaveText("100%");

  await page.reload();
  await expect(page.getByLabel("Community served")).toHaveValue(
    PROFILE.community,
  );
  await expect(page.getByTestId("focus-area-tag")).toHaveText(
    PROFILE.focusAreas,
  );
  await expect(page.getByLabel("Website")).toHaveValue(
    `https://${PROFILE.website}/`,
  );
  await expect(page.getByLabel("Donation page")).toHaveValue(
    `https://${PROFILE.donationPage}`,
  );
  await expect(page.getByLabel("Logo URL")).toHaveValue(PROFILE.logo);
  await expect(strengthPercent(page)).toHaveText("100%");
});

test("profile completeness updates when a field is cleared", async ({
  page,
}) => {
  await page.goto("/settings/organization");
  await page.getByLabel("Logo URL").fill("");
  await save(page);
  await expect(page.getByText("Organization profile saved.")).toBeVisible();
  await expect(strengthPercent(page)).toHaveText("83%");
  await expect(
    page
      .getByRole("region", { name: "Profile strength" })
      .getByText("Logo", { exact: true }),
  ).toBeVisible();

  // Logo is optional — the profile still grounds AI output, so the
  // onboarding step is complete.
  await page.goto("/dashboard");
  await expect(page.getByTestId("onboarding-step-profile")).toHaveAttribute(
    "data-done",
    "true",
  );
});

/** Creates a campaign and one test-mode draft; returns the assembled prompt. */
async function generateTestDraft(
  page: Page,
  donor: Record<string, unknown>,
): Promise<{ subject: string; body: string; system: string; user: string }> {
  const campaignRes = await page.request.post("/api/outreach/campaigns", {
    data: {
      name: "Profile grounding check",
      tone: "warm",
      emailType: "reactivation",
    },
  });
  expect(campaignRes.status()).toBe(201);
  const { campaign } = await campaignRes.json();

  const draftRes = await page.request.post("/api/outreach/drafts", {
    data: {
      campaignId: campaign.id,
      donorId: null,
      promptConfig: {
        orgName: "Playwright Test Org",
        mission: "Automated test fixture org for end-to-end testing.",
        senderName: "Playwright Tester",
        senderTitle: "QA Director",
      },
      donor,
    },
  });
  expect(draftRes.status()).toBe(201);
  const body = await draftRes.json();
  return {
    subject: body.draft.subject,
    body: body.draft.body,
    system: body.testPrompt.system,
    user: body.testPrompt.user,
  };
}

const NO_LINK_RULE =
  "- No donation link is available. Do not include any URL, link, or link placeholder (such as [donation link]).";

/** Same format as lib/outreach/prompt.ts formatPromptDate (America/New_York). */
const promptDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

test("the outreach prompt carries today's date and the no-claims rule", async ({
  page,
}) => {
  const before = promptDate(new Date());
  const prompt = await generateTestDraft(page, { name: "Date Check Donor" });
  const after = promptDate(new Date());
  // Tolerate a run that straddles midnight in New York.
  const dateLine = prompt.system
    .split("\n")
    .find((l) => l.startsWith("- Today's date: "));
  expect([`- Today's date: ${before}`, `- Today's date: ${after}`]).toContain(
    dateLine,
  );
  expect(dateLine).toMatch(/, \d{4}$/);
  // Evening in New York is already "tomorrow" in UTC — the prompt must
  // still say today. 10:30pm EST Nov 4 = 03:30 UTC Nov 5.
  expect(formatPromptDate(new Date("2026-11-05T03:30:00Z"))).toBe(
    "Wednesday, November 4, 2026",
  );
  // DST is handled too: 11pm EDT July 4 = 03:00 UTC July 5.
  expect(formatPromptDate(new Date("2026-07-05T03:00:00Z"))).toBe(
    "Saturday, July 4, 2026",
  );
  expect(prompt.system).toContain("Never guess the year.");
  expect(prompt.system).toContain(
    "- Never state a financial, impact, or use-of-funds claim",
  );
  expect(prompt.system).toContain("every dollar stays right here");
});

test("drafts are plain text: the prompt forbids markdown and the draft has none", async ({
  page,
}) => {
  // The detector catches what a real draft slipped in before this rule…
  expect(findMarkdown("a way of saying *I'm with you* to every veteran")).toEqual(
    ["asterisk"],
  );
  expect(findMarkdown("**Bold** and _italic_\n- a bullet\n# Heading")).toEqual([
    "asterisk",
    "underscore",
    "heading (#)",
    "bullet symbol",
  ]);
  // …and passes ordinary prose (em dashes, $ amounts, apostrophes).
  expect(
    findMarkdown("Join us at $5, $10, or $25 a month — it's simple.\n\nWarmly,\nMatt"),
  ).toEqual([]);

  const draft = await generateTestDraft(page, { name: "Plain Text Donor" });
  expect(draft.system).toContain(
    "- Write in plain text only. No markdown or formatting characters",
  );
  expect(findMarkdown(`${draft.subject}\n${draft.body}`)).toEqual([]);
});

test("a generated draft is grounded in the profile", async ({ page }) => {
  const prompt = await generateTestDraft(page, {
    name: "Grounding Donor",
    totalGifts: 6,
    totalGiven: 1200,
    lastGiftLabel: "Mar 2024",
    lapsedMonths: 20,
  });

  // Canned test-mode draft still flows through persistence…
  expect(prompt.subject).toBe("Test subject for Grounding Donor");
  // …and the assembled prompt carries the saved profile.
  expect(prompt.system).toContain(`- Community served: ${PROFILE.community}`);
  expect(prompt.system).toContain(
    `- Focus areas: ${PROFILE.focusAreas.join(", ")}`,
  );
  expect(prompt.system).toContain(
    "- Mission: Automated test fixture org for end-to-end testing.",
  );
  // Saved donation page is handed over verbatim, with the only-this-URL rule.
  expect(prompt.system).toContain(
    `- Donation page: https://${PROFILE.donationPage}`,
  );
  expect(prompt.system).toContain(
    "- If the email invites a gift, link to the donation page exactly as written above.",
  );
  expect(prompt.system).not.toContain(NO_LINK_RULE);
  // Signature is spelled out exactly — no org name may be merged in.
  expect(prompt.system).toContain(
    '"Playwright Tester" on one line, then "QA Director" on the next. Do not add an organization name',
  );
  // Lapsed-reactivation rules are untouched: thank first, story
  // second, soft landing, no guilt vocabulary.
  expect(prompt.user).toContain("FIRST-TOUCH REACTIVATION");
  expect(prompt.user).toContain("1. THANK FIRST.");
  expect(prompt.user).toContain("2. STORY SECOND.");
  expect(prompt.user).toContain("3. SOFT LANDING.");
  expect(prompt.user).toContain("we haven't seen you in a while");
});

test("without a donation page the prompt forbids links and placeholders", async ({
  page,
}) => {
  await page.goto("/settings/organization");
  await page.getByLabel("Donation page").fill("");
  await save(page);
  await expect(page.getByText("Organization profile saved.")).toBeVisible();

  const prompt = await generateTestDraft(page, { name: "Attendee Donor" });
  expect(prompt.system).not.toContain("- Donation page:");
  expect(prompt.system).toContain(NO_LINK_RULE);
  expect(prompt.system).toContain(
    "ask the reader to simply reply to this email to learn how to give",
  );
  // Attendee (no gifts) still routes through first-time conversion.
  expect(prompt.user).toContain("FIRST-TIME CONVERSION CONTEXT");
});

// ─── Role restriction: only OWNER / ADMIN may edit ─────────────────────

const META_FILE = path.join(__dirname, ".auth", "meta.json");
const TEAM_PASSWORD = "PlaywrightTeam123!";

/**
 * Adds a MEMBER or VIEWER to the shared test org directly in the DB.
 * (The invite flow would leave the invitee with a second, self-created
 * org, which makes "which org loads" ambiguous for this assertion.)
 * Emails use the playwright- prefix so global teardown reaps them.
 */
async function addTeammate(role: "MEMBER" | "VIEWER"): Promise<string> {
  const meta = JSON.parse(fs.readFileSync(META_FILE, "utf8")) as {
    runId: string;
    email: string;
  };
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: meta.email },
      include: { orgs: true },
    });
    const orgId = owner.orgs[0]!.orgId;
    const email = `playwright-${meta.runId}-${role.toLowerCase()}@vibrantcauses.test`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: `Playwright ${role}`,
        passwordHash: await bcrypt.hash(TEAM_PASSWORD, 4),
        termsAcceptedAt: new Date(),
        orgs: { create: { orgId, role } },
      },
    });
    return email;
  } finally {
    await prisma.$disconnect();
  }
}

async function signInAs(browser: Browser, email: string): Promise<Page> {
  // Explicitly empty: otherwise the file-level `test.use({ storageState })`
  // carries the OWNER's session into this context and /login bounces
  // straight to /dashboard.
  const ctx = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("you@yourorg.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(TEAM_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });
  return page;
}

for (const role of ["VIEWER", "MEMBER"] as const) {
  test(`${role.toLowerCase()} sees the profile read-only and the server refuses edits`, async ({
    browser,
  }) => {
    const email = await addTeammate(role);
    const page = await signInAs(browser, email);

    await page.goto("/settings/organization");
    // They can read the saved profile…
    await expect(page.getByLabel("Community served")).toHaveValue(
      PROFILE.community,
    );
    await expect(page.getByText("View only")).toBeVisible();
    // …but every field is disabled and there's no Save button.
    await expect(page.getByLabel("Community served")).toBeDisabled();
    await expect(page.getByLabel("Mission")).toBeDisabled();
    await expect(page.getByLabel("Focus areas")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Save profile" }),
    ).toBeHidden();

    // Bypass the UI entirely: re-enable the form in the DOM and submit.
    // The Server Action must still refuse.
    await page.evaluate(() => {
      const form = document.querySelector("form")!;
      form.querySelector("fieldset")!.disabled = false;
      const field = form.querySelector<HTMLInputElement>(
        'input[name="communityServed"]',
      )!;
      field.value = "Tampered by a read-only user";
      form.requestSubmit();
    });
    await expect(
      page.getByText(
        "Only owners and admins can edit the organization profile.",
      ),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Community served")).toHaveValue(
      PROFILE.community,
    );
    await page.context().close();
  });
}
