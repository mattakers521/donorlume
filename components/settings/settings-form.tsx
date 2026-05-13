"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader as LoaderIcon,
} from "lucide-react";

import { C, brandGradient } from "@/lib/design";

type FormState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

type Props = {
  /** Server Action — must return `{ ok: true }` or `{ ok: false, error: string }`. */
  action: (formData: FormData) => Promise<
    { ok: true; message?: string } | { ok: false; error: string }
  >;
  /** Default success message. */
  successMessage?: string;
  children: ReactNode;
  submitLabel?: string;
};

/**
 * Tiny form wrapper used by every /settings page. Shows a success or
 * error strip below the form, manages a `useTransition` loading state,
 * and supports a custom submit label.
 */
export function SettingsForm({
  action,
  children,
  successMessage = "Saved.",
  submitLabel = "Save changes",
}: Props) {
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const formData = new FormData(e.currentTarget);
    setState({ kind: "saving" });
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result.ok) {
          setState({
            kind: "ok",
            message: result.message ?? successMessage,
          });
        } else {
          setState({ kind: "error", message: result.error });
        }
      } catch (e) {
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "Couldn't save.",
        });
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      {children}

      {state.kind === "ok" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            backgroundColor: C.greenLight,
            color: "#1B5E20",
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} />
          {state.message}
        </div>
      )}
      {state.kind === "error" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            backgroundColor: C.redLight,
            color: C.red,
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          <AlertCircle size={16} />
          {state.message}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={pending}
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
            cursor: pending ? "default" : "pointer",
            opacity: pending ? 0.85 : 1,
            boxShadow: "0 8px 20px rgba(232,134,12,0.25)",
            fontFamily: "var(--font-jakarta), sans-serif",
          }}
        >
          {pending && <LoaderIcon size={15} className="spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ─── Field building blocks ─────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: `1.5px solid ${C.border}`,
  fontSize: 14.5,
  color: C.text,
  outline: "none",
  backgroundColor: C.surface,
  boxSizing: "border-box",
  fontFamily: "var(--font-jakarta), sans-serif",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: C.textTertiary,
  letterSpacing: 1,
  textTransform: "uppercase",
  marginBottom: 6,
};

const helpStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: C.textBody,
  marginTop: 6,
  lineHeight: 1.5,
  fontWeight: 500,
};

type FieldProps = {
  name: string;
  label: string;
  help?: string;
  required?: boolean;
};

export function TextRow({
  name,
  label,
  help,
  defaultValue,
  placeholder,
  type = "text",
  required,
  autoComplete,
}: FieldProps & {
  defaultValue?: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "url";
  autoComplete?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={inputBase}
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
      {help && <div style={helpStyle}>{help}</div>}
    </label>
  );
}

export function TextAreaRow({
  name,
  label,
  help,
  defaultValue,
  placeholder,
  rows = 3,
  required,
}: FieldProps & {
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <textarea
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={rows}
        style={{
          ...inputBase,
          resize: "vertical",
          fontFamily: "var(--font-jakarta), sans-serif",
        }}
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
      {help && <div style={helpStyle}>{help}</div>}
    </label>
  );
}

export function SelectRow({
  name,
  label,
  help,
  defaultValue,
  options,
}: FieldProps & {
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        style={{
          ...inputBase,
          appearance: "none",
          backgroundImage:
            "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236E6E73' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 14px center",
          paddingRight: 36,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {help && <div style={helpStyle}>{help}</div>}
    </label>
  );
}

export function ToggleRow({
  name,
  label,
  description,
  defaultChecked = true,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  // Keep the toggle as a real checkbox so FormData picks it up under
  // its `name`. We style it visually via a peer-driven span (CSS would
  // be cleaner but inline keeps this self-contained).
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 16px",
        backgroundColor: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        value="on"
        style={{
          marginTop: 2,
          width: 18,
          height: 18,
          accentColor: C.amber,
          cursor: "pointer",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: C.text,
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              fontSize: 13,
              color: C.textBody,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {description}
          </div>
        )}
      </div>
    </label>
  );
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        backgroundColor: C.surface,
        borderRadius: 20,
        padding: "clamp(20px, 3vw, 28px)",
        border: `1px solid ${C.border}`,
        boxShadow:
          "0 4px 16px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.03)",
        marginBottom: 20,
      }}
    >
      <header style={{ marginBottom: 18 }}>
        <h2
          style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: 22,
            fontWeight: 400,
            color: C.text,
            margin: "0 0 4px",
            letterSpacing: -0.4,
          }}
        >
          {title}
        </h2>
        {description && (
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              color: C.textBody,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            {description}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

/**
 * Subtle amber-accented info note. Used on /settings pages to surface
 * sidebar context (roadmap pointers, support contact prompts) without
 * competing with the actual form. Faint amber wash, hairline left rule,
 * no shadow — quieter than SectionCard.
 */
export function InfoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        marginBottom: 20,
        backgroundColor: "rgba(232,134,12,0.06)",
        borderLeft: `3px solid ${C.amber}`,
        borderRadius: 10,
        fontFamily: "var(--font-jakarta), sans-serif",
      }}
    >
      <Info
        size={16}
        color={C.amberDark}
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: C.text,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: C.textBody,
            fontWeight: 500,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
