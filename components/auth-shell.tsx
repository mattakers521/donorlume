import type { ReactNode } from "react";
import { RefreshCw, Search, Sparkles } from "lucide-react";

import { C } from "@/lib/design";
import { StarburstLogo } from "@/components/starburst-logo";

const FEATURES = [
  { Icon: Search, text: "Discover aligned foundations from IRS 990 data" },
  { Icon: RefreshCw, text: "Score lapsed donors and know who to call first" },
  { Icon: Sparkles, text: "Generate personalized outreach in seconds" },
];

type Props = {
  heading: string;
  subhead: string;
  children: ReactNode;
};

/**
 * Two-column auth shell — left form panel + right brand hero on desktop;
 * the brand hero is hidden under 900px so the form gets the full width.
 * Mirrors the AuthScreen layout in `donorluma-app.jsx:171`.
 */
export function AuthShell({ heading, subhead, children }: Props) {
  return (
    <div
      className="auth-shell-grid"
      style={{
        minHeight: "100vh",
        backgroundColor: C.bg,
      }}
    >
      {/* ── Left form panel ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "clamp(40px, 6vw, 56px) clamp(20px, 5vw, 56px)",
          backgroundColor: C.surface,
          // Clip the largest halo (700px) against the column edge.
          // `clip` over `hidden` so vertical scroll still works on
          // short viewports + tall forms (signup step 2, onboarding)
          // AND fixed-position toasts stay anchored to the viewport.
          overflowX: "clip",
          position: "relative",
        }}
      >
        <div style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>
          {/* Brand beacon — three-halo glow + pulsing starburst. Same
              treatment as the landing hero (see `.hero-halo-*` in
              globals.css), scaled to fit the form panel. The wordmark
              + "by Vibrant Causes" sub-line sit below the figure, both
              tinted faintly by the outer halo so the whole brand block
              reads as a single light source. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
              marginBottom: 64,
              textAlign: "center",
            }}
          >
            <div className="auth-starburst-stage">
              <div className="auth-halo auth-halo-3" aria-hidden />
              <div className="auth-halo auth-halo-2" aria-hidden />
              <div className="auth-halo auth-halo-1" aria-hidden />
              <div className="auth-starburst-figure">
                <StarburstLogo size={80} idKey="auth-left" />
              </div>
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: C.text,
                  letterSpacing: -0.8,
                  lineHeight: 1.1,
                }}
              >
                DonorLume
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: C.textTertiary,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                by Vibrant Causes
              </div>
            </div>
          </div>

          <h1
            style={{
              fontSize: 32,
              fontWeight: 400,
              margin: "0 0 8px",
              color: C.text,
              letterSpacing: -0.8,
              lineHeight: 1.15,
              fontFamily:
                "var(--font-instrument-serif), Georgia, serif",
            }}
          >
            {heading}
          </h1>
          <p
            style={{
              fontSize: 16,
              color: C.textSecondary,
              margin: "0 0 36px",
              lineHeight: 1.5,
              fontWeight: 400,
            }}
          >
            {subhead}
          </p>

          {children}
        </div>
      </div>

      {/* ── Right hero — hidden on mobile via .auth-hero ── */}
      <div
        className="auth-hero"
        style={{
          background:
            "linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 40%, #1C1C1E 100%)",
          alignItems: "center",
          justifyContent: "center",
          padding: 64,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Hero content block — vertically + horizontally centered by
            the panel's flex parent. The starburst is the centerpiece;
            headline + description + bullets sit below it, illuminated
            by the outer halo's residual warm tint. */}
        <div
          style={{
            maxWidth: 520,
            position: "relative",
            zIndex: 1,
            textAlign: "center",
          }}
        >
          {/* Beacon — full landing-hero treatment. The .hero-* classes
              are reused as-is (not duplicated) so the brand mark
              behaves identically on the marketing site and the auth
              shell: 300/560/900 px halos pulsing at 4 / 4.5 / 5 s,
              plus the 3.5 s drop-shadow pulse on the figure itself.
              `overflow: hidden` on the parent already clips the
              widest halo against the panel edges. */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 48,
            }}
          >
            <div className="hero-starburst-stage">
              <div className="hero-halo hero-halo-3" aria-hidden />
              <div className="hero-halo hero-halo-2" aria-hidden />
              <div className="hero-halo hero-halo-1" aria-hidden />
              <div className="hero-starburst-figure">
                <StarburstLogo size={180} idKey="auth-hero" />
              </div>
            </div>
          </div>
          <h2
            style={{
              fontSize: 42,
              fontWeight: 400,
              color: "#FFFFFF",
              lineHeight: 1.1,
              letterSpacing: -1.5,
              margin: "0 0 20px",
              fontFamily:
                "var(--font-instrument-serif), Georgia, serif",
            }}
          >
            Stop reacting.
            <br />
            Start strategizing.
          </h2>
          <p
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.7,
              margin: "0 auto 44px",
              fontWeight: 400,
              maxWidth: 460,
            }}
          >
            DonorLume gives fundraisers at nonprofits and charities the donor
            intelligence that major institutions take for granted — at a price
            built for the rest of us.
          </p>
          {/* Bullets centered as a block, internally left-aligned. The
              max-width keeps the bullet list visually anchored under the
              headline instead of stretching the full 520 px column. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              textAlign: "left",
              maxWidth: 440,
              margin: "0 auto",
            }}
          >
            {FEATURES.map(({ Icon, text }) => (
              <div
                key={text}
                style={{ display: "flex", alignItems: "center", gap: 16 }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(232,134,12,0.12)",
                    border: "1px solid rgba(232,134,12,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} color={C.amber} />
                </div>
                <span
                  style={{
                    fontSize: 16,
                    color: "rgba(255,255,255,0.8)",
                    fontWeight: 500,
                  }}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
