"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { C, shadow } from "@/lib/design";

type Props = {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  iconBg: string;
  href?: string;
};

export function KpiCard({ label, value, sub, icon, iconBg, href }: Props) {
  const content = (
    <div
      style={{
        backgroundColor: C.surface,
        borderRadius: 20,
        padding: "24px 26px",
        boxShadow: shadow.sm,
        cursor: href ? "pointer" : "default",
        transition: "box-shadow 0.2s, transform 0.2s",
      }}
      onMouseEnter={(e) => {
        if (href) {
          e.currentTarget.style.boxShadow = shadow.md;
          e.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = shadow.sm;
        e.currentTarget.style.transform = "none";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: C.textSecondary,
              marginBottom: 10,
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 400,
              letterSpacing: -1.5,
              color: C.text,
              fontFamily:
                "var(--font-instrument-serif), Georgia, serif",
              lineHeight: 1.05,
            }}
          >
            {value}
          </div>
        </div>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            backgroundColor: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: 13,
          color: C.textTertiary,
          fontWeight: 500,
        }}
      >
        {sub}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
        {content}
      </Link>
    );
  }
  return content;
}
