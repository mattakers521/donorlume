"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CohortDefinition,
  Donor,
  DonorCohort,
  DonorList,
} from "@prisma/client";

import { scoreAll, type RawDonorRow } from "@/lib/scoring";
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

  return (
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
        // Optimistically patch the local donor list so the row's claim
        // pill flips immediately. Server-side refresh still happens via
        // ClaimButton's internal router.refresh().
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
  );
}

function stripDonors<T extends { donors: unknown }>(
  v: T,
): Omit<T, "donors"> {
  const { donors: _donors, ...rest } = v;
  void _donors;
  return rest;
}
