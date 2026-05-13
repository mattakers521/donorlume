/**
 * DonorLume "Apple Warm" design tokens — TypeScript constants.
 *
 * Mirrors the `C` and `shadow` objects from `donorluma-app.jsx:16` so any
 * component that needs inline styles (gradients, tinted shadows) can pull
 * the same values that the CSS @theme block in `app/globals.css` exposes
 * as utilities.
 */

export const C = {
  // Surfaces — light
  bg: "#FAFAF8",
  surface: "#FFFFFF",
  surfaceHover: "#F5F4F1",
  surfaceTint: "#F1EFEA",
  // Surfaces — dark (used on alternating landing sections + sidebar)
  dark: "#1C1C1E",
  darkWarm: "#1F1B19",
  darkDeep: "#141416",
  darkPanel: "#2A2A2C",
  darkPanelWarm: "#2A2522",
  // Borders — used sparingly
  border: "rgba(0,0,0,0.06)",
  borderSubtle: "rgba(0,0,0,0.03)",
  borderDark: "rgba(255,255,255,0.08)",
  borderDarkStrong: "rgba(255,255,255,0.14)",
  // Text — light surfaces (textBody is the new high-contrast default for body copy)
  text: "#1D1D1F",
  textBody: "#3A3A3C",
  textSecondary: "#6E6E73",
  textTertiary: "#AEAEB2",
  // Text — dark surfaces
  textOnDark: "#FFFFFF",
  textOnDarkBody: "rgba(255,255,255,0.92)",
  textOnDarkSecondary: "rgba(255,255,255,0.7)",
  textOnDarkTertiary: "rgba(255,255,255,0.45)",
  // Brand
  amber: "#E8860C",
  amberLight: "#FFF4E6",
  amberDark: "#C26A00",
  amberOnDark: "#F5B731",
  orange: "#D44A1A",
  orangeLight: "#FFF0EB",
  gold: "#F5B731",
  goldLight: "#FFFAED",
  // Semantic
  green: "#34C759",
  greenLight: "#E8FAE8",
  purple: "#AF52DE",
  purpleLight: "#F5EEFA",
  red: "#FF3B30",
  redLight: "#FFECEB",
  blue: "#007AFF",
  // Sidebar (kept for legacy; same as `dark`)
  sidebarBg: "#1C1C1E",
  sidebarHover: "rgba(255,255,255,0.08)",
  sidebarActive: "rgba(232,134,12,0.15)",
} as const;

export const shadow = {
  sm: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
  md: "0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)",
  lg: "0 12px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
  glow: "0 0 30px rgba(232,134,12,0.15)",
} as const;

export const brandGradient = `linear-gradient(135deg, ${C.amber}, ${C.orange})`;

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 18px",
  borderRadius: 14,
  border: `1.5px solid ${C.border}`,
  fontSize: 15,
  color: C.text,
  outline: "none",
  backgroundColor: C.surface,
  boxSizing: "border-box",
  transition: "border-color 0.2s, box-shadow 0.2s",
  fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
};
