"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader as LoaderIcon, X } from "lucide-react";

import { C } from "@/lib/design";

export function RevokeInviteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (pending) return;
    startTransition(async () => {
      try {
        await fetch(`/api/team/invites?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        router.refresh();
      } catch {
        /* swallow — refresh on next page visit reflects truth */
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label="Revoke invitation"
      title="Revoke invitation"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 8,
        border: "none",
        backgroundColor: "transparent",
        color: C.textSecondary,
        cursor: pending ? "default" : "pointer",
      }}
    >
      {pending ? <LoaderIcon size={14} className="spin" /> : <X size={14} />}
    </button>
  );
}
