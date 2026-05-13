import Link from "next/link";
import { ArrowRight, Ticket, Users, type LucideIcon } from "lucide-react";

import { C, brandGradient, shadow } from "@/lib/design";

type Path = {
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
};

const PATHS: Path[] = [
  {
    Icon: Ticket,
    iconColor: C.amber,
    iconBg: C.amberLight,
    title: "I have a fundraising event coming up (or just had one).",
    subtitle:
      "Upload your event attendee data and know who to follow up with first — within minutes of your event ending.",
    cta: "Get Started — Event Follow-Up",
    href: "/signup?path=event",
  },
  {
    Icon: Users,
    iconColor: C.orange,
    iconBg: C.orangeLight,
    title: "I want to understand and activate my donor base.",
    subtitle:
      "Upload your full donor history to uncover cohorts, score lapsed donors, find new prospects, and build a real pipeline.",
    cta: "Get Started — Donor Intelligence",
    href: "/signup?path=donors",
  },
];

export function LandingChoosePath() {
  return (
    <section
      id="choose-path"
      style={{
        padding: "88px 24px",
        backgroundColor: C.bg,
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
            Choose Your Path
          </div>
          <h2
            className="landing-section-h2"
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontWeight: 400,
              color: C.text,
              margin: 0,
            }}
          >
            However you fundraise, DonorLume has you covered.
          </h2>
        </div>

        <div className="landing-grid-2">
          {PATHS.map((p) => {
            const { Icon } = p;
            return (
              <Link
                key={p.title}
                href={p.href}
                className="choose-path-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  padding: 36,
                  backgroundColor: C.surface,
                  borderRadius: 24,
                  border: `1px solid ${C.border}`,
                  boxShadow: shadow.md,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
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
                  <Icon size={28} color={p.iconColor} strokeWidth={2.2} />
                </div>
                <h3
                  style={{
                    fontFamily:
                      "var(--font-instrument-serif), Georgia, serif",
                    fontSize: 26,
                    fontWeight: 400,
                    color: C.text,
                    margin: 0,
                    letterSpacing: -0.6,
                    lineHeight: 1.2,
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    fontSize: 15.5,
                    lineHeight: 1.65,
                    color: C.textBody,
                    fontWeight: 500,
                    margin: 0,
                    flex: 1,
                  }}
                >
                  {p.subtitle}
                </p>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 6,
                    padding: "13px 22px",
                    borderRadius: 14,
                    background: brandGradient,
                    color: "#fff",
                    fontSize: 14.5,
                    fontWeight: 700,
                    boxShadow:
                      "0 10px 28px rgba(232,134,12,0.30), 0 3px 8px rgba(212,74,26,0.18)",
                  }}
                >
                  {p.cta} <ArrowRight size={16} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
