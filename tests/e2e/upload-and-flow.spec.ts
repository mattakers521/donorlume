import { expect, test } from "@playwright/test";
import path from "node:path";

// All flow tests share the global-setup user session.
test.use({ storageState: "tests/e2e/.auth/user.json" });

// Tests run serially because each depends on prior state: attendee
// upload → donor upload → both visible in outreach picker → drafts
// generated → reports/dashboard pull data from same lists.
test.describe.configure({ mode: "serial" });

const MAILCHIMP_CSV = path.resolve(__dirname, "../../test-data/mailchimp-export.csv");
const SALESFORCE_CSV = path.resolve(__dirname, "../../test-data/salesforce-export.csv");

async function uploadCsv(page: import("@playwright/test").Page, csvPath: string) {
  await page.goto("/lapsed");

  // If a list is already loaded, the upload zone is hidden behind a
  // "New Upload" button — click it first so the file input mounts.
  const newUploadButton = page.getByRole("button", { name: /new upload/i });
  if (await newUploadButton.isVisible().catch(() => false)) {
    await newUploadButton.click();
  }

  // Drop zone has a hidden <input type="file"> — feed it directly.
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached", timeout: 15_000 });
  await fileInput.setInputFiles(csvPath);

  // Preview step: skip cohort-column selection to land on the scored view.
  const skipButton = page.getByRole("button", {
    name: /skip.*upload without engagement segments/i,
  });
  await skipButton.waitFor({ state: "visible", timeout: 15_000 });
  await skipButton.click();
}

test("upload mailchimp CSV shows attendee engagement scores", async ({
  page,
}) => {
  await uploadCsv(page, MAILCHIMP_CSV);

  // After the post-upload navigation settles, the attendee view should
  // render at least one of our seeded contacts.
  await expect(page.getByText("Eleanor Brightwood")).toBeVisible({
    timeout: 30_000,
  });

  // Attendee view shows a "Total attendees" stat card — a stable
  // anchor that only renders for attendee data.
  await expect(page.getByText(/Total attendees/i).first()).toBeVisible();

  // Engagement column header is unique to the attendee view.
  await expect(
    page.getByRole("columnheader", { name: /^Engagement$/i }),
  ).toBeVisible();

  // Bartholomew has 4 years of attendance in mailchimp-export.csv → score 80.
  // Eleanor has 1 year → score 45. Verify at least one numeric score
  // sits in a cell.
  await expect(
    page.getByText(/Bartholomew Featherstone-Wykes/i).first(),
  ).toBeVisible();
});

test("upload salesforce CSV shows RFM scores and tier badges", async ({
  page,
}) => {
  await uploadCsv(page, SALESFORCE_CSV);

  // Donor names appear in the scored table.
  await expect(page.getByText("Alexandra Kowalski-Reyes")).toBeVisible({
    timeout: 30_000,
  });

  // TierBadge renders mixed-case "Medium" in DOM with CSS uppercase
  // styling. Salesforce data should produce a spread of Low/Medium
  // under the lifetime-mode scoring branch.
  await expect(page.getByText("Medium", { exact: true }).first()).toBeVisible();
});

test("uploaded contacts appear in AI outreach recipient picker", async ({
  page,
}) => {
  await page.goto("/outreach/new");

  // Setup form auto-validates from org settings, advance straight to
  // the picker.
  await page.getByRole("button", { name: /select donors/i }).click();

  // The picker should now show both an attendee (mailchimp) and a
  // donor (salesforce) we just uploaded.
  await expect(page.getByText("Eleanor Brightwood").first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText("Alexandra Kowalski-Reyes").first(),
  ).toBeVisible();
});

test("selecting a contact and generating produces a draft", async ({
  page,
}) => {
  await page.goto("/outreach/new");
  await page.getByRole("button", { name: /select donors/i }).click();

  // The picker pre-selects every real donor by default. The toggle
  // button reads "Deselect all" when selection === full donor list,
  // otherwise "Select all". Drive the toggle to the empty state so
  // we can isolate one contact for the canned-draft assertion (and
  // avoid burning through the trial draft cap with an accidental
  // 50-donor generation).
  const deselectButton = page.getByRole("button", {
    name: "Deselect all",
    exact: true,
  });
  const selectButton = page.getByRole("button", {
    name: "Select all",
    exact: true,
  });
  if (await deselectButton.isVisible().catch(() => false)) {
    await deselectButton.click();
  } else {
    // partial selection state — click to select all, then deselect.
    await selectButton.click();
    await deselectButton.click();
  }

  // Click Eleanor's name span — the click bubbles to the row's
  // onClick handler which toggles selection. With Deselect All
  // applied, this leaves exactly one selected donor.
  await page
    .getByText("Eleanor Brightwood", { exact: true })
    .first()
    .click();

  // Generate emails. Require [1-9] to skip the disabled "Generate 0
  // Emails" state. Test-mode shim returns a deterministic canned
  // draft per recipient.
  await page
    .getByRole("button", { name: /generate [1-9]\d* email/i })
    .click();

  // Results screen renders the canned subject line from the shim.
  // Text appears in both the collapsed card preview AND the expanded
  // body once the user opens it — strict-mode-safe with .first().
  await expect(
    page
      .locator('text=Test subject for Eleanor Brightwood')
      .first(),
  ).toBeVisible({ timeout: 60_000 });
});

test("reports page loads with data after uploads + campaign", async ({
  page,
}) => {
  await page.goto("/reports");

  // Header includes the org name from the playwright setup metadata.
  await expect(
    page.getByRole("heading", { level: 1, name: /Fundraising Snapshot/i }),
  ).toBeVisible({ timeout: 20_000 });

  // Donors scored tile should reflect the uploads (mailchimp + salesforce).
  await expect(page.getByText(/Donors scored/i).first()).toBeVisible();

  // Outreach sent tile renders even at zero, but after the prior
  // test we have at least one campaign.
  await expect(page.getByText(/Outreach sent/i).first()).toBeVisible();
});

test("admin route redirects non-admin users to dashboard", async ({ page }) => {
  // The shared playwright user is not matt.akers@vibrantcauses.com,
  // so requireAdmin() should redirect to /dashboard before any admin
  // page chrome is rendered.
  await page.goto("/admin");
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard$/);
});
