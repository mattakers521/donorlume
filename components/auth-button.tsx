"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader as LoaderIcon } from "lucide-react";

import { C, brandGradient, shadow } from "@/lib/design";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
};

/** Primary CTA — amber→orange gradient, full width, with disabled + loading states. */
export function PrimaryButton({
  loading = false,
  loadingLabel,
  disabled,
  children,
  style,
  ...rest
}: Props) {
  const inactive = disabled || loading;
  return (
    <button
      {...rest}
      disabled={inactive}
      style={{
        width: "100%",
        padding: 16,
        borderRadius: 14,
        border: "none",
        background: inactive ? "#E5E5EA" : brandGradient,
        color: "#fff",
        fontSize: 16,
        fontWeight: 700,
        cursor: inactive ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        boxShadow: inactive ? "none" : shadow.md,
        transition: "all 0.2s",
        fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
        ...style,
      }}
    >
      {loading ? (
        <>
          <LoaderIcon size={18} className="spin" />
          {loadingLabel ?? "Loading…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Secondary outline button — used for the Google OAuth tile. */
export function GoogleButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: 14,
        borderRadius: 14,
        border: `1.5px solid ${C.border}`,
        backgroundColor: C.surface,
        color: C.text,
        fontSize: 15,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        transition: "background 0.15s, box-shadow 0.15s",
        fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = C.surfaceHover;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = C.surface;
      }}
    >
      <GoogleGlyph size={18} />
      Continue with Google
    </button>
  );
}

function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
