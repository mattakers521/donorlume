/* eslint-disable no-console */
/**
 * Tears down everything global-setup created: deletes the test user
 * (cascades to OrgUser → Organization → DonorList → Donor → cohorts +
 * OutreachCampaign → OutreachDraft), reads metadata from disk so we
 * never depend on per-spec state, and removes the storage state file
 * so a stale auth cookie can't bleed into the next run.
 *
 * Best-effort: a failure here logs but does not fail the suite — the
 * test outcomes have already been written and we don't want a janky
 * teardown to mask a passing run.
 */

import fs from "node:fs";
import path from "node:path";

const STATE_DIR = path.join(__dirname, ".auth");
const META_FILE = path.join(STATE_DIR, "meta.json");

export default async function globalTeardown() {
  if (!fs.existsSync(META_FILE)) return;
  let meta: { email: string; orgName: string } | null = null;
  try {
    meta = JSON.parse(fs.readFileSync(META_FILE, "utf8"));
  } catch (e) {
    console.warn("[playwright] teardown: bad meta file", e);
    return;
  }
  if (!meta?.email) return;

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      // Delete every user whose email matches the playwright-* prefix
      // so any signup-spec fixtures (which the spec creates inline,
      // outside the global meta) also get reaped. The shared user is
      // covered by the same pattern.
      const stale = await prisma.user.findMany({
        where: { email: { startsWith: "playwright-" } },
        include: { orgs: { include: { org: true } } },
      });
      let orgDeleted = 0;
      for (const u of stale) {
        for (const m of u.orgs) {
          try {
            await prisma.organization.delete({ where: { id: m.orgId } });
            orgDeleted++;
          } catch {
            // org may already be cascade-deleted by another user.
          }
        }
        await prisma.user.delete({ where: { id: u.id } });
      }
      console.log(
        `[playwright] teardown: deleted users=${stale.length} orgs=${orgDeleted}`,
      );
    } finally {
      await prisma.$disconnect();
    }
  } catch (e) {
    console.warn("[playwright] teardown failed:", e);
  }

  try {
    fs.rmSync(STATE_DIR, { recursive: true, force: true });
  } catch (e) {
    console.warn("[playwright] could not remove state dir:", e);
  }
}
