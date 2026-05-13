"use client";

import type {
  ChangeEvent,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { AlertCircle } from "lucide-react";

import { C, inputStyle } from "@/lib/design";

type LabelProps = { children: string };
function FieldLabel({ children }: LabelProps) {
  return (
    <label
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: C.textSecondary,
        display: "block",
        marginBottom: 8,
      }}
    >
      {children}
    </label>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "style">;

export function TextField({
  label,
  value,
  onChange,
  ...rest
}: TextFieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <FieldLabel>{label}</FieldLabel>
      <input
        {...rest}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

type TextareaProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
} & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "style" | "rows"
>;

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  ...rest
}: TextareaProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        {...rest}
        value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
        rows={rows}
        style={{ ...inputStyle, resize: "vertical" }}
      />
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        backgroundColor: C.orangeLight,
        borderRadius: 14,
        padding: "12px 16px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <AlertCircle size={16} color={C.orange} style={{ flexShrink: 0 }} />
      <span
        style={{
          fontSize: 13,
          color: C.orange,
          fontWeight: 600,
          lineHeight: 1.4,
        }}
      >
        {message}
      </span>
    </div>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "20px 0",
      }}
    >
      <div style={{ flex: 1, height: 1, backgroundColor: C.border }} />
      <span
        style={{
          fontSize: 12,
          color: C.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 1,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, backgroundColor: C.border }} />
    </div>
  );
}
