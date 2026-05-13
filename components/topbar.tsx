"use client";

import { usePathname } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";

import { C } from "@/lib/design";
import { pageTitleFor } from "@/lib/nav";

type Props = {
  onOpenMobileNav?: () => void;
};

/**
 * Top bar — page title + actions row.
 *
 * On screens <768px the hamburger button on the left opens the mobile
 * sidebar drawer; the wide search input collapses to a single-icon
 * button to keep the header from wrapping. Spacing tightens proportionally.
 */
export function TopBar({ onOpenMobileNav }: Props) {
  const pathname = usePathname();
  const { title, sub } = pageTitleFor(pathname);

  return (
    <header
      style={{
        minHeight: 64,
        backgroundColor: C.surface,
        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px clamp(14px, 3vw, 36px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {/* Mobile hamburger — hidden ≥768px via the topbar-hamburger utility */}
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="topbar-hamburger"
          aria-label="Open menu"
          style={{
            background: C.surfaceHover,
            border: "none",
            borderRadius: 10,
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            color: C.text,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Menu size={20} />
        </button>

        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: "clamp(17px, 2.4vw, 21px)",
              fontWeight: 800,
              margin: 0,
              letterSpacing: -0.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </h1>
          {sub && (
            <p
              className="topbar-subtitle"
              style={{
                fontSize: 13,
                color: C.textTertiary,
                margin: "2px 0 0",
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {sub}
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        {/* Wide search pill — desktop only */}
        <div
          className="topbar-search-pill"
          style={{
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            backgroundColor: "#F2F2F7",
            borderRadius: 12,
            fontSize: 14,
            color: C.textTertiary,
            cursor: "pointer",
            minWidth: 220,
          }}
        >
          <Search size={15} />
          Search prospects, donors…
        </div>

        {/* Compact search icon — mobile only */}
        <button
          type="button"
          className="topbar-search-icon"
          aria-label="Search"
          style={{
            border: "none",
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: "#F2F2F7",
            alignItems: "center",
            justifyContent: "center",
            color: C.textSecondary,
            cursor: "pointer",
          }}
        >
          <Search size={17} />
        </button>

        <div
          style={{
            position: "relative",
            cursor: "pointer",
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: "#F2F2F7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bell size={18} color={C.textSecondary} />
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: C.orange,
              border: `2px solid ${C.surface}`,
            }}
          />
        </div>
      </div>
    </header>
  );
}
