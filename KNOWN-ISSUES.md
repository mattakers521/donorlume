# Known Issues

Bugs we know about but haven't fixed yet. Each entry says what breaks,
who it affects, where the code is, and what a fix probably looks like.
Remove an entry in the same commit that fixes it.

---

## Team invites can land the invitee in the wrong organization

**Found:** 2026-11-04, while writing the Organization Profile role tests (Phase 1, Feature 1).
**Severity:** High for any org that invites teammates. The invitee can end up
working in an empty workspace of their own instead of the team's, and nothing
on screen tells them why.

### What happens

1. An Owner/Admin invites `pat@example.org`. The invite page
   (`app/invite/[token]/page.tsx`) sends a new user to
   `/signup?invite=<token>&email=<email>`.
2. The signup page (`app/(auth)/signup/page.tsx`) **ignores the `invite`
   parameter**. It runs the normal two-step signup, and
   `POST /api/auth/register` creates a brand-new Organization with Pat as its
   OWNER.
3. If Pat later opens the invite link again and accepts it,
   `POST /api/team/invites/[token]/accept` adds a second `OrgUser` row for the
   inviting org. Pat now belongs to **two** orgs.
4. Every request resolves "the" org with
   `prisma.orgUser.findFirst({ where: { userId } })` and no `orderBy`. That's
   in `getOrgContext()` and `withOrg()` in `lib/with-org.ts`, and in
   `requireOrgUser()` in `lib/settings/actions.ts`. Postgres doesn't guarantee
   which row comes back, so in practice Pat usually keeps seeing their own
   empty org, and the result can change between requests.

### Side effects

- Pat's self-created org takes an extra 14-day trial and shows up in Slack
  signup notifications.
- Pat's role in the team org (for example VIEWER) isn't what gets enforced,
  because their own org's OWNER row may be the one picked. Feature 1's
  owner/admin-only profile editing is still enforced for whichever org is
  loaded, but the wrong org may be the one loaded.

### Likely fix

- Make signup handle invites: when `invite` is present, create the User only
  and accept the invitation, with no new Organization. (Or require sign-in
  first and accept on the invite page.)
- Make the org choice deterministic. Short term, add an `orderBy` (for
  example, most recently joined). Proper fix: an explicit "current org" (a
  cookie or `User.lastOrgId`) plus an org switcher for people who really are
  in more than one org.
- Add a Playwright test that goes through the real invite flow end to end.

### Workaround today

The Feature 1 role tests (`tests/e2e/org-profile.spec.ts`) add teammates to
the test org directly in the database instead of through invites, so the test
user only belongs to one org.

---

## Reactivation emails ask for concrete impact stories with no real facts to draw on

**Found:** 2026-11-04, while tightening the outreach prompt's no-invention rule.
**Severity:** Medium. Affects the quality of lapsed-donor reactivation drafts;
nothing breaks.
**Plan:** Connect to Impact Cards in Phase 1 Feature 3. Until then the
reactivation rules stay as they are, by decision.

### What happens

Two prompt rules pull in opposite directions:

- The lapsed-reactivation block in `buildUserPrompt()` (`lib/outreach/prompt.ts`,
  "FIRST-TOUCH REACTIVATION") says **STORY SECOND**: share one concrete impact
  moment, such as a specific person served or a milestone reached.
- The system prompt now forbids any financial, impact or use-of-funds claim, and
  any invented programs, statistics or people, unless that exact fact is in the
  org profile or the donor's notes.

No org has anywhere to record real impact facts today. The Organization Profile
holds mission, community and focus areas, but no stories, outcomes or numbers.
So the model either writes general impact language from the mission (what the
no-invention rule asks for) or is tempted to invent a "concrete" story (what the
reactivation rule asks for). Drafts will mostly come out general, which
underdelivers on STORY SECOND.

### Likely fix (Feature 3)

- Treat published **Impact Cards** (outcome summary, dollars invested,
  volunteers mobilized, hours donated, linked Need Card) as the org's source of
  real impact facts.
- Pass the org's most recent or most relevant published Impact Card(s) into the
  outreach prompt's organization context, scoped to the org server-side like
  the profile fields.
- Rewrite STORY SECOND to "use one of the impact facts provided; if none are
  provided, describe impact in general terms from the mission."
- Add a Playwright test that an Impact Card's outcome appears in the assembled
  prompt, and that no story text is requested when there are no cards.
