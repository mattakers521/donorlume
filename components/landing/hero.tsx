import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { C, brandGradient } from "@/lib/design";
import { StarburstLogo } from "@/components/starburst-logo";

export function LandingHero() {
  return (
    <section
      className="landing-dot-pattern-amber"
      style={{
        position: "relative",
        padding: "120px 24px 110px",
        textAlign: "center",
        overflow: "hidden",
        backgroundColor: C.darkDeep,
        color: C.textOnDark,
        // The dot grid lives on this element via the class; the radial
        // amber glow below sits on top of it for depth.
      }}
    >
      {/* Top ambient glow — dialed back to a low-key wash now that the
          starburst halo below is the real light source. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          borderRadius: "50%",
          top: "-55%",
          left: "50%",
          transform: "translateX(-50%)",
          background:
            "radial-gradient(circle, rgba(232,134,12,0.14) 0%, rgba(212,74,26,0.06) 35%, transparent 65%)",
          pointerEvents: "none",
          filter: "blur(20px)",
        }}
      />
      {/* Bottom soft fade so the dot pattern doesn't compete with content */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, transparent 0%, transparent 55%, rgba(20,20,22,0.85) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
        {/* Starburst beacon — three layered halos pulse behind, the
            logo itself has a luminous drop-shadow filter. DonorLume =
            donor light; the icon needs to BE a light source, not just
            sit on top of the dark backdrop. */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 36,
          }}
        >
          <div className="hero-starburst-stage">
            <div className="hero-halo hero-halo-3" aria-hidden />
            <div className="hero-halo hero-halo-2" aria-hidden />
            <div className="hero-halo hero-halo-1" aria-hidden />
            <div className="hero-starburst-figure">
              <StarburstLogo size={180} idKey="landing-hero" />
            </div>
          </div>
        </div>

        {/* Eyebrow tag */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 14px",
            borderRadius: 100,
            background: "rgba(245,183,49,0.10)",
            border: "1px solid rgba(245,183,49,0.28)",
            color: C.amberOnDark,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          <Sparkles size={13} /> Cohort Intelligence for Nonprofits
        </div>

        <h1
          className="landing-hero-h1"
          style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontWeight: 400,
            color: "#fff",
            margin: "0 0 24px",
          }}
        >
          Know your donors.
          <br />
          <span
            style={{
              background: `linear-gradient(135deg, ${C.amberOnDark}, ${C.orange})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Not just their names.
          </span>
        </h1>

        <p
          style={{
            fontSize: 19,
            lineHeight: 1.6,
            color: C.textOnDarkBody,
            maxWidth: 780,
            margin: "0 auto 40px",
            fontWeight: 500,
          }}
        >
          DonorLume is the cohort intelligence platform that helps nonprofits
          understand who their donors are, where they&rsquo;re moving, and
          what to do next — for every segment, automatically. Stop treating
          all donors the same. Start fundraising like you know them.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/signup"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "16px 30px",
              borderRadius: 14,
              background: brandGradient,
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              textDecoration: "none",
              boxShadow:
                "0 14px 40px rgba(232,134,12,0.35), 0 4px 12px rgba(212,74,26,0.2)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
          >
            Get Started Free <ArrowRight size={18} />
          </Link>
          <a
            href="#how-it-works"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "16px 28px",
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.14)",
            }}
          >
            See How It Works
          </a>
        </div>

        {/* Trust strip — small, restrained, sits below the CTAs */}
        <div
          style={{
            marginTop: 56,
            display: "flex",
            justifyContent: "center",
            gap: 32,
            flexWrap: "wrap",
            color: C.textOnDarkTertiary,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.4,
          }}
        >
          <span>
            Works with Bloomerang · Salesforce · LGL · Kindful · Neon ·
            DonorPerfect · OneCause · GiveButter · BetterUnite · Givesmart ·
            Greater Giving
          </span>
        </div>
      </div>
    </section>
  );
}
