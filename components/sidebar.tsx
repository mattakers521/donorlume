"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, X } from "lucide-react";

import { C, brandGradient } from "@/lib/design";
import { NAV, NAV_SECONDARY_GROUPS, type NavItem } from "@/lib/nav";
import { StarburstLogo } from "@/components/starburst-logo";

type Props = {
  user: { name: string | null; email: string; image: string | null };
  orgName: string;
  /** Controlled by the parent AppShell; ignored on desktop. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({
  user,
  orgName,
  mobileOpen = false,
  onMobileClose,
}: Props) {
  // Desktop collapse state — independent of the mobile drawer flow.
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  // Track viewport so we can flip from "inline rail" to "fixed drawer".
  // Matching <768px to match the rest of the responsive utilities.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const initials = (user.name || user.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // On mobile: full-width up to 320px, fixed-positioned, translated off
  // screen when closed. On desktop: inline rail with collapse toggle.
  const expandedWidth = isMobile ? Math.min(320, 320) : 280;
  const width = isMobile ? expandedWidth : collapsed ? 72 : 280;
  const isExpandedView = isMobile ? true : !collapsed;

  const baseStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        width: expandedWidth,
        backgroundColor: C.sidebarBg,
        display: "flex",
        flexDirection: "column",
        transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
        zIndex: 50,
        boxShadow: mobileOpen
          ? "0 20px 60px rgba(0,0,0,0.45)"
          : "none",
      }
    : {
        width,
        minWidth: width,
        backgroundColor: C.sidebarBg,
        display: "flex",
        flexDirection: "column",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      };

  return (
    <aside style={baseStyle} aria-hidden={isMobile && !mobileOpen}>
      {/* Brand header — click to toggle collapse on desktop / close on mobile */}
      <div
        style={{
          padding: isExpandedView ? "20px 20px" : "20px 18px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          minHeight: 80,
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (isMobile) return; // mobile: no collapse, only close via X
            setCollapsed((c) => !c);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "transparent",
            border: "none",
            cursor: isMobile ? "default" : "pointer",
            padding: 0,
            color: "inherit",
            fontFamily: "inherit",
            textAlign: "left",
            flex: 1,
            minWidth: 0,
          }}
          aria-label={
            isMobile
              ? "DonorLume"
              : collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
          }
        >
          <StarburstLogo
            size={isExpandedView ? 48 : 38}
            idKey="sidebar"
          />
          {isExpandedView && (
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: -0.6,
                  lineHeight: 1.1,
                }}
              >
                DonorLume
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.45)",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontWeight: 700,
                  marginTop: 3,
                }}
              >
                by Vibrant Causes
              </div>
            </div>
          )}
        </button>
        {isMobile && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: 10,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav body */}
      <nav
        style={{
          flex: 1,
          padding: "18px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 3,
          overflowY: "auto",
        }}
      >
        {NAV.map((item) => (
          <NavLink
            key={item.id}
            item={item}
            collapsed={!isExpandedView}
            pathname={pathname}
            onNavigate={isMobile ? onMobileClose : undefined}
          />
        ))}

        <div style={{ flex: 1 }} />

        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: 14,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {NAV_SECONDARY_GROUPS.map((group) => (
            <div key={group.id}>
              {isExpandedView && group.label && (
                <div
                  style={{
                    padding: "4px 16px 6px",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 1.6,
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  {group.label}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {group.items.map((item) => (
                  <NavLink
                    key={item.id}
                    item={item}
                    collapsed={!isExpandedView}
                    pathname={pathname}
                    onNavigate={isMobile ? onMobileClose : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* User card */}
      {isExpandedView && (
        <div
          style={{
            padding: "16px 18px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: brandGradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#fff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.name || user.email}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.35)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {orgName}
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Sign out"
            title="Sign out"
            style={{
              background: "none",
              border: "none",
              padding: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              color: "rgba(255,255,255,0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.3)";
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </aside>
  );
}

function NavLink({
  item,
  collapsed,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  // Active-state rule: prefix-match is the default (so /outreach/new
  // highlights "AI Outreach"), but if this item's path is itself a prefix
  // of another nav item's path, require an exact match instead — that
  // way /settings/team doesn't also highlight "Preferences" (/settings).
  const allPaths = [
    ...NAV.map((n) => n.path),
    ...NAV_SECONDARY_GROUPS.flatMap((g) => g.items.map((i) => i.path)),
  ];
  const isPrefixOfAnother = allPaths.some(
    (p) => p !== item.path && p.startsWith(`${item.path}/`),
  );
  const active = isPrefixOfAnother
    ? pathname === item.path
    : pathname === item.path || pathname.startsWith(`${item.path}/`);
  const { Icon } = item;

  return (
    <Link
      href={item.path}
      onClick={onNavigate}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: collapsed ? "11px 14px" : "11px 16px",
        borderRadius: 12,
        textDecoration: "none",
        transition: "all 0.15s",
        backgroundColor: active ? C.sidebarActive : "transparent",
        color: active ? C.amber : "rgba(255,255,255,0.5)",
        fontSize: 14,
        fontWeight: active ? 700 : 500,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = C.sidebarHover;
      }}
      onMouseLeave={(e) => {
        if (!active)
          e.currentTarget.style.backgroundColor = active
            ? C.sidebarActive
            : "transparent";
      }}
    >
      <Icon size={20} style={{ flexShrink: 0 }} />
      {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
    </Link>
  );
}
