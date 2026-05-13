import {
  BarChart3,
  FileText,
  Layers,
  Lock,
  Mail,
  Send,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";

import { C } from "@/lib/design";

type Feature = {
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  heading: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    Icon: Layers,
    iconColor: C.amberOnDark,
    iconBg: "rgba(245,183,49,0.14)",
    heading: "Smart Segments",
    body: "Donors are automatically classified into behavioral, engagement, entity, and trajectory cohorts the moment you upload. No manual tagging required.",
  },
  {
    Icon: BarChart3,
    iconColor: C.orange,
    iconBg: "rgba(212,74,26,0.14)",
    heading: "Cohort Scoring",
    body: "Every cohort gets its own scoring context. A lapsed $50K foundation funder is scored differently than a lapsed $50 monthly sustainer — because the reactivation strategy is completely different.",
  },
  {
    Icon: FileText,
    iconColor: C.gold,
    iconBg: "rgba(245,183,49,0.14)",
    heading: "Foundation Discovery",
    body: "Search real IRS 990 filings — revenue, assets, grants paid, officer names, and filing PDFs. Find grantmakers aligned with your cause.",
  },
  {
    Icon: Sparkles,
    iconColor: C.purple,
    iconBg: "rgba(175,82,222,0.16)",
    heading: "AI-Powered Outreach",
    body: "Each draft is written individually using real donor data and cohort context. A corporate sponsor renewal reads nothing like a major gift reactivation — because it shouldn't.",
  },
  {
    Icon: Send,
    iconColor: C.amberOnDark,
    iconBg: "rgba(245,183,49,0.14)",
    heading: "Send & Track",
    body: "Send outreach directly from DonorLume. Track opens, clicks, and responses by donor, by campaign, and by cohort. Know what's working for who.",
  },
  {
    Icon: Mail,
    iconColor: C.orange,
    iconBg: "rgba(212,74,26,0.14)",
    heading: "Board-Ready Reporting",
    body: "Cohort dashboards, campaign performance, reactivation rates, and pipeline status — packaged for your next board meeting.",
  },
  {
    Icon: Upload,
    iconColor: C.green,
    iconBg: "rgba(52,199,89,0.14)",
    heading: "Works With Any Platform",
    body: "Export from any CRM (Bloomerang, Salesforce, Little Green Light, Kindful, Neon CRM, DonorPerfect) or event platform (OneCause, GiveButter, BetterUnite, Givesmart, Greater Giving). DonorLume auto-detects your columns and sits alongside your tools as the intelligence layer — not a replacement.",
  },
  {
    Icon: Lock,
    iconColor: C.amberOnDark,
    iconBg: "rgba(245,183,49,0.14)",
    heading: "Your Data, Your Control",
    body: "Every organization's data is completely isolated. We never sell, share, or mine your donor information. Export or delete anytime. No contracts.",
  },
];

export function LandingFeatures() {
  return (
    <section
      id="features"
      className="landing-dot-pattern"
      style={{
        padding: "88px 24px",
        backgroundColor: C.darkWarm,
        color: C.textOnDark,
        position: "relative",
      }}
    >
      <div style={{ position: "relative", maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: 48,
            maxWidth: 760,
            marginInline: "auto",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: C.amberOnDark,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Features
          </div>
          <h2
            className="landing-section-h2"
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontWeight: 400,
              color: "#fff",
              margin: "0 0 16px",
            }}
          >
            Everything you need.
            <br />
            Nothing you don&rsquo;t.
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: C.textOnDarkBody,
              fontWeight: 500,
              margin: 0,
            }}
          >
            Built for fundraisers who don&rsquo;t have time to be data
            analysts.
          </p>
        </div>

        <div className="landing-grid-4">
          {FEATURES.map((f) => {
            const { Icon } = f;
            return (
              <div
                key={f.heading}
                style={{
                  padding: 24,
                  borderRadius: 18,
                  backgroundColor: C.darkPanelWarm,
                  border: `1px solid ${C.borderDark}`,
                  transition: "border-color 0.2s, transform 0.2s",
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 11,
                    backgroundColor: f.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Icon size={20} color={f.iconColor} />
                </div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    margin: "0 0 8px",
                    color: "#fff",
                    letterSpacing: -0.2,
                  }}
                >
                  {f.heading}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: C.textOnDarkSecondary,
                    fontWeight: 500,
                    margin: 0,
                  }}
                >
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
