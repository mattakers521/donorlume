"use client";

/**
 * Subtle text-styled "Delete This List" trigger + confirmation modal.
 *
 * Used by both ScoredView (donor list with giving history) and
 * AttendeeView (event attendee list). The trigger is intentionally
 * understated — outline-only, neutral color — so a fundraiser reaching
 * for "New Upload" can't accidentally click it and nuke their data.
 * The modal spells the consequences out in full ("all N records",
 * "cannot be undone") to force the deliberate read.
 */

import { useState, useTransition } from "react";
import { AlertTriangle, Loader as LoaderIcon, Trash2 } from "lucide-react";

import { C, shadow } from "@/lib/design";

type Props = {
  /** Record count surfaced in the modal body — "all N records". */
  count: number;
  /** Server-side delete. Should throw on failure so the modal can
   *  surface the error instead of dismissing silently. */
  onConfirm: () => Promise<void>;
};

export function DeleteListButton({ count, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        await onConfirm();
        // Caller closes the modal by unmounting (parent flips state
        // and the whole view re-renders). Defensive close in case the
        // parent kept us mounted.
        setOpen(false);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Couldn't delete the list.",
        );
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 16px",
          borderRadius: 12,
          border: "none",
          background: "transparent",
          color: C.textSecondary,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 3,
          fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
        }}
      >
        <Trash2 size={14} /> Delete this list
      </button>

      {open && (
        <ConfirmModal
          count={count}
          pending={pending}
          error={error}
          onCancel={() => {
            if (pending) return;
            setOpen(false);
            setError(null);
          }}
          onConfirm={confirm}
        />
      )}
    </>
  );
}

function ConfirmModal({
  count,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  count: number;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-list-heading"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(20,20,22,0.55)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 20,
          padding: "28px 28px 22px",
          width: "100%",
          maxWidth: 460,
          boxShadow: shadow.lg,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: C.orangeLight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={22} color={C.orange} />
          </div>
          <h3
            id="delete-list-heading"
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: -0.2,
              color: C.text,
            }}
          >
            Are you sure?
          </h3>
        </div>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 14.5,
            lineHeight: 1.6,
            color: C.text,
            fontWeight: 500,
          }}
        >
          This will remove all{" "}
          <strong>{count.toLocaleString()} records</strong> from this
          upload.{" "}
          <strong style={{ color: C.orange }}>
            This cannot be undone.
          </strong>
        </p>
        {error && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              color: C.orange,
              backgroundColor: C.orangeLight,
              padding: "10px 14px",
              borderRadius: 10,
              fontWeight: 600,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: `1.5px solid ${C.border}`,
              background: "transparent",
              color: C.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              cursor: pending ? "default" : "pointer",
              opacity: pending ? 0.5 : 1,
              fontFamily:
                "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              backgroundColor: C.orange,
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: pending ? "default" : "pointer",
              opacity: pending ? 0.8 : 1,
              boxShadow: "0 6px 16px rgba(212,74,26,0.30)",
              fontFamily:
                "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            {pending ? (
              <>
                <LoaderIcon size={14} className="spin" /> Deleting…
              </>
            ) : (
              <>
                <Trash2 size={14} /> Delete list
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
