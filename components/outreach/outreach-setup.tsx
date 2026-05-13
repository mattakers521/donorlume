"use client";

import { Building2, ChevronRight } from "lucide-react";

import { C, brandGradient, inputStyle, shadow } from "@/lib/design";
import { PrimaryButton } from "@/components/auth-button";

export type CampaignFormState = {
  orgName: string;
  mission: string;
  campaignName: string;
  senderName: string;
  senderTitle: string;
  tone: string;
  emailType: string;
  customInstructions: string;
};

const TONES = [
  { id: "warm", label: "Warm & Personal" },
  { id: "professional", label: "Professional" },
  { id: "impact", label: "Impact-Driven" },
  { id: "casual", label: "Casual" },
];

const EMAIL_TYPES = [
  { id: "reactivation", label: "Reactivation" },
  { id: "impact_update", label: "Impact Update" },
  { id: "event_invite", label: "Event Invite" },
  { id: "year_end", label: "Year-End Appeal" },
];

type Props = {
  config: CampaignFormState;
  onChange: (next: CampaignFormState) => void;
  onContinue: () => void;
};

export function OutreachSetup({ config, onChange, onContinue }: Props) {
  const update = <K extends keyof CampaignFormState>(
    key: K,
    value: CampaignFormState[K],
  ) => onChange({ ...config, [key]: value });

  const valid = !!config.orgName.trim() && !!config.mission.trim();

  return (
    <div style={{ maxWidth: 700 }}>
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 24,
          boxShadow: shadow.md,
          padding: 32,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 800,
            margin: "0 0 24px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Building2 size={20} color={C.amber} /> Organization & Outreach
          Settings
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <Label>Organization *</Label>
            <input
              value={config.orgName}
              onChange={(e) => update("orgName", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <Label>Campaign</Label>
            <input
              value={config.campaignName}
              onChange={(e) => update("campaignName", e.target.value)}
              placeholder="2026 Annual Fund"
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <Label>Mission *</Label>
            <textarea
              value={config.mission}
              onChange={(e) => update("mission", e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <Label>Sender Name</Label>
            <input
              value={config.senderName}
              onChange={(e) => update("senderName", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <Label>Title</Label>
            <input
              value={config.senderTitle}
              onChange={(e) => update("senderTitle", e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 12px" }}>
          Tone
        </h3>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          {TONES.map((t) => (
            <PillButton
              key={t.id}
              label={t.label}
              active={config.tone === t.id}
              onClick={() => update("tone", t.id)}
            />
          ))}
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 12px" }}>
          Email Type
        </h3>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          {EMAIL_TYPES.map((t) => (
            <PillButton
              key={t.id}
              label={t.label}
              active={config.emailType === t.id}
              onClick={() => update("emailType", t.id)}
            />
          ))}
        </div>

        <div style={{ marginBottom: 28 }}>
          <Label>Custom Instructions</Label>
          <textarea
            value={config.customInstructions}
            onChange={(e) => update("customInstructions", e.target.value)}
            placeholder="e.g. Mention our June 14 gala…"
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <PrimaryButton
          type="button"
          onClick={onContinue}
          disabled={!valid}
          style={{ background: valid ? brandGradient : "#E5E5EA" }}
        >
          Select Donors <ChevronRight size={18} />
        </PrimaryButton>
      </div>
    </div>
  );
}

function Label({ children }: { children: string }) {
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

function PillButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 20px",
        borderRadius: 12,
        border: "none",
        backgroundColor: active ? C.amberLight : "#F2F2F7",
        color: active ? C.amber : C.textSecondary,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
      }}
    >
      {label}
    </button>
  );
}
