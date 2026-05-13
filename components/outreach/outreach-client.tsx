"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CohortDefinition } from "@prisma/client";

import { C, brandGradient } from "@/lib/design";
import type { DonorContext } from "@/lib/outreach/prompt";
import { OutreachSetup, type CampaignFormState } from "@/components/outreach/outreach-setup";
import { OutreachSelect } from "@/components/outreach/outreach-select";
import { OutreachProgress } from "@/components/outreach/outreach-progress";
import { useToast } from "@/components/toast/toast-provider";
import {
  OutreachResults,
  type DeliveryStatus,
  type DraftView,
} from "@/components/outreach/outreach-results";

export type SelectableDonor = {
  id: string;
  donorId: string | null;
  isReal: boolean;
  /** Manually-typed contacts added via the "Add Contact" form on the select
   *  screen. Same wire shape as samples (donorId=null, no cohorts) — the
   *  distinction is only used for the row badge label. */
  isManual?: boolean;
  ctx: DonorContext;
  /** Cohort summaries for badge rendering (real donors only — samples = []). */
  cohorts: { id: string; name: string; color: string }[];
};

type Defaults = {
  orgName: string;
  mission: string;
  senderName: string;
  senderTitle: string;
  tone: string;
  emailType: string;
  customInstructions: string;
};

type Props = {
  defaults: Defaults;
  realDonors: SelectableDonor[];
  sampleDonors: SelectableDonor[];
  cohorts: CohortDefinition[];
  /** Pre-selected cohort filter id if user arrived via ?cohort=slug. */
  initialCohortFilterId: string | null;
  /**
   * Set when the page is reached via the dashboard onboarding checklist
   * (`?onboarding=1`). Renders inline helper banners on the setup and
   * select steps so first-time users know exactly which button to
   * click next.
   */
  onboardingActive?: boolean;
};

type Step = "setup" | "select" | "gen" | "results";

export function OutreachClient({
  defaults,
  realDonors,
  sampleDonors,
  cohorts,
  initialCohortFilterId,
  onboardingActive = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("setup");

  // ─── Navigation tripwire ────────────────────────────────────────────
  // Logs every pathname change while OutreachClient is mounted. If the
  // user ever ends up off /outreach/new during the flow, this fires
  // with the destination — that's the smoking gun. Also logs on initial
  // mount + unmount so we can see the component lifecycle around any
  // unexpected redirect.
  const initialPathnameRef = useRef(pathname);
  useEffect(() => {
    console.log(
      `[outreach-trace] OutreachClient MOUNT at pathname=${initialPathnameRef.current}`,
    );
    return () => {
      console.log("[outreach-trace] OutreachClient UNMOUNT");
    };
  }, []);
  useEffect(() => {
    if (pathname !== initialPathnameRef.current) {
      console.warn(
        `[outreach-trace] pathname CHANGED while OutreachClient mounted: ${initialPathnameRef.current} → ${pathname}`,
      );
      console.trace("[outreach-trace] stack");
    }
  }, [pathname]);

  const [config, setConfig] = useState<CampaignFormState>({
    orgName: defaults.orgName,
    mission: defaults.mission,
    campaignName: "",
    senderName: defaults.senderName,
    senderTitle: defaults.senderTitle,
    tone: defaults.tone,
    emailType: defaults.emailType,
    customInstructions: defaults.customInstructions,
  });

  // Manually-typed contacts (Add Contact form on the select screen).
  // Kept in client state — never persisted as Donor rows because they
  // ride through /api/outreach/drafts with donorId=null, the same path
  // sample donors use.
  const [manualContacts, setManualContacts] = useState<SelectableDonor[]>([]);

  // Real donors (from /lapsed or /cohorts handoff) start checked; manual
  // contacts get auto-selected on add; sample donors don't.
  const allDonors = useMemo(
    () => [...realDonors, ...manualContacts, ...sampleDonors],
    [realDonors, manualContacts, sampleDonors],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(realDonors.map((d) => d.id)),
  );

  const addManualContact = useCallback(
    (input: { name: string; email: string; notes: string }) => {
      const id = `manual-${
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      }`;
      const contact: SelectableDonor = {
        id,
        donorId: null,
        isReal: false,
        isManual: true,
        ctx: {
          name: input.name,
          email: input.email,
          donorType: null,
          totalGifts: null,
          totalGiven: null,
          largestGift: null,
          averageGift: null,
          lastGiftLabel: null,
          lapsedMonths: null,
          reactivationScore: null,
          tier: null,
          activeElsewhere: null,
          notes: input.notes || null,
          cohorts: [],
        },
        cohorts: [],
      };
      setManualContacts((prev) => [...prev, contact]);
      setSelected((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [],
  );

  // Cohort filter — only affects real donors. Sample donors always show
  // so first-time users still see the demo flow.
  const [cohortFilter, setCohortFilter] = useState<Set<string>>(() =>
    initialCohortFilterId
      ? new Set([initialCohortFilterId])
      : new Set<string>(),
  );

  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [drafts, setDrafts] = useState<DraftView[]>([]);

  const reset = useCallback(() => {
    setStep("setup");
    setSelected(new Set(realDonors.map((d) => d.id)));
    setDrafts([]);
    setProgress({ current: 0, total: 0 });
    setManualContacts([]);
  }, [realDonors]);

  const generate = useCallback(async () => {
    const chosen = allDonors.filter((d) => selected.has(d.id));
    if (chosen.length === 0) return;
    setStep("gen");
    setDrafts([]);
    setProgress({ current: 0, total: chosen.length });

    // 1. Create the campaign.
    let campaignId: string;
    // Captured here, fired below after drafts finish — so the toast's
    // "Send Your First Email →" anchor resolves to a real card on the
    // mounted results page instead of jumping to nothing during the
    // still-generating phase.
    let isFirstCampaign = false;
    try {
      const res = await fetch("/api/outreach/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone: config.tone,
          emailType: config.emailType,
          campaignName: config.campaignName || null,
          customInstructions: config.customInstructions || null,
        }),
      });
      if (!res.ok) throw new Error(`Couldn’t create campaign (${res.status})`);
      const body = (await res.json()) as {
        campaign: { id: string };
        firstCampaign?: boolean;
      };
      campaignId = body.campaign.id;
      isFirstCampaign = !!body.firstCampaign;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Setup failed";
      setDrafts([
        {
          id: "setup-error",
          donorName: "Campaign setup",
          donorEmail: null,
          subject: "",
          body: "",
          status: "error",
          error: message,
        },
      ]);
      setStep("results");
      return;
    }

    // 2. Generate one draft per donor sequentially. Sequential calls
    //    drive the progress bar and let prompt caching kick in for
    //    every donor after the first.
    const out: DraftView[] = [];
    for (let i = 0; i < chosen.length; i++) {
      setProgress({ current: i + 1, total: chosen.length });
      const donor = chosen[i];
      try {
        const res = await fetch("/api/outreach/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId,
            donor: donor.ctx,
            donorId: donor.donorId,
            promptConfig: {
              orgName: config.orgName,
              mission: config.mission,
              senderName: config.senderName || null,
              senderTitle: config.senderTitle || null,
            },
          }),
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(errBody.error ?? `HTTP ${res.status}`);
        }
        const body = (await res.json()) as {
          draft: {
            id: string;
            subject: string;
            body: string;
            recipientName: string;
            recipientEmail: string | null;
          };
        };
        out.push({
          id: body.draft.id,
          donorName: body.draft.recipientName,
          donorEmail: body.draft.recipientEmail,
          subject: body.draft.subject,
          body: body.draft.body,
          status: "ready",
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Generation failed";
        out.push({
          id: `error-${donor.id}`,
          donorName: donor.ctx.name,
          donorEmail: donor.ctx.email ?? null,
          subject: "",
          body: "",
          status: "error",
          error: message,
        });
      }
      setDrafts([...out]);
    }
    setStep("results");

    // First-campaign onboarding nudge. Fired here (not at campaign-
    // creation time) so the toast lands AFTER the results page has
    // mounted — the "Send Your First Email →" action targets the
    // `#first-unsent-draft` anchor that lives on the first sendable
    // card, and that element doesn't exist until `step === "results"`.
    if (isFirstCampaign) {
      toast({
        kind: "onboarding",
        title: "Step complete!",
        body: "One more to go — send your first email to start tracking opens and clicks.",
        action: {
          label: "Send Your First Email",
          // Callback (not href) so Next.js Link never enters the picture.
          // Hash-only Link hrefs have caused stray top-level navigations
          // in past Next.js versions; an explicit scrollIntoView is
          // routing-free by construction. See [outreach-trace] logs.
          onClick: () => {
            console.log("[outreach-trace] toast CTA clicked → scrollIntoView #first-unsent-draft");
            const el = document.getElementById("first-unsent-draft");
            if (!el) {
              console.warn("[outreach-trace] toast CTA: anchor not found in DOM");
              return;
            }
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          },
        },
      });
    }
    console.log(
      "[outreach-trace] generate() → router.refresh() after results render",
    );
    router.refresh();
  }, [allDonors, config, router, selected, toast]);

  const regenerate = useCallback(
    async (index: number) => {
      const target = drafts[index];
      if (!target || target.status === "error") return;
      setDrafts((prev) =>
        prev.map((d, i) => (i === index ? { ...d, status: "loading" } : d)),
      );
      try {
        const res = await fetch(
          `/api/outreach/drafts/${encodeURIComponent(target.id)}/regenerate`,
          { method: "POST" },
        );
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(errBody.error ?? `HTTP ${res.status}`);
        }
        const body = (await res.json()) as {
          draft: { subject: string; body: string };
        };
        setDrafts((prev) =>
          prev.map((d, i) =>
            i === index
              ? {
                  ...d,
                  subject: body.draft.subject,
                  body: body.draft.body,
                  status: "ready",
                }
              : d,
          ),
        );
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Regeneration failed";
        setDrafts((prev) =>
          prev.map((d, i) =>
            i === index ? { ...d, status: "error", error: message } : d,
          ),
        );
      }
    },
    [drafts],
  );

  const updateDraft = useCallback(
    (index: number, patch: Partial<Pick<DraftView, "subject" | "body">>) => {
      setDrafts((prev) =>
        prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
      );
    },
    [],
  );

  /** Send a single draft via Resend. The caller passes the draft id +
   *  index directly. Aggressively diagnoses any failure mode (network,
   *  4xx/5xx, non-JSON body) so future debugging doesn't end up staring
   *  at an empty `{}` in the console. */
  const sendDraft = useCallback(async (draftId: string, index: number) => {
    setDrafts((prev) =>
      prev.map((d, i) =>
        i === index && d.id === draftId
          ? { ...d, sending: "sending", sendError: undefined }
          : d,
      ),
    );

    const url = `/api/outreach/drafts/${encodeURIComponent(draftId)}/send`;

    // Step 1 — issue the request. Separate try/catch so network failures
    // (DNS, server down, CORS) get distinct logging from server errors.
    let res: Response;
    try {
      res = await fetch(url, { method: "POST" });
    } catch (fetchErr) {
      const message =
        fetchErr instanceof Error
          ? `Network error reaching ${url}: ${fetchErr.message}`
          : `Network error reaching ${url}`;
      // Plain-string + JSON payload (see note in [sendDraft] server error).
      const fetchErrSummary =
        fetchErr instanceof Error
          ? `${fetchErr.name}: ${fetchErr.message}`
          : String(fetchErr);
      console.error(
        `[sendDraft] fetch failed — ${fetchErrSummary}`,
        JSON.stringify(
          {
            url,
            draftId,
            errorName:
              fetchErr instanceof Error ? fetchErr.name : typeof fetchErr,
            errorMessage:
              fetchErr instanceof Error
                ? fetchErr.message
                : String(fetchErr),
            stack:
              fetchErr instanceof Error
                ? fetchErr.stack?.split("\n").slice(0, 6).join("\n")
                : undefined,
          },
          null,
          2,
        ),
      );
      setDrafts((prev) =>
        prev.map((d, i) =>
          i === index && d.id === draftId
            ? { ...d, sending: "error", sendError: message }
            : d,
        ),
      );
      return;
    }

    // Step 2 — read the body as text once, then try JSON. This means we
    // always have *something* to log even when the server returns HTML
    // (e.g. a Next.js error page) instead of JSON.
    const rawBody = await res.text().catch(() => "");
    let parsed: unknown = null;
    if (rawBody) {
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        // Non-JSON body — keep parsed = null, surface rawBody below.
      }
    }

    try {
      if (!res.ok) {
        const serverMessage =
          parsed &&
          typeof parsed === "object" &&
          "error" in parsed &&
          typeof (parsed as { error: unknown }).error === "string"
            ? (parsed as { error: string }).error
            : rawBody.slice(0, 300) || `HTTP ${res.status} ${res.statusText}`;
        // Plain-string log + structured second arg. Chrome's devtools
        // collapses object previews to `{...}` by default; the leading
        // string is guaranteed-visible regardless. JSON.stringify the
        // payload too so it's grep-able in error reports.
        console.error(
          `[sendDraft] server error ${res.status} ${res.statusText} — ${serverMessage}`,
          JSON.stringify(
            {
              url,
              draftId,
              status: res.status,
              statusText: res.statusText,
              body: rawBody.slice(0, 1500),
            },
            null,
            2,
          ),
        );
        throw new Error(humanizeSendError(serverMessage, res.status));
      }

      if (!parsed || typeof parsed !== "object") {
        console.error(
          `[sendDraft] invalid response body (HTTP ${res.status})`,
          JSON.stringify(
            { url, status: res.status, rawBody: rawBody.slice(0, 1500) },
            null,
            2,
          ),
        );
        throw new Error("Server returned an invalid response body.");
      }
      const body = parsed as {
        draft: {
          status: DeliveryStatus["status"];
          sentAt: string | null;
        };
        firstSend?: boolean;
      };
      setDrafts((prev) =>
        prev.map((d, i) =>
          i === index && d.id === draftId
            ? {
                ...d,
                sending: "idle",
                delivery: {
                  status: body.draft.status,
                  sentAt: body.draft.sentAt,
                  deliveredAt: null,
                  openedAt: null,
                  openCount: 0,
                  clickedAt: null,
                  clickCount: 0,
                  bouncedAt: null,
                  bounceReason: null,
                  repliedAt: null,
                },
              }
            : d,
        ),
      );
      if (body.firstSend) {
        // First-ever send earns a full celebration screen instead of a
        // toast that disappears. The /celebrate page renders the
        // starburst animation + "You're all set!" + Go to Dashboard.
        console.log(
          "[outreach-trace] sendDraft firstSend=true → router.push('/celebrate')",
        );
        router.push("/celebrate");
        router.refresh();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Send failed.";
      console.error(
        `[sendDraft] failed — ${message}`,
        JSON.stringify({ draftId, url, message }, null, 2),
      );
      setDrafts((prev) =>
        prev.map((d, i) =>
          i === index && d.id === draftId
            ? { ...d, sending: "error", sendError: message }
            : d,
        ),
      );
    }
  }, [router]);

  // ─── Status polling ──────────────────────────────────────────────────
  // Refreshes delivery / open / click / bounce data from the server every
  // 30s. Reads the latest draft list by way of a no-op setDrafts callback
  // (passing through the previous state) — that avoids the React-19
  // immutability lint that flags `ref.current = …` mutations inside
  // effects, and avoids resubscribing the interval on every render.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      let idsToPoll: string[] = [];
      setDrafts((current) => {
        idsToPoll = current
          .filter((d) => {
            const s = d.delivery?.status;
            return s === "SENT" || s === "OPENED";
          })
          .map((d) => d.id);
        return current;
      });
      if (idsToPoll.length === 0) return;
      try {
        const res = await fetch(
          `/api/outreach/drafts/status?ids=${idsToPoll
            .map(encodeURIComponent)
            .join(",")}`,
        );
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          drafts: (DeliveryStatus & { id: string })[];
        };
        if (cancelled) return;
        const byId = new Map(body.drafts.map((d) => [d.id, d] as const));
        setDrafts((prev) =>
          prev.map((d) => {
            const fresh = byId.get(d.id);
            if (!fresh) return d;
            return {
              ...d,
              delivery: {
                status: fresh.status,
                sentAt: fresh.sentAt,
                deliveredAt: fresh.deliveredAt,
                openedAt: fresh.openedAt,
                openCount: fresh.openCount,
                clickedAt: fresh.clickedAt,
                clickCount: fresh.clickCount,
                bouncedAt: fresh.bouncedAt,
                bounceReason: fresh.bounceReason,
                repliedAt: fresh.repliedAt,
              },
            };
          }),
        );
      } catch {
        // Polling is best-effort.
      }
    };
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (step === "setup") {
    return (
      <>
        {onboardingActive && (
          <OnboardingHint>
            Fill in your details below, then click{" "}
            <strong>Select Donors</strong> to continue.
          </OnboardingHint>
        )}
        <OutreachSetup
          config={config}
          onChange={setConfig}
          onContinue={() => setStep("select")}
        />
      </>
    );
  }

  if (step === "select") {
    return (
      <>
        {onboardingActive && (
          <OnboardingHint>
            Select at least one donor (use the checkboxes), then click{" "}
            <strong>Generate</strong>.
          </OnboardingHint>
        )}
        <OutreachSelect
          donors={allDonors}
          cohorts={cohorts}
          cohortFilter={cohortFilter}
          onToggleCohort={(id) =>
            setCohortFilter((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onClearCohorts={() => setCohortFilter(new Set())}
          selected={selected}
          onToggle={(id) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onSelectAll={() =>
            setSelected((prev) =>
              prev.size === allDonors.length
                ? new Set()
                : new Set(allDonors.map((d) => d.id)),
            )
          }
          onAddManualContact={addManualContact}
          onBack={() => setStep("setup")}
          onGenerate={generate}
        />
      </>
    );
  }

  if (step === "gen") {
    return <OutreachProgress current={progress.current} total={progress.total} />;
  }

  return (
    <OutreachResults
      drafts={drafts}
      orgName={config.orgName}
      onRegenerate={regenerate}
      onUpdateDraft={updateDraft}
      onSendDraft={sendDraft}
      onStartOver={reset}
      onboardingActive={onboardingActive}
    />
  );
}

/**
 * Inline guidance banner shown above the setup and select steps when
 * the user arrived from the dashboard onboarding checklist
 * (`?onboarding=1`). Bright amber so it doesn't get overlooked, but
 * compact so it doesn't push the actual form below the fold.
 */
function OnboardingHint({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 16px",
        marginBottom: 16,
        backgroundColor: C.amberLight,
        border: `1px solid rgba(232,134,12,0.30)`,
        borderRadius: 14,
        fontFamily: "var(--font-jakarta), sans-serif",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 8,
          background: brandGradient,
          color: "#fff",
          fontSize: 14,
          fontWeight: 800,
          flexShrink: 0,
          boxShadow: "0 4px 10px rgba(232,134,12,0.28)",
        }}
      >
        →
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: C.text,
          fontWeight: 500,
        }}
      >
        {children}
      </p>
    </div>
  );
}

/**
 * Translate the most-common send-failure messages into something the user
 * can act on. Right now the only special case is Resend's test-domain
 * restriction — that error is verbose, scary-looking, and entirely
 * actionable, so we lift its key sentence into a hint.
 */
function humanizeSendError(serverMessage: string, status: number): string {
  if (
    serverMessage.includes("You can only send testing emails to your own")
  ) {
    return `${serverMessage}\n\nTip: while in Resend test mode, sends to anyone other than your account-owner email bounce. Use "Add Contact" to send to yourself, or verify a domain at resend.com/domains and update EMAIL_FROM.`;
  }
  if (serverMessage.includes("RESEND_API_KEY")) {
    return "RESEND_API_KEY isn't set on the server. Add it to .env (https://resend.com/api-keys) and restart the dev server.";
  }
  if (serverMessage.includes("EMAIL_FROM")) {
    return 'EMAIL_FROM isn\'t set on the server. Set it in .env, e.g. `EMAIL_FROM="DonorLume <outreach@yourdomain.com>"`, and restart the dev server.';
  }
  return `${serverMessage}${status ? ` (HTTP ${status})` : ""}`;
}
