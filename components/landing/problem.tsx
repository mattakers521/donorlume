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
            margin: "0 0 24px",
          }}
        >
          Your CRM stores their data. It doesn&rsquo;t tell you what to do
          with it.
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
          DonorLume does.
        </p>
      </div>
    </section>
  );
}
