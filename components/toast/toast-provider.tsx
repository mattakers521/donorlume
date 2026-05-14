"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles, X } from "lucide-react";

import { C, brandGradient } from "@/lib/design";

type ToastTone = "success" | "info";
type ToastKind = "default" | "onboarding";

/**
 * Either pass `href` for a real navigation link, OR `onClick` for an
 * in-page callback (scroll, focus, open a modal, etc). NEVER pass both.
 * The discriminated union forces the call-site to pick exactly one so
 * we don't ship code where a click both navigates and runs a handler.
 */
type ToastAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

export type ToastInput = {
  title: string;
  body?: string;
  tone?: ToastTone;
  /** Optional CTA — either a navigation link OR a callback. */
  action?: ToastAction;
  /** ms before auto-dismiss. Defaults: 6000 for default toasts, 15000 for
   *  onboarding (a milestone the user actually needs time to read + act on). */
  duration?: number;
  /**
   * Visual treatment.
   *   • "default"     — small corner toast, 6s, link-style action.
   *   • "onboarding"  — same corner placement but 15s, larger heading,
   *                     and the action renders as a full-width gradient
   *                     CTA button (not a text link). Used for the
   *                     "Step complete!" milestones so the next action
   *                     is impossible to miss.
   *
   * Position is `fixed` either way, so the toast stays pinned to the
   * viewport as the user scrolls — "sticky" in the colloquial sense.
   */
  kind?: ToastKind;
};

type Toast = ToastInput & { id: number };

const ToastCtx = createContext<{
  toast: (input: ToastInput) => void;
} | null>(null);

/**
 * sessionStorage key for the active-toast snapshot.
 *
 * Why we persist the active toast at all: React parent re-renders
 * (e.g. `router.refresh()` after a server-action completion) can in
 * some flows trigger a `ToastProvider` unmount + remount — which
 * blows away the in-memory `current` state and the `setTimeout` that
 * was supposed to keep the toast on screen for its full TTL. The
 * snapshot lets a remounted provider restore the visible toast with
 * the correct *remaining* time.
 *
 * Serialization caveat: action callbacks (`onClick`) are lost in the
 * JSON round-trip — we degrade gracefully by dropping the callback
 * on restore (clicking the action button just dismisses the toast).
 * `href`-based actions survive unchanged.
 */
const TOAST_STORAGE_KEY = "dl_toast_active";

type StoredToast = {
  toast: Toast;
  /** Unix ms when the original timer was supposed to fire. */
  expiresAt: number;
};

function readStoredToast(): StoredToast | null {
  try {
    const raw = sessionStorage.getItem(TOAST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToast;
    if (
      !parsed ||
      typeof parsed.expiresAt !== "number" ||
      !parsed.toast ||
      typeof parsed.toast.id !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredToast(toast: Toast, expiresAt: number) {
  try {
    // JSON drops function refs silently — onClick action handlers
    // can't survive a remount/restore. We keep the {label, href} half
    // of the discriminated union if present; otherwise leave action
    // undefined on the stored copy so the post-restore button is a
    // bare dismiss-only affordance with the right label.
    const serializableAction =
      toast.action && "href" in toast.action && toast.action.href
        ? { label: toast.action.label, href: toast.action.href }
        : toast.action
          ? { label: toast.action.label }
          : undefined;

    sessionStorage.setItem(
      TOAST_STORAGE_KEY,
      JSON.stringify({
        toast: { ...toast, action: serializableAction },
        expiresAt,
      }),
    );
  } catch {
    // Private-browsing modes can throw — fall back to in-memory only.
  }
}

function clearStoredToast() {
  try {
    sessionStorage.removeItem(TOAST_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Single-slot toast system. Latest toast replaces any prior one — fine
 * for the onboarding flow (each completion fires exactly once thanks to
 * the server-side firstX flag). If we ever need stacked toasts, swap
 * `current` for an array.
 *
 * Two trace points fire to the browser console under `[toast-trace]`
 * so a stuck toast can be diagnosed: provider mount/unmount, every
 * `toast()` call (with the chosen TTL), every timer fire, every
 * manual dismiss, every storage restore. Cheap to keep in production
 * — fires at most a few times per page session.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Toast | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Restore from sessionStorage on mount ───────────────────────────
  // Runs at-most-once. If a toast was active before the provider
  // remounted (e.g. dev fast-refresh, router.refresh tree reshuffle),
  // bring it back with the remaining TTL.
  useEffect(() => {
    console.log("[toast-trace] ToastProvider MOUNT");
    const stored = readStoredToast();
    if (!stored) {
      console.log("[toast-trace] no stored toast on mount");
      return () => {
        console.log("[toast-trace] ToastProvider UNMOUNT");
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
    const remainingMs = stored.expiresAt - Date.now();
    if (remainingMs <= 0) {
      console.log(
        "[toast-trace] stored toast already expired — clearing",
      );
      clearStoredToast();
      return () => {
        console.log("[toast-trace] ToastProvider UNMOUNT");
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
    console.log(
      `[toast-trace] restoring toast id=${stored.toast.id} kind=${stored.toast.kind ?? "default"} remainingMs=${remainingMs}`,
    );
    // Keep idRef ahead of the restored id so subsequent toast() calls
    // generate strictly-monotonic ids and never collide with restored.
    idRef.current = Math.max(idRef.current, stored.toast.id);
    setCurrent(stored.toast);
    timerRef.current = setTimeout(() => {
      console.log(
        `[toast-trace] restored timer fired for id=${stored.toast.id}`,
      );
      clearStoredToast();
      setCurrent((c) => (c?.id === stored.toast.id ? null : c));
      timerRef.current = null;
    }, remainingMs);
    return () => {
      console.log("[toast-trace] ToastProvider UNMOUNT");
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismiss = useCallback(() => {
    console.log("[toast-trace] dismiss() called");
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    clearStoredToast();
    setCurrent(null);
  }, []);

  const toast = useCallback((input: ToastInput) => {
    idRef.current += 1;
    const next: Toast = { id: idRef.current, ...input };
    setCurrent(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    // Onboarding milestones get a longer dwell — the user needs time to
    // read the body AND click the CTA before it disappears. 15s vs 6s
    // for everything else.
    const fallbackMs = input.kind === "onboarding" ? 15_000 : 6_000;
    const ttl = input.duration ?? fallbackMs;
    const expiresAt = Date.now() + ttl;
    console.log(
      `[toast-trace] toast() id=${next.id} kind=${input.kind ?? "default"} ttl=${ttl}ms title="${input.title}"`,
    );
    writeStoredToast(next, expiresAt);
    timerRef.current = setTimeout(() => {
      console.log(`[toast-trace] timer fired for id=${next.id}`);
      clearStoredToast();
      setCurrent((c) => (c?.id === next.id ? null : c));
      timerRef.current = null;
    }, ttl);
  }, []);

  const ctxValue = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={ctxValue}>
      {children}
      {current && <ToastView toast={current} onDismiss={dismiss} />}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // No-op fallback so components that might mount outside the provider
    // (tests, isolated stories) never crash. Real providers always wrap.
    return {
      toast: () => {
        /* no-op */
      },
    };
  }
  return ctx;
}

/**
 * Renders the toast's CTA as either a Next.js Link (`href` provided)
 * or a `<button>` (`onClick` provided). The Link path NEVER fires for
 * onClick callbacks, so callbacks like "scroll to first draft" can't
 * accidentally route through Next.js's hash-href handling.
 *
 * The onboarding/default kind controls visual size + weight; the
 * routing-vs-callback decision is independent.
 */
function ToastActionButton({
  action,
  kind,
  onDismiss,
}: {
  action: NonNullable<ToastInput["action"]>;
  kind: ToastKind;
  onDismiss: () => void;
}) {
  const isOnboarding = kind === "onboarding";
  const styles: React.CSSProperties = isOnboarding
    ? {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 14,
        padding: "12px 20px",
        borderRadius: 12,
        background: brandGradient,
        color: "#fff",
        fontSize: 14,
        fontWeight: 800,
        textDecoration: "none",
        letterSpacing: 0.2,
        boxShadow: "0 8px 22px rgba(232,134,12,0.34)",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-jakarta), sans-serif",
      }
    : {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        marginTop: 10,
        color: C.amberDark,
        fontSize: 13,
        fontWeight: 700,
        textDecoration: "none",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontFamily: "var(--font-jakarta), sans-serif",
      };
  const arrowSize = isOnboarding ? 15 : 13;

  if ("href" in action && action.href) {
    return (
      <Link href={action.href} onClick={onDismiss} style={styles}>
        {action.label} <ArrowRight size={arrowSize} />
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        action.onClick?.();
        onDismiss();
      }}
      style={styles}
    >
      {action.label} <ArrowRight size={arrowSize} />
    </button>
  );
}

function ToastView({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const Icon = toast.tone === "info" ? Sparkles : CheckCircle2;
  const isOnboarding = toast.kind === "onboarding";
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "clamp(16px, 3vw, 28px)",
        right: "clamp(16px, 3vw, 28px)",
        left: "clamp(16px, 3vw, 28px)",
        // Onboarding milestone toasts get more horizontal room for the
        // larger CTA button + multi-line body.
        maxWidth: isOnboarding ? 440 : 380,
        marginLeft: "auto",
        zIndex: 80,
        animation: "toast-in 0.25s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: 18,
          padding: 2,
          background: brandGradient,
          boxShadow: isOnboarding
            ? "0 24px 60px rgba(20,20,22,0.28), 0 8px 20px rgba(232,134,12,0.32)"
            : "0 18px 50px rgba(20,20,22,0.20), 0 6px 16px rgba(232,134,12,0.22)",
        }}
      >
        <div
          style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            padding: isOnboarding ? "20px 22px 22px" : "16px 18px 18px",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            fontFamily: "var(--font-jakarta), sans-serif",
          }}
        >
          <div
            aria-hidden
            style={{
              width: isOnboarding ? 42 : 36,
              height: isOnboarding ? 42 : 36,
              borderRadius: 12,
              background: brandGradient,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 6px 14px rgba(232,134,12,0.30)",
            }}
          >
            <Icon size={isOnboarding ? 22 : 18} strokeWidth={2.4} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: isOnboarding ? 16 : 14,
                fontWeight: 800,
                color: C.text,
                marginBottom: isOnboarding ? 4 : 2,
                letterSpacing: -0.1,
              }}
            >
              {toast.title}
            </div>
            {toast.body && (
              <div
                style={{
                  fontSize: isOnboarding ? 14 : 13,
                  lineHeight: 1.55,
                  color: C.textBody,
                  fontWeight: 500,
                }}
              >
                {toast.body}
              </div>
            )}
            {toast.action && (
              <ToastActionButton
                action={toast.action}
                kind={isOnboarding ? "onboarding" : "default"}
                onDismiss={onDismiss}
              />
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{
              background: "transparent",
              border: "none",
              padding: 4,
              cursor: "pointer",
              color: C.textTertiary,
              flexShrink: 0,
              marginTop: -2,
              marginRight: -4,
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
