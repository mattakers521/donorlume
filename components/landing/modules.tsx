import {
  BarChart3,
  Mail,
  Search,
  Upload,
  type LucideIcon,
} from "lucide-react";

import { C } from "@/lib/design";

type Module = {
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  number: string;
  heading: string;
  body: string;
};

const MODULES: Module[] = [
  {
    Icon: Upload,
    iconColor: C.amberOnDark,
    iconBg: "rgba(245,183,49,0.12)",
    number: "01",
    heading: "Your donors, organized in minutes.",
    body: "Upload a CSV from any CRM. DonorLume auto-detects your columns and classifies every donor into the cohorts that matter — by giving behavior, by segment, and by trajectory. No manual tagging. No pivot tables. Just clarity.",
  },
  {
    Icon: BarChart3,
    iconColor: C.orange,
    iconBg: "rgba(212,74,26,0.12)",
    number: "02",
    heading: "Know who to call first. For every cohort.",
    body: "Our scoring engine analyzes every donor across four dimensions — recency, frequency, monetary value, and tenure — then layers on cohort-specific intelligence. A lapsed $50K gala attendee is a different conversation than a lapsed $25 sustainer.",
  },
  {
    Icon: Search,
    iconColor: C.gold,
    iconBg: "rgba(245,183,49,0.12)",
    number: "03",
    heading: "Find funders aligned with your mission.",
    body: "Search public IRS 990 filings to discover foundations and grantmakers already giving to causes like yours. See their revenue, assets, grant history, and actual tax filings. Save the best matches to your pipeline.",
  },
  {
    Icon: Mail,
    iconColor: C.purple,
    iconBg: "rgba(175,82,222,0.14)",
    number: "04",
    heading: "Personalized outreach for every cohort.",
    body: "Select donors from any cohort and generate outreach that references their actual giving history, their relationship with your organization, and your mission. A reactivation email reads completely differently from a renewal request — because it should.",
  },
];

export function LandingModules() {
  return (
    <section
      id="how-it-works"
      className="landing-dot-pattern"
      style={{
        padding: "88px 24px",
        backgroundColor: C.dark,
        color: C.textOnDark,
        position: "relative",
      }}
    >
      <div style={{ position: "relative", maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: 56,
            maxWidth: 820,
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
            How It Works
          </div>
          <h2
            className="landing-section-h2"
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontWeight: 400,
              color: "#fff",
              margin: "0 0 18px",
            }}
          >
            Upload your donors. We&rsquo;ll show you what
            you&rsquo;ve been missing.
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
            Four steps from CSV to a fundraising program that knows every
            donor by name — and by cohort.
          </p>
        </div>

        <div className="landing-grid-4">
          {MODULES.map((m) => {
            const { Icon } = m;
            return (
              <div
                key={m.number}
                style={{
                  backgroundColor: C.darkPanel,
                  border: `1px solid ${C.borderDark}`,
                  borderRadius: 20,
                  padding: 28,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      backgroundColor: m.iconBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={22} color={m.iconColor} />
                  </div>
                  <span
                    style={{
                      fontFamily:
                        "var(--font-instrument-serif), Georgia, serif",
                      fontSize: 36,
                      fontWeight: 400,
                      color: "rgba(255,255,255,0.25)",
                      letterSpacing: -1,
                      lineHeight: 1,
                    }}
                  >
                    {m.number}
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: 19,
                    fontWeight: 700,
                    color: "#fff",
                    margin: 0,
                    letterSpacing: -0.3,
                    lineHeight: 1.25,
                  }}
                >
                  {m.heading}
                </h3>
                <p
                  style={{
                    fontSize: 14.5,
                    lineHeight: 1.65,
                    color: C.textOnDarkSecondary,
                    fontWeight: 500,
                    margin: 0,
                  }}
                >
                  {m.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
