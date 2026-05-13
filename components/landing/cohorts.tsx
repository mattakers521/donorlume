import {
  Activity,
  Building2,
  HeartHandshake,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { C, shadow } from "@/lib/design";

type Dimension = {
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  label: string;
  heading: string;
  cohorts: string[];
};

const DIMENSIONS: Dimension[] = [
  {
    Icon: TrendingUp,
    iconColor: C.amber,
    iconBg: C.amberLight,
    label: "Dimension 01",
    heading: "By Giving Behavior",
    cohorts: [
      "Major donors — your highest-capacity relationships",
      "Mid-level donors — often your biggest growth opportunity",
      "Recurring sustainers — predictable revenue, high lifetime value",
      "First-time donors — the most critical conversion point",
      "Lapsed donors (LYBUNT / SYBUNT)",
      "Legacy & planned giving prospects",
      "One-time donors — showed up once, never returned",
      "Upgraders & downgraders — who's deepening, who's pulling away",
    ],
  },
  {
    Icon: HeartHandshake,
    iconColor: C.orange,
    iconBg: C.orangeLight,
    label: "Dimension 02",
    heading: "By Engagement & Segment",
    cohorts: [
      "Gala & event attendees",
      "Volunteers & service participants",
      "Corporate sponsors & matching gift donors",
      "Board members & their networks",
      "Peer-to-peer fundraisers",
      "Email engagers vs. disengagers",
      "Custom segments you define",
    ],
  },
  {
    Icon: Building2,
    iconColor: C.amberDark,
    iconBg: C.goldLight,
    label: "Dimension 03",
    heading: "By Entity Type",
    cohorts: [
      "Individual donors",
      "Corporate donors & sponsors",
      "Private foundations & grantmakers",
      "Donor-advised fund holders",
      "Giving circles & collective giving groups",
    ],
  },
  {
    Icon: Activity,
    iconColor: C.purple,
    iconBg: C.purpleLight,
    label: "Dimension 04",
    heading: "By Trajectory",
    cohorts: [
      "Rising stars — small donors showing major donor signals",
      "Churn risk — engagement or frequency dropping",
      "Reactivation ready — lapsed but still giving elsewhere",
      "Upgrade candidates — mid-level with major gift capacity",
      "Stewardship priority — gave more than expected, overdue for thanks",
    ],
  },
];

export function LandingCohorts() {
  return (
    <section
      id="cohort-intelligence"
      style={{
        padding: "88px 24px",
        backgroundColor: C.bg,
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
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
            Cohort Intelligence
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
            Every donor tells a story.
            <br />
            DonorLume reads between the lines.
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: C.textBody,
              fontWeight: 500,
              margin: 0,
            }}
          >
            The moment you upload your data, DonorLume maps your donors
            across four dimensions. You see your organization&rsquo;s
            fundraising reality clearly for the first time.
          </p>
        </div>

        <div className="landing-grid-4">
          {DIMENSIONS.map((d) => {
            const { Icon } = d;
            return (
              <div
                key={d.heading}
                style={{
                  backgroundColor: C.surface,
                  borderRadius: 20,
                  padding: 26,
                  boxShadow: shadow.md,
                  border: `1px solid ${C.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    backgroundColor: d.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={22} color={d.iconColor} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: d.iconColor,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    {d.label}
                  </div>
                  <h3
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: C.text,
                      margin: 0,
                      letterSpacing: -0.3,
                      lineHeight: 1.2,
                    }}
                  >
                    {d.heading}
                  </h3>
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                  }}
                >
                  {d.cohorts.map((c) => (
                    <li
                      key={c}
                      style={{
                        position: "relative",
                        paddingLeft: 16,
                        fontSize: 13.5,
                        lineHeight: 1.55,
                        color: C.textBody,
                        fontWeight: 500,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 8,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: d.iconColor,
                        }}
                      />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p
          style={{
            textAlign: "center",
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: 24,
            fontStyle: "italic",
            lineHeight: 1.45,
            color: C.text,
            maxWidth: 800,
            margin: "48px auto 0",
            letterSpacing: -0.3,
          }}
        >
          Most tools show you a list of names. DonorLume shows you the
          story behind every donor — and the next chapter you should write.
        </p>
      </div>
    </section>
  );
}
