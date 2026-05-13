import { ArrowRight, Compass, LifeBuoy, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { C, brandGradient, shadow } from "@/lib/design";

type Path = {
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  label: string;
  heading: string;
  body: string;
};

const PATHS: Path[] = [
  {
    Icon: Compass,
    iconColor: C.amber,
    iconBg: C.amberLight,
    label: "Path 01 · Acquire",
    heading: "Find them before your competitors do.",
    body: "Discover aligned foundations from public filings. Identify prospects who match your best donor profiles. Generate personalized first-touch outreach that references their interests, not just their name. Build a pipeline you can actually see and manage.",
  },
  {
    Icon: LifeBuoy,
    iconColor: C.orange,
    iconBg: C.orangeLight,
    label: "Path 02 · Retain",
    heading: "Stop the leaks. Win them back.",
    body: "See which donors are drifting before they lapse. Identify which lapsed supporters are still giving to other organizations — they haven't stopped being generous, they've just stopped giving to you. Score every lapsed donor by reactivation likelihood and reach out with the right message at the right time.",
  },
];

export function LandingTwoPaths() {
  return (
    <section
      id="two-paths"
      style={{
        padding: "88px 24px",
        backgroundColor: C.surface,
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: 48,
            maxWidth: 820,
            marginInline: "auto",
          }}
        >
          <div
            className="landing-amber-rule"
            aria-hidden
            style={{ width: 80, margin: "0 auto 28px" }}
          />
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: C.amberDark,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Two Paths · One Platform
          </div>
          <h2
            className="landing-section-h2"
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontWeight: 400,
              color: C.text,
              margin: "0 0 18px",
            }}
          >
            Whether you&rsquo;re growing or retaining,
            <br />
            DonorLume has the playbook.
          </h2>
        </div>

        <div className="landing-grid-2">
          {PATHS.map((p, idx) => {
            const { Icon } = p;
            return (
              <div
                key={p.heading}
                style={{
                  position: "relative",
                  backgroundColor: C.bg,
                  borderRadius: 24,
                  padding: 36,
                  boxShadow: shadow.md,
                  border: `1px solid ${C.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  overflow: "hidden",
                }}
              >
                {/* Amber gradient accent bar — left edge for path 1, right edge for path 2 */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    [idx === 0 ? "left" : "right"]: 0,
                    width: 4,
                    background: brandGradient,
                  }}
                />
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 16,
                    backgroundColor: p.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={28} color={p.iconColor} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: p.iconColor,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      marginBottom: 10,
                    }}
                  >
                    {p.label}
                  </div>
                  <h3
                    style={{
                      fontFamily:
                        "var(--font-instrument-serif), Georgia, serif",
                      fontSize: 30,
                      fontWeight: 400,
                      color: C.text,
                      margin: 0,
                      letterSpacing: -0.8,
                      lineHeight: 1.15,
                    }}
                  >
                    {p.heading}
                  </h3>
                </div>
                <p
                  style={{
                    fontSize: 16,
                    lineHeight: 1.7,
                    color: C.textBody,
                    fontWeight: 500,
                    margin: 0,
                  }}
                >
                  {p.body}
                </p>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", marginTop: 44 }}>
          <Link
            href="/signup"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              borderRadius: 14,
              background: brandGradient,
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
              boxShadow:
                "0 12px 32px rgba(232,134,12,0.28), 0 4px 10px rgba(212,74,26,0.18)",
            }}
          >
            Start Your Free Trial <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}
