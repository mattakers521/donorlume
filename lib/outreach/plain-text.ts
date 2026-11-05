/**
 * Plain-text detectors for AI output. Outreach emails are sent as
 * plain text (lib/email/prepare.ts wraps the body as-is), so markdown
 * the model slips in — *italics*, **bold**, _underscores_, bullets —
 * reaches the donor as literal symbols. Assistants output (lib/assistants)
 * is checked the same way; social posts may carry hashtags.
 *
 * Pure functions: used by the Playwright suite and by one-off real-draft
 * checks. Each returns a list of human-readable findings; empty means clean.
 */

const CHECKS: { label: string; pattern: RegExp; hashtag?: true }[] = [
  { label: "asterisk", pattern: /\*/ },
  { label: "underscore", pattern: /_/ },
  { label: "backtick", pattern: /`/ },
  { label: "heading (#)", pattern: /^\s*#{1,6}\s/m },
  { label: "bullet symbol", pattern: /^\s*[-•▪◦+]\s/m },
  // #GivingTuesday-style tag. Fine in a social post, odd in an email.
  { label: "hashtag", pattern: /(^|[\s(])#[A-Za-z0-9]/m, hashtag: true },
];

export function findMarkdown(
  text: string,
  opts: { allowHashtags?: boolean } = {},
): string[] {
  return CHECKS.filter((c) => !(opts.allowHashtags && c.hashtag))
    .filter((c) => c.pattern.test(text))
    .map((c) => c.label);
}

const NUMBER_WORD =
  "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)";

// "five dollars", "twenty-five dollars", "one hundred and fifty dollars".
// A bare "dollar" ("every dollar counts") is not an amount and passes.
const SPELLED_AMOUNT = new RegExp(
  `\\b${NUMBER_WORD}(?:[\\s-]+(?:and[\\s-]+)?${NUMBER_WORD})*[\\s-]+dollars?\\b`,
  "gi",
);

/**
 * Dollar amounts written in words. Returns each match (e.g.
 * ["twenty-five dollars"]); empty means every amount uses digits.
 */
export function findSpelledOutAmounts(text: string): string[] {
  return text.match(SPELLED_AMOUNT) ?? [];
}
