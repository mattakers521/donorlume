import { C } from "@/lib/design";

export function LandingProblem() {
  return (
    <section
      style={{
        padding: "80px 24px",
        backgroundColor: C.surface,
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
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
          The Problem
        </div>
        <h2
          className="landing-section-h2"
          style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontWeight: 400,
            color: C.text,
            margin: "0 0 28px",
          }}
        >
          Your donors aren&rsquo;t one group.
          <br />
          Your tools shouldn&rsquo;t treat them like one.
        </h2>
        <p
          style={{
            fontSize: 18,
            lineHeight: 1.7,
            color: C.textBody,
            fontWeight: 500,
            margin: "0 0 20px",
          }}
        >
          You have <strong style={{ color: C.text }}>gala attendees</strong>{" "}
          who&rsquo;ve never made a second gift.{" "}
          <strong style={{ color: C.text }}>Corporate sponsors</strong>{" "}
          who haven&rsquo;t renewed.{" "}
          <strong style={{ color: C.text }}>Monthly sustainers</strong>{" "}
          quietly canceling.{" "}
          <strong style={{ color: C.text }}>Major donors</strong> who
          stopped giving but are funding three other nonprofits.{" "}
          <strong style={{ color: C.text }}>First-time donors</strong> who
          showed up once and vanished.
        </p>
        <p
          style={{
            fontSize: 18,
            lineHeight: 1.7,
            color: C.textBody,
            fontWeight: 500,
            margin: "0 0 20px",
          }}
        >
          You know these groups exist. You probably have them sorted in a
          spreadsheet somewhere — color-coded, half-updated, rebuilt from
          scratch every quarter. Your CRM stores their data. It doesn&rsquo;t
          tell you what to do with it.
        </p>
        <p
          style={{
            fontSize: 18,
            lineHeight: 1.7,
            color: C.text,
            fontWeight: 600,
            margin: 0,
          }}
        >
          DonorLume does. It automatically identifies your donor cohorts,
          scores them, and tells you exactly who needs attention, what
          kind, and when.
        </p>
      </div>
    </section>
  );
}
