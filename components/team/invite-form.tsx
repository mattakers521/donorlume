"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader as LoaderIcon,
} from "lucide-react";

import { brandGradient, C } from "@/lib/design";

type Props = {
  /** Disables the form + shows the upgrade prompt when the cap is hit. */
  disabled?: boolean;
  disabledMessage?: string;
};

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "Member — can use the workspace" },
  { value: "ADMIN", label: "Admin — can invite + manage settings" },
  { value: "VIEWER", label: "Viewer — read-only" },
];

export function InviteForm({ disabled, disabledMessage }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok"; email: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || disabled) return;
    setStatus({ kind: "idle" });
    startTransition(async () => {
      try {
        const res = await fetch("/api/team/invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          invitation?: { email: string };
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setStatus({
          kind: "ok",
          email: body.invitation?.email ?? email,
        });
        setEmail("");
        setRole("MEMBER");
        router.refresh();
      } catch (e) {
        setStatus({
          kind: "error",
          message:
            e instanceof Error
              ? e.message
              : "Couldn't send the invitation.",
        });
      }
    });
  };

  if (disabled) {
    return (
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          backgroundColor: C.amberLight,
          border: `1px solid rgba(232,134,12,0.30)`,
          fontSize: 13.5,
          color: C.amberDark,
          fontWeight: 600,
          lineHeight: 1.55,
        }}
      >
        {disabledMessage ??
          "You've reached your plan's seat limit. Upgrade to invite more team members."}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 220px)",
          gap: 10,
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@yournonprofit.org"
          autoComplete="off"
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = C.amber;
            e.currentTarget.style.boxShadow =
              "0 0 0 4px rgba(232,134,12,0.10)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{
            ...inputStyle,
            appearance: "none",
            backgroundImage:
              "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236E6E73' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 14px center",
            paddingRight: 36,
          }}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={pending || !email.trim()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 22px",
            borderRadius: 12,
            background: brandGradient,
            color: "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            cursor: pending || !email.trim() ? "default" : "pointer",
            opacity: pending || !email.trim() ? 0.6 : 1,
            boxShadow: "0 8px 20px rgba(232,134,12,0.25)",
            fontFamily: "var(--font-jakarta), sans-serif",
          }}
        >
          {pending ? (
            <LoaderIcon size={15} className="spin" />
          ) : (
            <ArrowRight size={15} />
          )}
          Send invitation
        </button>
      </div>

      {status.kind === "ok" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 10,
            backgroundColor: C.greenLight,
            color: "#1B5E20",
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} /> Invitation sent to {status.email}.
        </div>
      )}
      {status.kind === "error" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 10,
            backgroundColor: C.redLight,
            color: C.red,
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          <AlertCircle size={16} /> {status.message}
        </div>
      )}
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: `1.5px solid ${C.border}`,
  fontSize: 14.5,
  color: C.text,
  outline: "none",
  backgroundColor: C.surface,
  fontFamily: "var(--font-jakarta), sans-serif",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
};
