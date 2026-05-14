"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader as LoaderIcon, UserCheck, UserPlus, X } from "lucide-react";

import { C, brandGradient } from "@/lib/design";

export type ClaimedByInfo = {
  id: string;
  name: string | null;
  email: string;
} | null;

type Props = {
  donorId: string;
  claimedBy: ClaimedByInfo;
  /** ID of the user clicking the button. Drives "Claimed by you" vs other. */
  currentUserId: string;
  /** OWNER/ADMIN can release anyone's claim; MEMBER/VIEWER only their own. */
  orgRole: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  /**
   * Optional optimistic-update hook. Called with the refreshed claim
   * info as soon as the server responds — used by the lapsed view to
   * mutate its in-memory donor list (which doesn't live on the server
   * until a re-fetch). Pages backed by server components can omit it
   * and rely on the built-in `router.refresh()`.
   */
  onUpdate?: (next: { claimedById: string | null; claimedAt: Date | null; claimedBy: ClaimedByInfo }) => void;
  /** Sizing variant. "sm" for table rows, "md" for card layouts. */
  size?: "sm" | "md";
};

/**
 * Three-state claim affordance:
 *   • Unclaimed             → amber "Claim" button
 *   • Claimed by current user → amber-tinted "Claimed by you" pill + × release
 *   • Claimed by someone else → neutral "Claimed by Sarah" pill (no actions
 *                               unless caller is OWNER/ADMIN, in which case
 *                               the × is still rendered)
 *
 * Hooks: POST /api/donors/[id]/{claim,release}. Both endpoints are
 * idempotent and tenant-scoped server-side. The button optimistically
 * disables itself during the fetch and surfaces server-side conflict
 * messages (e.g. "Already claimed by Sarah") inline via a `title`.
 */
export function ClaimButton({
  donorId,
  claimedBy,
  currentUserId,
  orgRole,
  onUpdate,
  size = "sm",
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<"idle" | "claiming" | "releasing">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const isClaimedByMe = claimedBy?.id === currentUserId;
  const isClaimedByOther = !!claimedBy && !isClaimedByMe;
  const isPrivileged = orgRole === "OWNER" || orgRole === "ADMIN";
  const canRelease = isClaimedByMe || (isClaimedByOther && isPrivileged);

  const padding = size === "sm" ? "5px 10px" : "8px 14px";
  const fontSize = size === "sm" ? 11.5 : 13;
  const iconSize = size === "sm" ? 12 : 14;

  const handleClaim = async () => {
    if (pending !== "idle") return;
    setError(null);
    setPending("claiming");
    try {
      const res = await fetch(
        `/api/donors/${encodeURIComponent(donorId)}/claim`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        donor?: { claimedById: string | null; claimedAt: string | null; claimedBy: ClaimedByInfo };
        error?: string;
        claimedBy?: string;
      };
      if (!res.ok) {
        const msg =
          res.status === 409 && body.claimedBy
            ? `Already claimed by ${body.claimedBy}.`
            : body.error ?? `Couldn't claim (HTTP ${res.status}).`;
        setError(msg);
        return;
      }
      if (body.donor && onUpdate) {
        onUpdate({
          claimedById: body.donor.claimedById,
          claimedAt: body.donor.claimedAt ? new Date(body.donor.claimedAt) : null,
          claimedBy: body.donor.claimedBy,
        });
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setPending("idle");
    }
  };

  const handleRelease = async () => {
    if (pending !== "idle") return;
    setError(null);
    setPending("releasing");
    try {
      const res = await fetch(
        `/api/donors/${encodeURIComponent(donorId)}/release`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        donor?: { claimedById: string | null; claimedAt: string | null; claimedBy: ClaimedByInfo };
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? `Couldn't release (HTTP ${res.status}).`);
        return;
      }
      if (body.donor && onUpdate) {
        onUpdate({
          claimedById: null,
          claimedAt: null,
          claimedBy: null,
        });
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setPending("idle");
    }
  };

  // ─── Unclaimed → Claim CTA ──────────────────────────────────────────
  if (!claimedBy) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleClaim();
        }}
        disabled={pending !== "idle"}
        title={error ?? "Claim this donor so teammates know you're cultivating them"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding,
          borderRadius: 8,
          border: "none",
          background: brandGradient,
          color: "#fff",
          fontSize,
          fontWeight: 700,
          cursor: pending === "idle" ? "pointer" : "default",
          opacity: pending === "idle" ? 1 : 0.7,
          fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          whiteSpace: "nowrap",
          boxShadow: "0 4px 10px rgba(232,134,12,0.22)",
        }}
      >
        {pending === "claiming" ? (
          <LoaderIcon size={iconSize} className="spin" />
        ) : (
          <UserPlus size={iconSize} strokeWidth={2.4} />
        )}
        Claim
      </button>
    );
  }

  // ─── Claimed → pill + optional release ──────────────────────────────
  const displayName =
    claimedBy.name?.trim() || claimedBy.email.split("@")[0];

  const claimedByMeStyle = {
    backgroundColor: C.amberLight,
    color: C.amberDark,
    border: `1px solid rgba(232,134,12,0.30)`,
  };
  const claimedByOtherStyle = {
    backgroundColor: "#F2F2F7",
    color: C.textSecondary,
    border: `1px solid ${C.border}`,
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: size === "sm" ? "4px 4px 4px 10px" : "6px 6px 6px 12px",
        borderRadius: 100,
        fontSize,
        fontWeight: 700,
        whiteSpace: "nowrap",
        fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
        ...(isClaimedByMe ? claimedByMeStyle : claimedByOtherStyle),
      }}
      title={
        error ??
        (isClaimedByMe
          ? "You claimed this donor. Click × to release."
          : `Claimed by ${displayName}${
              isPrivileged ? " — click × to release as Admin" : ""
            }.`)
      }
    >
      <UserCheck size={iconSize} strokeWidth={2.4} />
      {isClaimedByMe ? "Claimed by you" : `Claimed by ${displayName}`}
      {canRelease && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRelease();
          }}
          disabled={pending !== "idle"}
          aria-label="Release claim"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: size === "sm" ? 18 : 20,
            height: size === "sm" ? 18 : 20,
            borderRadius: "50%",
            border: "none",
            background: isClaimedByMe ? C.amber : C.textTertiary,
            color: "#fff",
            cursor: pending === "idle" ? "pointer" : "default",
            opacity: pending === "idle" ? 1 : 0.6,
            flexShrink: 0,
          }}
        >
          {pending === "releasing" ? (
            <LoaderIcon size={10} className="spin" />
          ) : (
            <X size={10} strokeWidth={3} />
          )}
        </button>
      )}
    </span>
  );
}
