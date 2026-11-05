"use client";

import { useSyncExternalStore } from "react";

import {
  OutreachClient,
  type OutreachClientProps,
} from "@/components/outreach/outreach-client";
import { MAX_STARTING_DRAFT_LENGTH } from "@/lib/outreach/prompt";

/** Same key the Assistants page writes (components/assistants). */
const HANDOFF_KEY = "outreach:assistant-draft";

const noopSubscribe = () => () => {};

/**
 * /outreach/new?from=assistant — opens the campaign form with the email
 * written on the Assistants page in a labeled "Starting draft" field.
 * Generation personalizes that draft per donor (CampaignConfig.startingDraft);
 * Custom Instructions is left to the user.
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

  const draft = handoff.subject
    ? `Subject: ${handoff.subject}\n\n${handoff.body}`
    : handoff.body;

  return (
    <OutreachClient
      key="assistant-handoff"
      {...props}
      defaults={{
        ...props.defaults,
        emailType: handoff.emailType ?? props.defaults.emailType,
        startingDraft: draft.slice(0, MAX_STARTING_DRAFT_LENGTH),
        startingDraftSource: handoff.source,
      }}
    />
  );
}

type Handoff = {
  subject: string;
  body: string;
  emailType: string | null;
  source: string;
};

function parseHandoff(raw: string | null): Handoff | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Handoff>;
    if (typeof v.body !== "string" || !v.body.trim()) return null;
    return {
      subject: typeof v.subject === "string" ? v.subject : "",
      body: v.body,
      emailType: typeof v.emailType === "string" ? v.emailType : null,
      source:
        typeof v.source === "string" && v.source.trim()
          ? v.source
          : "AI Assistants",
    };
  } catch {
    return null;
  }
}
