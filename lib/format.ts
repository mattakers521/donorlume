/**
 * Currency abbreviation — ports `fmt` from donorluma-app.jsx:56.
 * `null` / `undefined` / `NaN` → em-dash. Negative numbers preserved.
 */
export function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Number(n).toLocaleString()}`;
}
