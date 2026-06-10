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
  /** Set when the page-load donor query failed. We render a soft
   *  error banner instead of crashing the route. */
  loadError?: string | null;
};

export function LapsedClient({
  initialList,
  lapsedThresholdMonths,
  cohorts: initialCohorts,
  currentUser,
  orgRole,
  loadError,
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

  const deleteList = useCallback(async () => {
    if (!list) return;
    const res = await fetch(
      `/api/donors/lists/${encodeURIComponent(list.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(body.error ?? `Delete failed (${res.status})`);
    }
    // Reset local state to the empty-upload view immediately. The
    // router.refresh kicks the server component to re-fetch in the
    // background so other tabs/devices see the deletion the next
    // time they navigate — but the user doesn't have to wait for it.
    setList(null);
    setDonors([]);
    setUploadError(null);
    router.refresh();
  }, [list, router]);

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

  // Attendee-only list = every row lacks any giving signal. When true
  // we render AttendeeView instead of the lapsed-scoring table — the
  // tier/threshold controls and lapsed-priority stats are meaningless
  // here, and a blank scored table for a perfectly valid attendee
  // upload feels broken. `.every()` on an empty array returns true, so
  // we guard the effect below with an explicit donors.length check.
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
  // Fires only when at least one attendee row is COMPLETELY missing
  // an `enrichmentData.engagement` key. If every row already carries
  // a score — whatever the value — we trust it and never touch it.
  // The previous "second-chance" / force-rerun path could re-trigger
  // backfill against good data and overwrite real scores with the
  // cohort-name-recovery approximation; removed entirely. The reload
  // script and the upload route both write correct scores up-front,
  // so this effect is now strictly a one-shot recovery for legacy
  // rows pre-dating the engagement feature.
  //
  // HOOK PLACEMENT: this useRef + useEffect MUST sit above the
  // `if (!list || donors.length === 0) return ...` early return
  // below. Moving them under the conditional return would skip the
  // hooks when the list is empty, which crashes React with
  // "Rendered fewer hooks than expected" the moment a user deletes
  // their only list and the component re-renders with list=null.
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

    if (missingEngagement.length === 0) {
      console.log(
        `[engagement-backfill] skip: all ${donors.length} attendees already have engagement scores`,
      );
      return;
    }

    backfillFiredRef.current = true;
    console.log(
      `[engagement-backfill] triggering total=${donors.length} missing=${missingEngagement.length}`,
    );
    const force = false;

    void (async () => {
      // Loop the batched endpoint until done. Each call processes at
      // most BATCH_SIZE (200) donors so it can't approach Vercel's
      // function timeout — and the client gets to apply patches as
      // each batch returns so the UI updates progressively instead
      // of waiting for all 2,000+ rows.
      let offset = 0;
      let safetyHops = 0;
      const MAX_HOPS = 50; // 50 × 200 = 10,000 donors hard ceiling
      while (safetyHops < MAX_HOPS) {
        safetyHops++;
        try {
          const params = new URLSearchParams();
          if (force) params.set("force", "true");
          if (offset > 0) params.set("offset", String(offset));
          const qs = params.toString();
          const res = await fetch(
            `/api/donors/backfill-engagement${qs ? `?${qs}` : ""}`,
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
            totalAttendees?: number;
            nextOffset?: number | null;
            done?: boolean;
            updates?: { id: string; enrichmentData: unknown }[];
          };
          console.log(
            `[engagement-backfill] batch hop=${safetyHops} scanned=${body.scanned} updated=${body.updated} cleared=${body.cleared ?? 0} done=${body.done} nextOffset=${body.nextOffset}`,
          );
          if (body.sample && safetyHops === 1) {
            // Only log the sample from the first batch — subsequent
            // batches just spam the console without adding signal.
            console.log("[engagement-backfill] sample", body.sample);
          }
          if (body.updates && body.updates.length > 0) {
            const patchById = new Map(
              body.updates.map((u) => [u.id, u.enrichmentData]),
            );
            setDonors((prev) =>
              prev.map((d) => {
                const patch = patchById.get(d.id);
                if (!patch) return d;
                return {
                  ...d,
                  enrichmentData:
                    patch as DonorWithCohorts["enrichmentData"],
                };
              }),
            );
          }
          if (body.done || body.nextOffset == null) {
            console.log(
              `[engagement-backfill] complete after ${safetyHops} hop${safetyHops === 1 ? "" : "s"}`,
            );
            return;
          }
          offset = body.nextOffset;
        } catch (e) {
          console.warn("[engagement-backfill] threw", e);
          return;
        }
      }
      console.warn(
        `[engagement-backfill] hit MAX_HOPS=${MAX_HOPS} — bailing`,
      );
    })();
  }, [isAttendeeList, donors]);

  // ─── Early-return for empty state ────────────────────────────────
  // MUST sit BELOW every hook above (Rules of Hooks). Previously this
  // lived between the upload useCallback and the backfill useRef +
  // useEffect, which crashed React the moment a user deleted their
  // only list and we re-rendered with list=null — hooks would skip,
  // hook count would drop, and React would throw on the next render.
  if (!list || donors.length === 0) {
    return (
      <UploadZone
        busy={uploadBusy}
        errorMessage={uploadError ?? loadError ?? null}
        onProcess={upload}
      />
    );
  }

  return (
    <>
      <UploadInsights donors={donors} fileName={list.fileName ?? list.name} />
      {isAttendeeList ? (
        <AttendeeView
          donors={donors}
          cohorts={cohorts}
          totalUploaded={list.totalDonors}
          onNewUpload={newUpload}
          onDeleteList={deleteList}
        />
      ) : (
        <ScoredView
          donors={donors}
          cohorts={cohorts}
          totalUploaded={list.totalDonors}
          thresholdMonths={threshold}
          onThresholdChange={changeThreshold}
          onNewUpload={newUpload}
          onDeleteList={deleteList}
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
