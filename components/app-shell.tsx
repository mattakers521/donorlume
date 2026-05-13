"use client";

import { useEffect, useState, type ReactNode } from "react";

import { C } from "@/lib/design";
import { OnboardingProgressBar } from "@/components/onboarding/progress-bar";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast/toast-provider";
import { TopBar } from "@/components/topbar";

type OnboardingBarProps = {
  completedCount: number;
  total: number;
  nextStepIndex: number;
  nextStepTitle: string;
} | null;

type Props = {
  user: { name: string | null; email: string; image: string | null };
  orgName: string;
  /** Null when the bar should be hidden (all-done or dismissed). */
  onboardingBar: OnboardingBarProps;
  children: ReactNode;
};

/**
 * Client-side shell that owns the mobile-drawer open/close state.
 *
 * On screens ≥768px the Sidebar renders inline as before. Under 768px the
 * sidebar is hidden until the user taps the hamburger in the TopBar — at
 * which point it slides in from the left as an overlay with a dimmed
 * backdrop that closes the drawer on click. Auto-closes on nav-link
 * click via the onMobileClose prop wired into Sidebar's NavLinks (we
 * deliberately don't watch pathname in an effect — React 19's
 * set-state-in-effect rule rightfully flags that pattern).
 */
export function AppShell({
  user,
  orgName,
  onboardingBar,
  children,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <ToastProvider>
    <div
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: C.bg,
        color: C.text,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Sidebar
        user={user}
        orgName={orgName}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Mobile backdrop — only rendered when the drawer is open. */}
      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
          className="app-shell-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)",
            border: "none",
            zIndex: 40,
            cursor: "pointer",
          }}
        />
      )}

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {onboardingBar && <OnboardingProgressBar {...onboardingBar} />}
        <TopBar onOpenMobileNav={() => setMobileOpen(true)} />
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "clamp(16px, 3vw, 36px)",
          }}
        >
          {children}
        </div>
      </main>
    </div>
    </ToastProvider>
  );
}
