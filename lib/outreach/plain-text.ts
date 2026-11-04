/**
 * Markdown detector for outreach drafts. Outreach emails are sent as
 * plain text (lib/email/prepare.ts wraps the body as-is), so markdown
 * the model slips in — *italics*, **bold**, _underscores_, bullets —
 * reaches the donor as literal symbols.
 *
 * Pure function: used by the Playwright suite and by one-off real-draft
 * checks. Returns a list of human-readable findings; empty means clean.
 */

const CHECKS: { label: string; pattern: RegExp }[] = [
  { label: "asterisk", pattern: /\*/ },
  { label: "underscore", pattern: /_/ },
  { label: "backtick", pattern: /`/ },
  { label: "heading (#)", pattern: /^\s*#{1,6}\s/m },
  { label: "bullet symbol", pattern: /^\s*[-•▪◦+]\s/m },
];

export function findMarkdown(text: string): string[] {
  return CHECKS.filter((c) => c.pattern.test(text)).map((c) => c.label);
}
