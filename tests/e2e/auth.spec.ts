import { expect, test } from "@playwright/test";

// Fresh context: this test exercises the signup → dashboard flow end
// to end, so it must NOT inherit the shared user session.
test.use({ storageState: { cookies: [], origins: [] } });

test("email/password signup creates account and lands on dashboard", async ({
  page,
}) => {
  const tag = Date.now().toString(36);
  const email = `playwright-signup-${tag}@vibrantcauses.test`;
  const password = "Playwright!Signup1";
  const name = "Signup Tester";
  const orgName = `Signup Test Org ${tag}`;
  const mission = "Helping people via automated tests.";

  await page.goto("/signup");

  // Step 1: account details.
  await page.getByPlaceholder("Sarah Mitchell").fill(name);
  await page.getByPlaceholder("sarah@hopefoundation.org").fill(email);
  await page.getByPlaceholder("At least 8 characters").fill(password);

  // Terms checkbox — checkbox is hidden under a styled wrapper, but
  // the underlying input is still findable by role.
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Step 2: org details.
  await page.getByPlaceholder("Hope Community Foundation").fill(orgName);
  await page
    .getByPlaceholder(/Helping families in central Indiana/i)
    .fill(mission);
  await page.getByPlaceholder(name).fill(name);
  await page.getByPlaceholder("Director of Development").fill("Test Director");

  await page.getByRole("button", { name: /launch donorlume/i }).click();

  // Final landing — should be the dashboard.
  await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/dashboard$/);

  // Sanity: dashboard header chrome should be present.
  await expect(page.locator("body")).toContainText(orgName);
});
