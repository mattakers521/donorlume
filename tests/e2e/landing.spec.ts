import { expect, test } from "@playwright/test";

// Anonymous viewer — must not inherit the shared auth state.
test.use({ storageState: { cookies: [], origins: [] } });

test("landing page renders core CTAs", async ({ page }) => {
  await page.goto("/");

  // Hero headline (split across two spans + a <br>) — match the
  // serif headline by role to skip the styled gradient text wrapper.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Know your donors",
  );

  // Primary CTA — appears at least twice (hero + two-paths section).
  const primaryCta = page.getByRole("link", {
    name: /See What.s Hiding In Your Donor Data/i,
  });
  await expect(primaryCta.first()).toBeVisible();

  // Secondary CTAs in the header — Sign In and Get Started Free.
  await expect(
    page.getByRole("link", { name: /sign in/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /get started free/i }).first(),
  ).toBeVisible();

  // Sanity: pricing section renders (one of the tier labels).
  await expect(page.getByText(/Starter/i).first()).toBeVisible();
});
