import {
  Building2,
  CreditCard,
  HelpCircle,
  Heart,
  LayoutDashboard,
  Layers,
  Mail,
  PieChart,
  RefreshCw,
  Search,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  path: string;
  Icon: LucideIcon;
};

export type NavGroup = {
  id: string;
  label?: string;
  items: NavItem[];
};

/** Primary nav (top of sidebar) — matches the order in donorluma-app.jsx:703. */
export const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", Icon: LayoutDashboard },
  { id: "discover", label: "Prospect Discovery", path: "/discover", Icon: Search },
  { id: "donors", label: "Donor Intelligence", path: "/donors", Icon: Heart },
  { id: "lapsed", label: "Lapsed Reactivation", path: "/lapsed", Icon: RefreshCw },
  { id: "cohorts", label: "Cohorts", path: "/cohorts", Icon: Layers },
  { id: "outreach", label: "AI Outreach", path: "/outreach", Icon: Mail },
  { id: "reports", label: "Reports", path: "/reports", Icon: PieChart },
];

/**
 * Secondary nav (bottom of sidebar). Rendered as a single labeled
 * "ACCOUNT" group plus a small "Help & Support" link below the divider.
 * The Sidebar component reads NAV_SECONDARY_GROUPS — NAV_SECONDARY is
 * kept as a flat alias only for legacy callers (none today).
 */
export const NAV_SECONDARY_GROUPS: NavGroup[] = [
  {
    id: "account",
    label: "Account",
    items: [
      {
        id: "organization",
        label: "Organization",
        path: "/settings/organization",
        Icon: Building2,
      },
      {
        id: "team",
        label: "Team Members",
        path: "/settings/team",
        Icon: Users,
      },
      {
        id: "profile",
        label: "My Profile",
        path: "/settings/profile",
        Icon: User,
      },
      {
        id: "billing",
        label: "Billing",
        path: "/settings/billing",
        Icon: CreditCard,
      },
      {
        id: "preferences",
        label: "Preferences",
        path: "/settings",
        Icon: Settings,
      },
    ],
  },
  {
    id: "support",
    items: [
      {
        id: "help",
        label: "Help & Support",
        path: "/help",
        Icon: HelpCircle,
      },
    ],
  },
];

// Legacy flat alias — kept for any consumers that still iterate a flat list.
export const NAV_SECONDARY: NavItem[] = NAV_SECONDARY_GROUPS.flatMap(
  (g) => g.items,
);

/** Page title + subhead by route — used by the top bar header. */
export const PAGE_TITLES: Record<string, { title: string; sub?: string }> = {
  "/dashboard": {
    title: "Dashboard",
    sub: "Your fundraising intelligence at a glance.",
  },
  "/discover": {
    title: "Prospect Discovery",
    sub: "Search IRS 990 filings to find aligned foundations.",
  },
  "/donors": { title: "Donor Intelligence" },
  "/lapsed": {
    title: "Lapsed Donor Scoring",
    sub: "Upload a donor list to identify reactivation candidates.",
  },
  "/cohorts": {
    title: "Cohorts",
    sub: "Every donor, classified into overlapping cohorts you can filter and act on.",
  },
  "/outreach": {
    title: "AI Outreach Studio",
    sub: "Generate personalized donor emails with AI.",
  },
  "/outreach/new": {
    title: "New Campaign",
    sub: "Generate personalized donor emails with AI.",
  },
  "/outreach/campaigns": {
    title: "Campaign Report",
    sub: "Delivery, opens, clicks, and cohort performance.",
  },
  "/reports": {
    title: "Reports",
    sub: "Board-ready snapshot of pipeline, outreach, and cohorts.",
  },
  "/settings/billing": {
    title: "Billing",
    sub: "Your subscription, usage, and plan options.",
  },
  "/settings/organization": {
    title: "Organization",
    sub: "Profile, mission, and contact details that feed AI outreach + prospect matching.",
  },
  "/settings/team": {
    title: "Team Members",
    sub: "Invite teammates and manage access.",
  },
  "/settings/profile": {
    title: "My Profile",
    sub: "Your name, email, password, and notification preferences.",
  },
  "/settings": {
    title: "Preferences",
    sub: "Default lapsed threshold, outreach tone, and email signature.",
  },
  "/help": {
    title: "Help & Support",
    sub: "Search the FAQ or ask the AI assistant.",
  },
};

export function pageTitleFor(pathname: string): { title: string; sub?: string } {
  // Iterate longest-prefix-first so /settings/billing wins over /settings.
  // Object insertion order isn't enough since we'd otherwise need to put
  // every override before its prefix; explicit length-sort is foolproof.
  const keys = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length);
  const match = keys.find((p) => pathname === p || pathname.startsWith(`${p}/`));
  return match ? PAGE_TITLES[match] : { title: "DonorLume" };
}
