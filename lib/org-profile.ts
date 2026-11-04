/**
 * Organization Profile ("Your Why") — Phase 1 Feature 1.
 *
 * Pure helpers shared by the settings page, the save action, the
 * onboarding checklist, and the AI prompt wiring. No `server-only`
 * import, so client components and scripts can use them too.
 *
 * Field mapping vs PHASE-1-SPEC.md (existing columns reused, not renamed):
 *   missionStatement → Organization.mission
 *   websiteUrl       → Organization.website
 *   logoUrl          → Organization.logo
 *   communityServed / focusAreas / donationPageUrl → new columns
 */

/** Only OWNER and ADMIN may edit the Organization Profile. */
export const PROFILE_EDITOR_ROLES = ["OWNER", "ADMIN"] as const;

export function canEditOrgProfile(role: string | null | undefined): boolean {
  return (PROFILE_EDITOR_ROLES as readonly string[]).includes(role ?? "");
}

export const PROFILE_READ_ONLY_ERROR =
  "Only owners and admins can edit the organization profile.";

export type OrgProfile = {
  mission: string | null;
  communityServed: string | null;
  focusAreas: string[];
  website: string | null;
  donationPageUrl: string | null;
  logo: string | null;
};

export type ProfileFieldKey = keyof OrgProfile;

/** Display order + labels for the strength indicator's "still missing" list. */
export const PROFILE_FIELDS: { key: ProfileFieldKey; label: string }[] = [
  { key: "mission", label: "Mission" },
  { key: "communityServed", label: "Community served" },
  { key: "focusAreas", label: "Focus areas" },
  { key: "website", label: "Website" },
  { key: "donationPageUrl", label: "Donation page" },
  { key: "logo", label: "Logo" },
];

/**
 * The three fields every AI feature reads. A profile is "grounded" —
 * and the onboarding checklist step is done — once all three are set.
 * Links and logo raise profile strength but don't block AI output.
 */
export const GROUNDING_FIELDS: ProfileFieldKey[] = [
  "mission",
  "communityServed",
  "focusAreas",
];

export const MAX_FOCUS_AREAS = 8;
export const MAX_FOCUS_AREA_LENGTH = 40;

function isFilled(profile: OrgProfile, key: ProfileFieldKey): boolean {
  const v = profile[key];
  if (Array.isArray(v)) return v.length > 0;
  return typeof v === "string" && v.trim().length > 0;
}

export type ProfileStrength = {
  /** 0–100, rounded. */
  percent: number;
  filled: number;
  total: number;
  missing: { key: ProfileFieldKey; label: string }[];
};

export function profileStrength(profile: OrgProfile): ProfileStrength {
  const missing = PROFILE_FIELDS.filter((f) => !isFilled(profile, f.key));
  const total = PROFILE_FIELDS.length;
  const filled = total - missing.length;
  return {
    percent: Math.round((filled / total) * 100),
    filled,
    total,
    missing,
  };
}

export function isProfileGrounded(profile: OrgProfile): boolean {
  return GROUNDING_FIELDS.every((k) => isFilled(profile, k));
}

/**
 * Split a comma/newline-separated string into clean, de-duplicated
 * tags (case-insensitive), capped in count and length.
 */
export function normalizeFocusAreas(raw: string | string[]): string[] {
  const parts = (Array.isArray(raw) ? raw : raw.split(/[,\n]/))
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((s) => s.slice(0, MAX_FOCUS_AREA_LENGTH));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= MAX_FOCUS_AREAS) break;
  }
  return out;
}

/**
 * Accepts what a person naturally types ("vetlife.org",
 * "www.vetlife.org/give") and returns a canonical https URL, or null
 * for empty input. Returns `{ error }` when the value can't be a
 * public web address. Only http(s) is allowed — these URLs are
 * rendered as links (and, in Feature 3, as the public "Give now"
 * button target), so javascript:/data: schemes must never pass.
 */
export function normalizeUrl(
  raw: string | null | undefined,
): { value: string | null } | { error: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { value: null };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { error: "isn't a valid web address" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: "must start with http:// or https://" };
  }
  if (!url.hostname.includes(".")) {
    return { error: "needs a full domain, like yournonprofit.org" };
  }
  return { value: url.toString() };
}

/**
 * The profile slice the AI prompt reads. Falls back to the legacy
 * single `causeArea` for any org that somehow has no focus areas yet
 * (the migration backfills, so this is belt-and-braces).
 */
export type PromptProfile = {
  communityServed: string | null;
  focusAreas: string[];
  /** Already normalized to http(s) on save; null → the prompt forbids links. */
  donationPageUrl: string | null;
};

export const EMPTY_PROMPT_PROFILE: PromptProfile = {
  communityServed: null,
  focusAreas: [],
  donationPageUrl: null,
};

export function promptProfileFrom(org: {
  communityServed: string | null;
  focusAreas: string[];
  donationPageUrl: string | null;
  causeArea?: string | null;
}): PromptProfile {
  const focusAreas =
    org.focusAreas.length > 0
      ? org.focusAreas
      : org.causeArea?.trim()
        ? [org.causeArea.trim()]
        : [];
  // Defensive re-check: only ever hand the model an http(s) URL.
  const donation = normalizeUrl(org.donationPageUrl);
  return {
    communityServed: org.communityServed?.trim() || null,
    focusAreas,
    donationPageUrl: "value" in donation ? donation.value : null,
  };
}
