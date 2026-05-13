"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader as LoaderIcon } from "lucide-react";

import { brandGradient, C } from "@/lib/design";

type Props = { token: string };

export function AcceptInviteButton({ token }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/team/invites/${token}/accept`, {
          method: "POST",
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !body.ok) {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        router.push("/dashboard");
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Couldn't accept the invitation — try again.",
        );
      }
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          padding: "14px 22px",
          borderRadius: 14,
          background: brandGradient,
          color: "#fff",
          border: "none",
          fontSize: 15,
          fontWeight: 700,
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.85 : 1,
          boxShadow: "0 12px 30px rgba(232,134,12,0.30)",
          fontFamily: "var(--font-jakarta), sans-serif",
        }}
      >
        {pending ? (
          <LoaderIcon size={16} className="spin" />
        ) : (
          <ArrowRight size={16} />
        )}
        Accept invitation
      </button>
      {error && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            backgroundColor: C.redLight,
            color: C.red,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
