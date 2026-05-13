"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { C, brandGradient } from "@/lib/design";
import { StarburstLogo } from "@/components/starburst-logo";

type Props = {
  isAuthed: boolean;
};

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#cohort-intelligence", label: "Cohorts" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

export function LandingHeader({ isAuthed }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Header floats over the dark hero — text is white at the top, then the
  // bar fills with a frosted dark panel on scroll so it stays legible over
  // every section below.
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: scrolled ? "saturate(180%) blur(14px)" : "none",
        WebkitBackdropFilter: scrolled
          ? "saturate(180%) blur(14px)"
          : "none",
        backgroundColor: scrolled
          ? "rgba(20, 20, 22, 0.78)"
          : "transparent",
        borderBottom: scrolled
          ? `1px solid ${C.borderDark}`
          : "1px solid transparent",
        transition:
          "background-color 0.2s, border-color 0.2s, backdrop-filter 0.2s",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "14px clamp(16px, 3vw, 24px)",
          display: "flex",
          alignItems: "center",
          gap: "clamp(12px, 2vw, 32px)",
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <StarburstLogo size={40} idKey="landing-header" />
          <div style={{ lineHeight: 1.1 }}>
            <div
              style={{
                fontSize: 20,
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
                color: "rgba(255,255,255,0.55)",
                letterSpacing: 1,
                textTransform: "uppercase",
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              by Vibrant Causes
            </div>
          </div>
        </Link>

        {/* Nav */}
        <nav
          className="landing-nav-links"
          style={{ alignItems: "center", gap: 28, flex: 1 }}
        >
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255,255,255,0.75)",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.75)")
              }
            >
              {n.label}
            </a>
          ))}
        </nav>

        {/* CTAs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginLeft: "auto",
          }}
        >
          {isAuthed ? (
            <Link
              href="/dashboard"
              style={{
                padding: "10px 22px",
                borderRadius: 12,
                background: brandGradient,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 8px 24px rgba(232,134,12,0.25)",
              }}
            >
              Open App →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="landing-header-signin"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.75)",
                  textDecoration: "none",
                  padding: "10px 6px",
                }}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                style={{
                  padding: "10px 22px",
                  borderRadius: 12,
                  background: brandGradient,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 8px 24px rgba(232,134,12,0.25)",
                }}
              >
                Get Started Free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
