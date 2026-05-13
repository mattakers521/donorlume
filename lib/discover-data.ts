/**
 * Static data used by the Discover page — ported verbatim from
 * donorluma-app.jsx:400–402.
 */

/** First-letter NTEE prefix → human label. */
export const NTEE_LABELS: Record<string, string> = {
  A: "Arts & Culture",
  B: "Education",
  C: "Environment",
  D: "Animals",
  E: "Health Care",
  F: "Mental Health",
  G: "Diseases",
  H: "Medical Research",
  K: "Food & Agriculture",
  L: "Housing",
  N: "Recreation",
  O: "Youth",
  P: "Human Services",
  Q: "International",
  S: "Community",
  T: "Philanthropy",
  U: "Science",
  W: "Public Affairs",
};

export function nteeLabel(code?: string | null): string {
  if (!code) return "—";
  return NTEE_LABELS[code.charAt(0)] ?? code;
}

export const CAUSE_SUGGESTIONS = [
  "cancer research",
  "youth mentoring",
  "food bank",
  "literacy",
  "mental health",
  "animal welfare",
  "arts education",
  "veterans services",
  "community foundation",
];

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL",
  "IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE",
  "NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD",
  "TN","TX","UT","VT","VA","WA","WV","WI","WY",
];
