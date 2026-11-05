"use client";

import { useSyncExternalStore } from "react";

import {
  OutreachClient,
  type OutreachClientProps,
} from "@/components/outreach/outreach-client";

/** Same key the Assistants page writes (components/assistants). */
const HANDOFF_KEY = "outreach:assistant-draft";

/** Fits the campaign's customInstructions column (max 2000 chars). */
const MAX_INSTRUCTIONS = 2000;

const noopSubscribe = () => () => {};

/**
 * /outreach/new?from=assistant — prefills the campaign form with an
 * email written on the Assistants page, as custom instructions the
 * per-donor generator personalizes from.
 *
 * Reads sessionStorage through useSyncExternalStore with a null server
 * snapshot, so hydration matches the server HTML; the client then
 * re-renders, and the `key` swap remounts OutreachClient with the
 * merged defaults (its form state is seeded once, at mount).
 */
export function AssistantHandoffOutreach(props: OutreachClientProps) {
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return window.sessionStorage.getItem(HANDOFF_KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const handoff = parseHandoff(raw);
  if (!handoff) return <OutreachClient {...props} />;

  const instructions = [
    "Use this approved draft as the starting point. Keep its message, structure, and ask; personalize it for each donor.",
    "",
    handoff.subject ? `Subject: ${handoff.subject}` : null,
    handoff.subject ? "" : null,
    handoff.body,
  ]
    .filter((l) => l !== null)
    .join("\n")
    .slice(0, MAX_INSTRUCTIONS);

  return (
    <OutreachClient
      key="assistant-handoff"
      {...props}
      defaults={{
        ...props.defaults,
        emailType: handoff.emailType ?? props.defaults.emailType,
        customInstructions: instructions,
      }}
    />
  );
}

type Handoff = { subject: string; body: string; emailType: string | null };

function parseHandoff(raw: string | null): Handoff | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Handoff>;
    if (typeof v.body !== "string" || !v.body.trim()) return null;
    return {
      subject: typeof v.subject === "string" ? v.subject : "",
      body: v.body,
      emailType: typeof v.emailType === "string" ? v.emailType : null,
    };
  } catch {
    return null;
  }
}
