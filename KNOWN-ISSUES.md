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

---

## Database has drifted from the migration history, so `prisma migrate dev` offers to wipe it

**Found:** 2026-11-05, while adding the `AiGeneration` migration (Phase 1 Feature 2).
**Severity:** Low for the running app, **high for anyone running Prisma dev
commands**. Nothing is broken today. The danger is the reset prompt.
**Plan:** Fix before Feature 3 (which adds the `Card` model and another migration).

### What's different

Prisma compares two things: the database you'd get by replaying every file in
`prisma/migrations/` in order, and the real Neon database. They differ in two
small ways. The live database matches `schema.prisma` exactly
(`prisma migrate diff --from-schema-datasource … --to-schema-datamodel …` is
empty). It's the migration files that are out of step.

1. **A missing index on `DonorList.uploadedByUserId`.**
   `20260513_donorlist_uploaded_by/migration.sql` creates
   `DonorList_uploadedByUserId_idx`. The live database doesn't have it, and
   `schema.prisma` doesn't declare it. The table has only its primary key. Most
   likely the change went in with `prisma db push` from a schema without the
   index, and the SQL file was hand-written with an extra `CREATE INDEX` that
   never ran.
2. **Different "on update" settings on two `Invitation` foreign keys.**
   `20260512_account_management/migration.sql` creates `Invitation_orgId_fkey`
   and `Invitation_invitedById_fkey` with `ON DELETE CASCADE` only, so updates
   default to "no action". The live database has
   `ON UPDATE CASCADE ON DELETE CASCADE`, which is what Prisma generates. Same
   probable cause: `db push` plus hand-written SQL.

### Is it a risk?

- **Deploys: no.** Vercel runs `prisma migrate deploy`, which only applies
  migrations missing from `_prisma_migrations` and doesn't check for drift.
  Every migration, including `20261105_ai_generation_usage`, is recorded as
  applied. `migrate status` reports "Database schema is up to date!".
- **App behavior: no.** IDs are never updated, so "on update" never fires. The
  missing index only matters if something filters donor lists by uploader at
  scale. Today the column is only written (on upload) and read alongside the
  list.
- **Data loss: yes, the real risk.** Because of the drift, `prisma migrate dev`
  says "We need to reset the public schema" and offers
  `prisma migrate reset`, which **drops every table and all data**. The local
  `.env` `DATABASE_URL` points at the same Neon database the app uses. So
  accepting that prompt locally would wipe the live data. In a non-interactive
  shell it refuses, but a person at a terminal could say yes.
- **Fresh databases differ.** A new database built from the migration files
  (for example a staging branch) gets the extra index and the "no action"
  update rule, so it won't exactly match production.

### Likely fix

- Add one small catch-up migration that makes the history match reality:
  `DROP INDEX IF EXISTS "DonorList_uploadedByUserId_idx";` (or add
  `@@index([uploadedByUserId])` to the schema and create the index on the live
  database instead), then drop and recreate the two `Invitation` foreign keys
  with `ON UPDATE CASCADE ON DELETE CASCADE`. Record it with
  `prisma migrate resolve --applied` on the live database, since the live
  database already matches.
- Verify by replaying migrations into a throwaway Neon branch or a local
  Postgres used as `shadowDatabaseUrl`. `prisma migrate dev` should then report
  no drift.
- Stop pointing local `DATABASE_URL` at the production database. Use a Neon dev
  branch, so a mistaken reset can only hit a copy.

### Workaround today

Never run `prisma migrate dev` or `prisma migrate reset` against this database.
For new migrations: write the SQL with `prisma migrate diff` (old schema → new
schema), apply it with `prisma db execute`, then
`prisma migrate resolve --applied <name>`. This is how
`20261105_ai_generation_usage` was applied.
