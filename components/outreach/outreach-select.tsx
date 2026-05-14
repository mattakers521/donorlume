"use client";

import { useMemo, useState } from "react";
import type { CohortDefinition } from "@prisma/client";
import {
  ChevronLeft,
  Plus,
  Sparkles,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";

import { C, brandGradient, inputStyle, shadow } from "@/lib/design";
import { fmt } from "@/lib/format";
import { PrimaryButton } from "@/components/auth-button";
import {
  CohortBadge,
  CohortOverflow,
} from "@/components/lapsed/cohort-badge";
import { CohortFilter } from "@/components/lapsed/cohort-filter";
import { TierBadge } from "@/components/tier-badge";
import type { SelectableDonor } from "@/components/outreach/outreach-client";

type Props = {
  donors: SelectableDonor[];
  cohorts: CohortDefinition[];
  cohortFilter: Set<string>;
  onToggleCohort: (cohortId: string) => void;
  onClearCohorts: () => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onAddManualContact: (input: {
    name: string;
    email: string;
    notes: string;
  }) => void;
  onBack: () => void;
  onGenerate: () => void;
  /** Drives "Claimed by you" vs "Claimed by Sarah" badge labels and
   *  the default-on "hide donors claimed by others" filter — so a
   *  team member doesn't accidentally email someone a teammate is
   *  personally cultivating. */
  currentUserId: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OutreachSelect({
  donors,
  cohorts,
  cohortFilter,
  onToggleCohort,
  onClearCohorts,
  selected,
  onToggle,
  onSelectAll,
  onAddManualContact,
  onBack,
  onGenerate,
  currentUserId,
}: Props) {
  // Default ON: never show donors another team member claimed unless
  // the user explicitly toggles them back in. Prevents the most common
  // collision (two fundraisers emailing the same major donor).
  const [hideClaimedByOthers, setHideClaimedByOthers] = useState(true);

  // Apply cohort filter (real donors only — samples always pass) then
  // the claim filter. Both rules let samples + manual contacts through;
  // they have no provenance and don't trigger the same collision risk.
  const visibleDonors = useMemo(() => {
    let rows = donors;

    if (cohortFilter.size > 0) {
      rows = rows.filter((d) => {
        if (!d.isReal) return true;
        const donorCohortIds = new Set(d.cohorts.map((c) => c.id));
        for (const wanted of cohortFilter) {
          if (!donorCohortIds.has(wanted)) return false;
        }
        return true;
      });
    }

    if (hideClaimedByOthers) {
      rows = rows.filter((d) => {
        // Drop only "claimed by SOMEONE ELSE". The current user's own
        // claims (and unclaimed donors) stay visible.
        return !d.claimedBy || d.claimedBy.id === currentUserId;
      });
    }

    return rows;
  }, [donors, cohortFilter, hideClaimedByOthers, currentUserId]);

  const realCount = donors.filter((d) => d.isReal).length;
  const filteredRealCount = visibleDonors.filter((d) => d.isReal).length;
  const claimedByOthersHiddenCount = donors.filter(
    (d) => d.claimedBy && d.claimedBy.id !== currentUserId,
  ).length;

  return (
    <div style={{ maxWidth: 900 }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 14,
          color: C.amber,
          background: "none",
          border: "none",
          cursor: "pointer",
          marginBottom: 20,
          padding: 0,
          fontWeight: 600,
          fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
        }}
      >
        <ChevronLeft size={18} /> Back
      </button>

      {realCount > 0 && (
        <div
          style={{
            backgroundColor: C.amberLight,
            borderRadius: 16,
            padding: "12px 18px",
            marginBottom: 16,
            fontSize: 13,
            color: C.amberDark,
            fontWeight: 600,
          }}
        >
          {realCount} donor{realCount === 1 ? "" : "s"} carried over from
          your data.{" "}
          {donors.length - realCount > 0 &&
            `${donors.length - realCount} sample donor${
              donors.length - realCount === 1 ? "" : "s"
            } below let you preview the flow.`}
        </div>
      )}

      {/* Cohort filter (Spec §5.7) — narrows real donors only. */}
      {cohorts.length > 0 && realCount > 0 && (
        <CohortFilter
          cohorts={cohorts}
          selectedIds={cohortFilter}
          onToggle={onToggleCohort}
          onClear={onClearCohorts}
        />
      )}

      {/* Hide-claimed toggle. Only renders when at least one donor is
          actually claimed by someone other than the current user —
          otherwise it's just visual noise with no effect. */}
      {claimedByOthersHiddenCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            backgroundColor: C.surface,
            borderRadius: 14,
            boxShadow: shadow.sm,
            padding: "12px 16px",
            marginBottom: 16,
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              userSelect: "none",
              fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            <input
              type="checkbox"
              checked={hideClaimedByOthers}
              onChange={(e) => setHideClaimedByOthers(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: C.amber,
                cursor: "pointer",
              }}
            />
            <UserCheck size={15} color={C.amberDark} strokeWidth={2.4} />
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: C.text,
              }}
            >
              Hide donors claimed by others
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.textSecondary,
              }}
            >
              ({claimedByOthersHiddenCount} hidden when on)
            </span>
          </label>
        </div>
      )}

      <AddContactPanel onAdd={onAddManualContact} />

      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 20,
          boxShadow: shadow.sm,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={onSelectAll}
            style={{
              fontSize: 13,
              color: C.amber,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontFamily:
                "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            {selected.size === donors.length ? "Deselect all" : "Select all"}
          </button>
          <span
            style={{ fontSize: 13, color: C.textTertiary, fontWeight: 600 }}
          >
            {cohortFilter.size > 0
              ? `${filteredRealCount} match · ${selected.size} selected`
              : `${selected.size} selected`}
          </span>
        </div>

        {visibleDonors.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: C.textTertiary,
              fontSize: 14,
              borderTop: `1px solid ${C.borderSubtle}`,
            }}
          >
            No donors match the active cohort filter.
          </div>
        ) : (
          visibleDonors.map((d) => {
            const isSel = selected.has(d.id);
            const visibleCohorts = d.cohorts.slice(0, 3);
            const overflow = Math.max(
              0,
              d.cohorts.length - visibleCohorts.length,
            );
            return (
              <div
                key={d.id}
                onClick={() => onToggle(d.id)}
                style={{
                  padding: "18px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  borderTop: `1px solid ${C.borderSubtle}`,
                  cursor: "pointer",
                  backgroundColor: isSel
                    ? `${C.amberLight}44`
                    : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => {}}
                  style={{ cursor: "pointer", accentColor: C.amber }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 700 }}>
                      {d.ctx.name}
                    </span>
                    {d.ctx.tier && <TierBadge tier={d.ctx.tier} />}
                    {!d.isReal && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          backgroundColor: d.isManual
                            ? C.amberLight
                            : "#F2F2F7",
                          color: d.isManual ? C.amber : C.textTertiary,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {d.isManual ? "New" : "Sample"}
                      </span>
                    )}
                    {d.claimedBy && (
                      <ClaimedBadge
                        claimedBy={d.claimedBy}
                        isMine={d.claimedBy.id === currentUserId}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: C.textSecondary,
                      display: "flex",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    {d.ctx.reactivationScore != null && (
                      <span>Score: {d.ctx.reactivationScore}</span>
                    )}
                    {d.ctx.totalGiven != null && (
                      <span>Lifetime: {fmt(d.ctx.totalGiven)}</span>
                    )}
                    {d.ctx.email && <span>{d.ctx.email}</span>}
                  </div>
                  {visibleCohorts.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 5,
                        marginTop: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {visibleCohorts.map((c) => (
                        <CohortBadge
                          key={c.id}
                          cohort={c}
                          onClick={() => onToggleCohort(c.id)}
                          active={cohortFilter.has(c.id)}
                        />
                      ))}
                      {overflow > 0 && <CohortOverflow count={overflow} />}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <PrimaryButton
          type="button"
          onClick={onGenerate}
          disabled={selected.size === 0}
        >
          <Sparkles size={18} /> Generate {selected.size} Email
          {selected.size === 1 ? "" : "s"}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── Add Contact form ───────────────────────────────────────────────────

/**
 * Inline "Add Contact" panel — toggle button collapses to a single row
 * by default; clicking expands a name + email + optional-notes form.
 * On Add, the parent appends to manualContacts and auto-selects the row.
 *
 * Manual contacts get the same wire shape as samples (donorId=null, no
 * cohorts) so they ride through /api/outreach/drafts without any server
 * changes.
 */
function AddContactPanel({
  onAdd,
}: {
  onAdd: (input: { name: string; email: string; notes: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setEmail("");
    setNotes("");
    setError(null);
  };

  const submit = () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    onAdd({ name: trimmedName, email: trimmedEmail, notes: notes.trim() });
    reset();
    // Keep the panel open so the user can quickly add several contacts.
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 18px",
          borderRadius: 14,
          border: `1.5px dashed ${C.border}`,
          backgroundColor: "transparent",
          color: C.textSecondary,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          marginBottom: 16,
          width: "100%",
          justifyContent: "center",
          transition: "border-color 0.15s, color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = C.amber;
          e.currentTarget.style.color = C.amber;
          e.currentTarget.style.background = "rgba(232,134,12,0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = C.border;
          e.currentTarget.style.color = C.textSecondary;
          e.currentTarget.style.background = "transparent";
        }}
      >
        <UserPlus size={16} /> Add Contact (not in your donor list yet)
      </button>
    );
  }

  return (
    <div
      style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        boxShadow: shadow.sm,
        border: `1.5px solid ${C.amberLight}`,
        padding: "18px 20px",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 700,
            color: C.text,
          }}
        >
          <UserPlus size={16} color={C.amber} /> Add a contact
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          aria-label="Close add-contact form"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: 8,
            border: "none",
            backgroundColor: "transparent",
            color: C.textTertiary,
            cursor: "pointer",
          }}
        >
          <X size={14} />
        </button>
      </div>

      <p
        style={{
          fontSize: 12,
          color: C.textTertiary,
          margin: "0 0 14px",
          lineHeight: 1.5,
        }}
      >
        Adds someone to this campaign without saving them to your donor
        list. Useful for testing (send to yourself) or sending to a new
        prospect not yet in your CRM.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <FieldLabel>Name *</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Jane Donor"
            style={inputStyle}
          />
        </div>
        <div>
          <FieldLabel>Email *</FieldLabel>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="jane@example.com"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <FieldLabel>Notes (optional)</FieldLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the AI should know — relationship, interests, recent context…"
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: C.orangeLight,
            color: C.orange,
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={submit}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            borderRadius: 12,
            border: "none",
            background: brandGradient,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          <Plus size={14} /> Add to campaign
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          style={{
            padding: "10px 18px",
            borderRadius: 12,
            border: "none",
            backgroundColor: "#F2F2F7",
            color: C.textSecondary,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <label
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: C.textSecondary,
        display: "block",
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

/**
 * Compact "Claimed by X" / "Claimed by you" badge surfaced inline with
 * the donor name on the outreach selection screen. Read-only — the
 * claim/release affordance lives on /donors and /lapsed where the
 * claim actually matters.
 */
function ClaimedBadge({
  claimedBy,
  isMine,
}: {
  claimedBy: { name: string | null; email: string };
  isMine: boolean;
}) {
  const displayName =
    claimedBy.name?.trim() || claimedBy.email.split("@")[0];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        backgroundColor: isMine ? C.amberLight : "#F2F2F7",
        color: isMine ? C.amberDark : C.textSecondary,
        border: isMine
          ? `1px solid rgba(232,134,12,0.25)`
          : `1px solid ${C.border}`,
        whiteSpace: "nowrap",
      }}
      title={
        isMine
          ? "You claimed this donor"
          : `Claimed by ${displayName} — turn off "Hide claimed by others" to include`
      }
    >
      <UserCheck size={11} strokeWidth={2.4} />
      {isMine ? "Claimed by you" : `Claimed by ${displayName}`}
    </span>
  );
}



