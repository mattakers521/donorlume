"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CohortDefinition,
  Donor,
  DonorCohort,
  DonorList,
} from "@prisma/client";

import { scoreAll, type RawDonorRow } from "@/lib/scoring";
import { AttendeeView } from "@/components/lapsed/attendee-view";
import { UploadInsights } from "@/components/lapsed/upload-insights";
import { UploadZone } from "@/components/lapsed/upload-zone";
import { ScoredView } from "@/components/lapsed/scored-view";
import { useToast } from "@/components/toast/toast-provider";

/** Donor row with its cohort assignments + the joined CohortDefinition. */
export type DonorWithCohorts = Donor & {
  cohorts: (DonorCohort & { cohort: CohortDefinition })[];
  claimedBy: { id: string; name: string | null; email: string } | null;
};

type Props = {
  /** Most-recent persisted DonorList for this org, or null. */
  initialList: (DonorList & { donors: DonorWithCohorts[] }) | null;
  lapsedThresholdMonths: number;
  /** Every cohort definition for this org — drives the filter bar. */
  cohorts: CohortDefinition[];
  currentUser: { id: string; name: string | null; email: string };
  orgRole: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
};

export function LapsedClient({
  initialList,
  lapsedThresholdMonths,
  cohorts: initialCohorts,
  currentUser,
  orgRole,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [list, setList] = useState<DonorList | null>(
    initialList ? stripDonors(initialList) : null,
  );
  const [donors, setDonors] = useState<DonorWithCohorts[]>(
    initialList?.donors ?? [],
  );
  const [cohorts, setCohorts] =
    useState<CohortDefinition[]>(initialCohorts);
  const [threshold, setThreshold] = useState(lapsedThresholdMonths);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const newUpload = useCallback(() => {
    setList(null);
    setDonors([]);
    setUploadError(null);
  }, []);

  const changeThreshold = useCallback((months: number) => {
    setThreshold(months);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    setDonors((prev) =>
      prev.map((d) => ({
        ...d,
        isLapsed: !!d.lastGiftDate && new Date(d.lastGiftDate) < cutoff,
      })),
    );
  }, []);

  const upload = useCallback(
    async (
      rows: RawDonorRow[],
      fileName: string,
      cohortColumns: string[],
      perDonorTags: Record<string, string>[],
    ) => {
      setUploadBusy(true);
      setUploadError(null);
      try {
        const previewScored = scoreAll(rows, new Date(), threshold);
        void previewScored;

        const res = await fetch("/api/donors/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName,
            thresholdMonths: threshold,
            cohortColumns,
            donors: rows.map((d, i) => ({
              ...d,
              firstGiftDate: d.firstGiftDate?.toISOString() ?? null,
              lastGiftDate: d.lastGiftDate?.toISOString() ?? null,
              csvTags: perDonorTags[i] ?? {},
            })),
          }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `Upload failed (${res.status})`);
        }

        const data = (await res.json()) as {
          listId: string;
          list: DonorList;
          donors: DonorWithCohorts[];
          cohorts: CohortDefinition[];
          firstUpload?: boolean;
        };
        setList(data.list);
        setDonors(data.donors);
        if (data.cohorts) setCohorts(data.cohorts);
        if (data.firstUpload) {
          toast({
            kind: "onboarding",
            title: "Step complete!",
            body: "You've uploaded your first donor list.",
            action: { label: "Continue setup", href: "/dashboard" },
          });
        }
        router.refresh();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Upload failed.";
        setUploadError(message);
      } finally {
        setUploadBusy(false);
      }
    },
    [router, threshold, toast],
  );

  if (!list || donors.length === 0) {
    return (
      <UploadZone
        busy={uploadBusy}
        errorMessage={uploadError}
        onProcess={upload}
      />
    );
  }

  // Attendee-only list = every row lacks any giving signal. When true
  // we render AttendeeView instead of the lapsed-scoring table — the
  // tier/threshold controls and lapsed-priority stats are meaningless
  // here, and a blank scored table for a perfectly valid attendee
  // upload feels broken.
  const isAttendeeList = donors.every(
    (d) =>
      d.lastGiftDate == null &&
      (d.totalGifts == null || d.totalGifts === 0) &&
      (d.totalGiven == null || d.totalGiven === 0),
  );

  // ─── Engagement-score backfill ───────────────────────────────────
  // Attendees uploaded before the engagement scorer existed have no
  // `enrichmentData.engagement` and render as em-dashes in
  // AttendeeView. The first time the page loads with such rows, kick
  // off a server-side backfill (which recovers years from existing
  // cohort assignments + cohort descriptions + notes) and patch the
  // returned scores into local state. Idempotent: subsequent loads
  // find every row already has the engagement key and skip the call.
  //
  // SECOND-CHANCE LOGIC: if a prior backfill produced empty scores
  // across the board (yearsAttended=0 for every backfilled row), the
  // year-recovery scan was too narrow at the time. Auto-retrigger
  // ONCE with ?force=true so the broader recovery logic in the
  // current code can take another swing. The sessionStorage flag
  // prevents looping forever if recovery is genuinely impossible
  // (e.g. the original CSV truly had no year data anywhere).
  const backfillFiredRef = useRef(false);
  useEffect(() => {
    if (backfillFiredRef.current) return;
    if (!isAttendeeList || donors.length === 0) return;

    const missingEngagement = donors.filter((d) => {
      const enrichment = d.enrichmentData as
        | { engagement?: unknown }
        | null;
      return !enrichment || !enrichment.engagement;
    });
    const backfilledEmpty = donors.filter((d) => {
      const enrichment = d.enrichmentData as
        | { engagement?: { backfilled?: boolean; yearsAttended?: number } }
        | null;
      const e = enrichment?.engagement;
      return e?.backfilled === true && (e.yearsAttended ?? 0) === 0;
    });

    const forceRetried =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("engagement-backfill-force-tried") ===
        "1";
    const needsForce =
      !forceRetried &&
      missingEngagement.length === 0 &&
      backfilledEmpty.length > 0 &&
      backfilledEmpty.length === donors.length;

    if (missingEngagement.length === 0 && !needsForce) return;

    backfillFiredRef.current = true;
    const force = needsForce;
    if (force && typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "engagement-backfill-force-tried",
        "1",
      );
    }

    console.log(
      `[engagement-backfill] triggering total=${donors.length} missing=${missingEngagement.length} backfilledEmpty=${backfilledEmpty.length} force=${force}`,
    );

    void (async () => {
      try {
        const res = await fetch(
          `/api/donors/backfill-engagement${force ? "?force=true" : ""}`,
          { method: "POST" },
        );
        if (!res.ok) {
          console.warn(
            "[engagement-backfill] HTTP failed",
            res.status,
            await res.text().catch(() => ""),
          );
          return;
        }
        const body = (await res.json()) as {
          scanned?: number;
          updated?: number;
          cleared?: number;
          sample?: unknown;
          updates?: { id: string; enrichmentData: unknown }[];
        };
        console.log(
          `[engagement-backfill] response scanned=${body.scanned} updated=${body.updated} cleared=${body.cleared ?? 0}`,
        );
        if (body.sample) {
          console.log("[engagement-backfill] sample", body.sample);
        }
        if (!body.updates || body.updates.length === 0) return;
        const patchById = new Map(
          body.updates.map((u) => [u.id, u.enrichmentData]),
        );
        setDonors((prev) =>
          prev.map((d) => {
            const patch = patchById.get(d.id);
            if (!patch) return d;
            return {
              ...d,
              enrichmentData: patch as DonorWithCohorts["enrichmentData"],
            };
          }),
        );
      } catch (e) {
        console.warn("[engagement-backfill] threw", e);
      }
    })();
  }, [isAttendeeList, donors]);

  return (
    <>
      <UploadInsights donors={donors} fileName={list.fileName ?? list.name} />
      {isAttendeeList ? (
        <AttendeeView
          donors={donors}
          cohorts={cohorts}
          totalUploaded={list.totalDonors}
          onNewUpload={newUpload}
        />
      ) : (
        <ScoredView
          donors={donors}
          cohorts={cohorts}
          totalUploaded={list.totalDonors}
          thresholdMonths={threshold}
          onThresholdChange={changeThreshold}
          onNewUpload={newUpload}
          currentUser={currentUser}
          orgRole={orgRole}
          onClaimUpdate={(donorId, next) => {
            // Optimistically patch the local donor list so the row's
            // claim pill flips immediately. Server-side refresh still
            // happens via ClaimButton's internal router.refresh().
            setDonors((prev) =>
              prev.map((d) =>
                d.id === donorId
                  ? {
                      ...d,
                      claimedById: next.claimedById,
                      claimedAt: next.claimedAt,
                      claimedBy: next.claimedBy,
                    }
                  : d,
              ),
            );
          }}
        />
      )}
    </>
  );
}

function stripDonors<T extends { donors: unknown }>(
  v: T,
): Omit<T, "donors"> {
  const { donors: _donors, ...rest } = v;
  void _donors;
  return rest;
}
