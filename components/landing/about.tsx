import { C, brandGradient, shadow } from "@/lib/design";

export function LandingAbout() {
  return (
    <section
      id="about"
      style={{
        padding: "88px 24px",
        backgroundColor: C.bg,
        color: C.text,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Full-width amber gradient seam — visually separates the dark
          FAQ section above from this light section below. */}
      <div
        className="landing-amber-rule"
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
        }}
      />

      {/* Faint amber-tinted glow in the upper-left, dialed down for the
          cream background (was 0.10 on dark, now 0.06 here so the cream
          stays the dominant surface). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          top: "-50%",
          left: "-20%",
          background:
            "radial-gradient(circle, rgba(232,134,12,0.06) 0%, transparent 60%)",
          pointerEvents: "none",
          filter: "blur(40px)",
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: 880,
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 44 }}>
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
            About
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
            Built by fundraisers, for fundraisers.
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            fontSize: 17,
            lineHeight: 1.7,
            color: C.textBody,
            fontWeight: 500,
            marginBottom: 48,
          }}
        >
          <p style={{ margin: 0 }}>
            DonorLume is built by{" "}
            <strong style={{ color: C.text }}>Vibrant Causes, LLC</strong> —
            a consulting firm that works with nonprofits and charities of
            every size, without judgment. We started DonorLume because we
            saw the same problem at every organization we worked with:
            talented fundraisers stuck in reactive mode, rebuilding donor
            segments in spreadsheets every quarter, staring at lapsed donor
            reports without knowing who to call first.
          </p>
          <p style={{ margin: 0 }}>
            They weren&rsquo;t bad at their jobs. They were drowning in
            data and starving for intelligence.
          </p>
          <p style={{ margin: 0 }}>
            We built DonorLume to flip that equation. Not another
            enterprise platform that costs more than your annual fund
            goal. Not a CRM replacement. An intelligence layer that shows
            you who your donors really are — and what to do next.
          </p>
        </div>

        <blockquote
          style={{
            position: "relative",
            backgroundColor: C.surface,
            borderRadius: 24,
            padding: "36px 36px 32px 44px",
            margin: 0,
            border: `1px solid ${C.border}`,
            boxShadow: shadow.md,
            overflow: "hidden",
          }}
        >
          {/* Amber gradient left bar — same accent that made the quote
              feel special on the dark bg; the cream surface lets it
              read even more deliberately now. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: 4,
              background: brandGradient,
            }}
          />
          <p
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontSize: 24,
              fontStyle: "italic",
              lineHeight: 1.5,
              color: C.text,
              margin: "0 0 22px",
              letterSpacing: -0.3,
            }}
          >
            &ldquo;Every fundraiser I&rsquo;ve worked with does the same
            thing: exports their donor list, opens Excel, and starts
            sorting. By cohort. By behavior. By giving level. By event.
            They&rsquo;re building their own intelligence layer by hand,
            every quarter, because no tool does it for them at a price
            they can afford. DonorLume is that tool.&rdquo;
          </p>
          <footer
            style={{
              fontSize: 14,
              color: C.textSecondary,
              fontWeight: 700,
              letterSpacing: 0.3,
            }}
          >
            — Matt Akers, Founder, Vibrant Causes
          </footer>
        </blockquote>
      </div>
    </section>
  );
}
