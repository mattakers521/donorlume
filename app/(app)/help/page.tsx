import { HelpCircle, Mail } from "lucide-react";

import { C } from "@/lib/design";
import { HelpChat } from "@/components/help/help-chat";
import { HelpFaq } from "@/components/help/help-faq";

export const dynamic = "force-dynamic";

export default function HelpPage() {
  return (
    <div style={{ padding: "32px clamp(20px, 4vw, 40px) 80px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Page header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: C.amberLight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <HelpCircle size={26} color={C.amber} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontFamily: "var(--font-instrument-serif), Georgia, serif",
                fontSize: "clamp(28px, 4vw, 36px)",
                fontWeight: 400,
                color: C.text,
                margin: "0 0 4px",
                letterSpacing: -1,
              }}
            >
              Help & Support
            </h1>
            <p
              style={{
                fontSize: 15,
                color: C.textBody,
                fontWeight: 500,
                margin: 0,
              }}
            >
              Ask anything about using DonorLume — or browse the FAQ
              below.
            </p>
          </div>
        </header>

        {/* Primary surface: Ask DonorLume — streaming chat */}
        <HelpChat />

        {/* Secondary: searchable, categorized FAQ */}
        <div style={{ marginTop: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                fontFamily:
                  "var(--font-instrument-serif), Georgia, serif",
                fontSize: 26,
                fontWeight: 400,
                color: C.text,
                margin: 0,
                letterSpacing: -0.5,
              }}
            >
              Browse the FAQ
            </h2>
            <p
              style={{
                fontSize: 13,
                color: C.textSecondary,
                fontWeight: 500,
                margin: 0,
              }}
            >
              Common questions, organized by topic.
            </p>
          </div>
          <HelpFaq />
        </div>

        {/* Footer escape hatch — every help page should tell users where
            to land if they're stuck. The AI handles most questions; this
            is the human fallback. */}
        <div
          style={{
            marginTop: 32,
            padding: "20px 22px",
            backgroundColor: C.surfaceHover,
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: C.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <Mail size={18} color={C.amber} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: C.text,
                marginBottom: 2,
              }}
            >
              Need a human?
            </div>
            <div
              style={{
                fontSize: 13,
                color: C.textBody,
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              Email{" "}
              <a
                href="mailto:support@donorlume.com"
                style={{ color: C.amberDark, fontWeight: 700 }}
              >
                support@donorlume.com
              </a>{" "}
              and we&rsquo;ll get back within one business day.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
