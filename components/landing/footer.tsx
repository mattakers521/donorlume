import Link from "next/link";

import { C } from "@/lib/design";
import { StarburstLogo } from "@/components/starburst-logo";

type LinkGroup = {
  heading: string;
  links: { label: string; href: string; external?: boolean }[];
};

const GROUPS: LinkGroup[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#about" },
      {
        label: "Contact",
        href: "mailto:hello@donorlume.com",
        external: true,
      },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
  {
    heading: "Connect",
    links: [
      {
        label: "hello@donorlume.com",
        href: "mailto:hello@donorlume.com",
        external: true,
      },
      { label: "LinkedIn", href: "#", external: true },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer
      style={{
        padding: "56px 24px 36px",
        backgroundColor: C.darkDeep,
        color: "rgba(255,255,255,0.7)",
        position: "relative",
      }}
    >
      <div
        className="landing-amber-rule"
        aria-hidden
        style={{ position: "absolute", top: 0, left: 0, right: 0 }}
      />
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr repeat(4, 1fr)",
            gap: 40,
            marginBottom: 48,
          }}
          className="footer-grid"
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <StarburstLogo size={36} idKey="landing-footer" />
              <div style={{ lineHeight: 1.1 }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#fff",
                    letterSpacing: -0.5,
                  }}
                >
                  DonorLume
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    fontWeight: 700,
                    marginTop: 2,
                  }}
                >
                  by{" "}
                  <a
                    href="https://www.vibrantcauses.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    Vibrant Causes
                  </a>
                </div>
              </div>
            </div>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: "rgba(255,255,255,0.55)",
                margin: 0,
                maxWidth: 280,
              }}
            >
              Cohort intelligence for nonprofits and charities. Built by
              Vibrant Causes, LLC.
            </p>
          </div>

          {GROUPS.map((g) => (
            <div key={g.heading}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 18,
                }}
              >
                {g.heading}
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {g.links.map((l) =>
                  l.external || l.href.startsWith("#") || l.href.startsWith("mailto:") ? (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="footer-link"
                        style={{ fontSize: 14, textDecoration: "none" }}
                      >
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="footer-link"
                        style={{ fontSize: 14, textDecoration: "none" }}
                      >
                        {l.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            paddingTop: 28,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 13,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <span>© 2026 Vibrant Causes, LLC. All rights reserved.</span>
          <span>Know your donors. Not just their names.</span>
        </div>
      </div>
    </footer>
  );
}
