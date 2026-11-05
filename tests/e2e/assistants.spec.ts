import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import {
  DOLLAR_RULE,
  PLAIN_TEXT_RULE,
  PLAIN_TEXT_RULE_SOCIAL,
  formatPromptDate,
} from "../../lib/ai/writing-rules";
import { parseCampaign } from "../../lib/assistants/campaign";
import { nextGivingTuesday } from "../../lib/assistants/catalog";
import {
  findMarkdown,
  findSpelledOutAmounts,
} from "../../lib/outreach/plain-text";
import { buildSystemPrompt } from "../../lib/outreach/prompt";

// Phase 1 · Feature 2 — AI Assistants hub.
// Uses its own fresh org (not the shared global-setup one) so the
// empty-profile state is guaranteed regardless of spec order. The
// playwright- email prefix lets global teardown reap it.
test.describe.configure({ mode: "serial" });

const PASSWORD = "PlaywrightAssist123!";
const PROFILE = {
  communityServed: "Indianapolis, IN — veterans and their families",
  focusAreas: ["Veterans", "Food security"],
};

let ctx: BrowserContext;
let page: Page;
let email: string;

test.beforeAll(async ({ browser }) => {
  email = `playwright-${Date.now().toString(36)}-assist@vibrantcauses.test`;
  page = await signUpAndSignIn(browser, email);
  ctx = page.context();
});

test.afterAll(async () => {
  await ctx?.close();
});

// ─── Shared writing rules (pure) ───────────────────────────────────────

test("plain-text check allows hashtags only where asked", () => {
  const post =
    "This #GivingTuesday, stand with us. Any gift helps. #Veterans #GiveBack";
  expect(findMarkdown(post, { allowHashtags: true })).toEqual([]);
  // In an email, the same tags are flagged.
  expect(findMarkdown(post)).toEqual(["hashtag"]);
  // Allowing hashtags doesn't let real markdown through.
  expect(findMarkdown("**Give** today #GivingTuesday", { allowHashtags: true }))
    .toEqual(["asterisk"]);
  // A markdown heading is still a heading, not a hashtag.
  expect(findMarkdown("# Our year", { allowHashtags: true })).toEqual([
    "heading (#)",
  ]);
});

test("dollar amounts must be digits: detector and both prompts", () => {
  expect(
    findSpelledOutAmounts(
      "A gift of twenty-five dollars, or even five dollars, or one hundred and fifty dollars.",
    ),
  ).toEqual([
    "twenty-five dollars",
    "five dollars",
    "one hundred and fifty dollars",
  ]);
  expect(
    findSpelledOutAmounts("Give $5, $10, or $25 — every dollar counts."),
  ).toEqual([]);

  // Outreach prompt carries the rule (Feature 1 rules kept alongside it).
  const outreach = buildSystemPrompt({
    orgName: "Rule Check Org",
    mission: "Serve veterans.",
    tone: "warm",
    emailType: "reactivation",
  })[0].text;
  expect(outreach).toContain(DOLLAR_RULE);
  expect(outreach).toContain(PLAIN_TEXT_RULE);
  expect(outreach).toContain("Never guess the year.");
  expect(outreach).toContain("- Never state a financial, impact, or use-of-funds claim");
});

test("Giving Tuesday date is the Tuesday after U.S. Thanksgiving", () => {
  const fmt = (d: Date) => formatPromptDate(nextGivingTuesday(d));
  expect(fmt(new Date("2026-11-04T15:00:00Z"))).toBe("Tuesday, December 1, 2026");
  expect(fmt(new Date("2026-12-01T15:00:00Z"))).toBe("Tuesday, December 1, 2026");
  // The day after rolls to next year (2027: Thanksgiving Nov 25).
  expect(fmt(new Date("2026-12-02T15:00:00Z"))).toBe("Tuesday, November 30, 2027");
  // 10pm Dec 1 in New York is already Dec 2 in UTC — still today.
  expect(fmt(new Date("2026-12-02T03:00:00Z"))).toBe("Tuesday, December 1, 2026");
});

test("campaign parser: structured output parses, anything else falls back to raw", () => {
  const good = [
    "CAMPAIGN BRIEF",
    "Audience: Past event attendees.",
    "Message arc: Thanks, then story, then ask.",
    "Timeline: Dec 1: Launch",
    "Dec 8: Story",
    "",
    "EMAIL 1",
    "Send: Dec 1, morning",
    "Subject: One",
    "",
    "Body one.",
    "",
    "**EMAIL 2**",
    "Send: Dec 8",
    "Subject: Two",
    "",
    "Body two.",
    "",
    "EMAIL 3",
    "Send: Dec 15",
    "Subject: Three",
    "",
    "Body three.\n\nWarmly,\nPat",
  ].join("\n");
  const parsed = parseCampaign(good);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(parsed.brief.timeline).toBe("Dec 1: Launch\nDec 8: Story");
    expect(parsed.emails.map((e) => e.subject)).toEqual(["One", "Two", "Three"]);
    expect(parsed.emails[2].body).toBe("Body three.\n\nWarmly,\nPat");
  }

  // Two emails instead of three, missing brief, empty body → raw text.
  const twoEmails = good.slice(0, good.indexOf("EMAIL 3"));
  expect(parseCampaign(twoEmails)).toEqual({ ok: false, raw: twoEmails.trim() });
  expect(parseCampaign("Just some ideas for a campaign.").ok).toBe(false);
  expect(parseCampaign(good.replace("Body two.", "")).ok).toBe(false);
});

// ─── Assistants page ───────────────────────────────────────────────────

test("empty profile: page asks for the profile first and the API refuses", async () => {
  await page.goto("/assistants");
  await expect(page.getByRole("heading", { name: "Content Writer" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Campaign Creator" })).toBeVisible();

  const gate = page.getByTestId("assistants-profile-gate");
  await expect(gate).toContainText("Complete your organization profile first");
  await expect(gate).toContainText("Community served, Focus areas");
  await expect(
    gate.getByRole("link", { name: /complete profile/i }),
  ).toHaveAttribute("href", "/settings/organization");
  // No silent generic output: every chip is disabled.
  for (const chip of ["Thank-you email", "Giving Tuesday campaign"]) {
    await expect(page.getByRole("button", { name: chip })).toBeDisabled();
  }

  const before = await remaining(page);
  const res = await page.request.post("/api/assistants/generate", {
    data: { assistantId: "content-writer", quickStartId: "thank-you-email" },
  });
  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("profile_incomplete");
  expect(body.missing).toEqual(["Community served", "Focus areas"]);
  // A refused request doesn't use a trial draft.
  await page.reload();
  expect(await remaining(page)).toBe(before);
});

test("Content Writer generates an editable email grounded in the profile", async () => {
  await fillProfile(email);
  await page.goto("/assistants");
  await expect(page.getByTestId("assistants-profile-gate")).toHaveCount(0);
  const writer = page.getByTestId("assistant-content-writer");
  await expect(writer).toContainText("Grounded in your organization profile");
  await expect(
    writer.getByRole("link", { name: "Edit profile" }),
  ).toHaveAttribute("href", "/settings/organization");

  const before = await remaining(page);
  await writer.getByRole("button", { name: "Thank-you email" }).click();
  const ws = page.getByTestId("assistant-workspace");
  await ws.getByLabel("Details to include (optional)").fill("Mention the new pantry.");
  await ws.getByRole("button", { name: "Generate" }).click();

  await expect(ws.getByLabel("Subject")).toHaveValue(/Test thank-you email from/);
  const bodyField = ws.getByLabel("Body");
  await expect(bodyField).toHaveValue(/Dear friend,/);
  // Editable in place.
  await bodyField.fill("Dear friend,\n\nEdited by hand.");
  await expect(bodyField).toHaveValue("Dear friend,\n\nEdited by hand.");
  expect(await remaining(page)).toBe(before - 1);
  await expect(ws.getByRole("alert")).toHaveCount(0);

  // The prompt assembly carries the profile and every shared rule.
  const { testPrompt, output } = await generateViaApi(
    "content-writer",
    "thank-you-email",
    "Mention the new pantry.",
  );
  expect(testPrompt.system).toContain(`- Community served: ${PROFILE.communityServed}`);
  expect(testPrompt.system).toContain(`- Focus areas: ${PROFILE.focusAreas.join(", ")}`);
  expect(testPrompt.system).toContain(`- Today's date: ${formatPromptDate(new Date())}`);
  expect(testPrompt.system).toContain("- Never state a financial, impact, or use-of-funds claim");
  expect(testPrompt.system).toContain(DOLLAR_RULE);
  expect(testPrompt.system).toContain(PLAIN_TEXT_RULE);
  expect(testPrompt.user).toContain("Mention the new pantry.");
  const text = `${output.subject}\n${output.body}`;
  expect(findMarkdown(text)).toEqual([]);
  expect(findSpelledOutAmounts(text)).toEqual([]);
});

test("Giving Tuesday post may use hashtags and knows the date", async () => {
  const { testPrompt, output } = await generateViaApi(
    "content-writer",
    "giving-tuesday-post",
  );
  expect(output.kind).toBe("text");
  expect(output.text).toContain("#GivingTuesday");
  expect(findMarkdown(output.text, { allowHashtags: true })).toEqual([]);
  expect(findSpelledOutAmounts(output.text)).toEqual([]);
  expect(testPrompt.system).toContain(PLAIN_TEXT_RULE_SOCIAL);
  expect(testPrompt.system).not.toContain(PLAIN_TEXT_RULE);
  expect(testPrompt.system).toContain(
    `- Giving Tuesday this year: ${formatPromptDate(nextGivingTuesday(new Date()))}`,
  );

  await page.goto("/assistants");
  await page.getByRole("button", { name: "Giving Tuesday post" }).click();
  const ws = page.getByTestId("assistant-workspace");
  await ws.getByRole("button", { name: "Generate" }).click();
  await expect(ws.getByLabel("Post")).toHaveValue(/#GivingTuesday/);
});

test("Campaign Creator returns a brief plus three emails and counts once", async () => {
  await page.goto("/assistants");
  const before = await remaining(page);
  await page.getByRole("button", { name: "Giving Tuesday campaign" }).click();
  const ws = page.getByTestId("assistant-workspace");
  await ws.getByRole("button", { name: "Generate" }).click();

  const out = ws.getByTestId("campaign-output");
  await expect(out.getByLabel("Audience")).toHaveValue(/Supporters of/);
  await expect(out.getByLabel("Message arc")).toHaveValue(/Gratitude first/);
  await expect(out.getByLabel("Timeline")).toHaveValue(
    "Day 1: Launch email\nDay 7: Story email\nDay 14: Final ask",
  );
  for (const [i, subject] of [
    "Test launch email",
    "Test story email",
    "Test final ask",
  ].entries()) {
    const card = out.getByTestId(`campaign-email-${i + 1}`);
    await expect(card.getByLabel("Subject")).toHaveValue(subject);
    await expect(card.getByLabel("Body")).toHaveValue(/Dear friend,/);
  }
  // Brief + 3 emails = ONE generation toward the cap (page counter and server).
  await expect(page.getByTestId("trial-ai-remaining")).toHaveText(
    `${before - 1} left`,
  );
  await page.reload();
  expect(await remaining(page)).toBe(before - 1);
});

test("unstructured Campaign Creator output is shown as raw text, never an error", async () => {
  await page.goto("/assistants");
  await page.getByRole("button", { name: "30-day challenge" }).click();
  const ws = page.getByTestId("assistant-workspace");
  // Test-mode marker: the canned output skips the structured format.
  await ws
    .getByLabel("Details to include (optional)")
    .fill("PLAYWRIGHT_UNSTRUCTURED");
  await ws.getByRole("button", { name: "Generate" }).click();

  await expect(ws.getByLabel("Campaign draft")).toHaveValue(
    /deliberately skips the structured format/,
  );
  await expect(ws.getByTestId("campaign-output")).toHaveCount(0);
  await expect(ws.getByRole("alert")).toHaveCount(0);
  // (Page-wide role=alert would match Next's empty route announcer.)
  await expect(page.getByText(/went wrong|error|couldn.t/i)).toHaveCount(0);
});

test("Use in AI Outreach prefills a new campaign", async () => {
  await page.goto("/assistants");
  await page.getByRole("button", { name: "Year-end appeal" }).click();
  const ws = page.getByTestId("assistant-workspace");
  await ws.getByRole("button", { name: "Generate" }).click();
  await ws.getByLabel("Body").fill("Dear friend,\n\nHand-edited year-end note.");
  await ws.getByRole("button", { name: /use in ai outreach/i }).click();

  await page.waitForURL(/\/outreach\/new\?from=assistant/);
  // This org has no donors yet, so outreach asks for an upload first;
  // the sample-data path keeps the handoff.
  await page.getByRole("link", { name: /try the wizard with sample data/i }).click();
  await page.waitForURL(/samples=true&from=assistant/);
  const instructions = page.getByPlaceholder("e.g. Mention our June 14 gala…");
  await expect(instructions).toHaveValue(/Use this approved draft as the starting point/);
  await expect(instructions).toHaveValue(/Subject: Test year-end appeal from/);
  await expect(instructions).toHaveValue(/Hand-edited year-end note\./);
});

test("outreach drafts and assistant generations share one trial counter", async () => {
  await page.goto("/outreach");
  const before = await remaining(page);
  const campaignRes = await page.request.post("/api/outreach/campaigns", {
    data: { name: "Shared cap check", tone: "warm", emailType: "reactivation" },
  });
  expect(campaignRes.status()).toBe(201);
  const { campaign } = await campaignRes.json();
  const draftRes = await page.request.post("/api/outreach/drafts", {
    data: {
      campaignId: campaign.id,
      donorId: null,
      promptConfig: { orgName: "Assist Org", mission: "Serve veterans." },
      donor: { name: "Cap Donor" },
    },
  });
  expect(draftRes.status()).toBe(201);
  const { testPrompt } = await draftRes.json();
  expect(testPrompt.system).toContain(DOLLAR_RULE);

  await page.goto("/assistants");
  expect(await remaining(page)).toBe(before - 1);
});

// ─── helpers ───────────────────────────────────────────────────────────

/** "N left" from the trial counter (the fresh org is in an unpaid trial). */
async function remaining(p: Page): Promise<number> {
  const text = await p.getByTestId("trial-ai-remaining").textContent();
  const n = Number(text?.match(/(\d+) left/)?.[1]);
  expect(Number.isFinite(n)).toBe(true);
  return n;
}

async function generateViaApi(
  assistantId: string,
  quickStartId: string,
  notes?: string,
) {
  const res = await page.request.post("/api/assistants/generate", {
    data: { assistantId, quickStartId, notes },
  });
  expect(res.status()).toBe(200);
  return (await res.json()) as {
    output: { kind: string; subject: string; body: string; text: string };
    testPrompt: { system: string; user: string };
  };
}

async function fillProfile(userEmail: string) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: userEmail },
      include: { orgs: true },
    });
    await prisma.organization.update({
      where: { id: user.orgs[0]!.orgId },
      data: PROFILE,
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function signUpAndSignIn(browser: Browser, userEmail: string): Promise<Page> {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const p = await context.newPage();
  const reg = await p.request.post("/api/auth/register", {
    data: {
      name: "Assist Tester",
      email: userEmail,
      password: PASSWORD,
      orgName: "Playwright Assistants Org",
      mission: "Helping veterans and their families get back on their feet.",
      senderName: "Assist Tester",
      senderTitle: "Development Director",
      acceptTerms: true,
    },
  });
  expect(reg.status()).toBe(201);
  await p.goto("/login");
  await p.getByPlaceholder("you@yourorg.com").fill(userEmail);
  await p.getByPlaceholder("••••••••").fill(PASSWORD);
  await p.getByRole("button", { name: /sign in/i }).click();
  await p.waitForURL(/\/dashboard$/, { timeout: 30_000 });
  return p;
}
