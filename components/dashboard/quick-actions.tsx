"use client";

import Link from "next/link";
import {
  ChevronRight,
  Search,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";

import { C, shadow } from "@/lib/design";

const ACTIONS: { label: string; Icon: LucideIcon; href: string }[] = [
  { label: "Search for prospects", Icon: Search, href: "/discover" },
  { label: "Upload donor list", Icon: Upload, href: "/lapsed" },
  { label: "Generate outreach", Icon: Sparkles, href: "/outreach/new" },
];

export function QuickActions() {
  return (
    <div
      style={{
        backgroundColor: C.surface,
        borderRadius: 20,
        boxShadow: shadow.sm,
        padding: 24,
      }}
    >
      <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 18px" }}>
        Quick Actions
      </h3>
      {ACTIONS.map((a, i) => {
        const { Icon } = a;
        return (
          <Link
            key={a.label}
            href={a.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              borderRadius: 14,
              cursor: "pointer",
              marginBottom: i < ACTIONS.length - 1 ? 6 : 0,
              transition: "background 0.15s",
              textDecoration: "none",
              color: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = C.surfaceHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: C.amberLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={18} color={C.amber} />
            </div>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                flex: 1,
                color: C.text,
              }}
            >
              {a.label}
            </span>
            <ChevronRight size={16} color={C.textTertiary} />
          </Link>
        );
      })}
    </div>
  );
}
