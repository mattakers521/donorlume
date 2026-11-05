/**
 * Campaign Creator output format + parser.
 *
 * The model is asked for this exact plain-text layout (no markdown —
 * section labels are uppercase words instead of headings):
 *
 *   CAMPAIGN BRIEF
 *   Audience: …
 *   Message arc: …
 *   Timeline: …            (may continue over several lines)
 *
 *   EMAIL 1
 *   Send: …
 *   Subject: …
 *
 *   <body>
 *
 *   EMAIL 2 … EMAIL 3 …
 *
 * `parseCampaign` never throws. Anything that doesn't match — missing
 * section, wrong email count, empty body — returns `{ ok: false, raw }`
 * so the UI can show the text as-is instead of an error or a blank.
 */

export const CAMPAIGN_FORMAT_INSTRUCTIONS = [
  "Output format — follow it exactly, in plain text:",
  "CAMPAIGN BRIEF",
  "Audience: who this campaign is for, in one or two sentences.",
  "Message arc: how the story builds across the three emails, in two to four sentences.",
  "Timeline: one line per email, each starting with its send date (for example \"Tuesday, December 1: Giving Tuesday morning ask\").",
  "",
  "Then the three emails, each starting with its own label line:",
  "EMAIL 1",
  "Send: the send date and time of day",
  "Subject: the subject line",
  "(blank line, then the email body: a greeting line such as \"Dear friend,\", a blank line, the message, then the sign-off as instructed)",
  "",
  "EMAIL 2 and EMAIL 3 follow the same layout. Write nothing before CAMPAIGN BRIEF or after the last email. Each email body is under 200 words.",
].join("\n");

export type CampaignEmail = { send: string; subject: string; body: string };

export type CampaignBrief = {
  audience: string;
  messageArc: string;
  timeline: string;
};

export type ParsedCampaign =
  | { ok: true; brief: CampaignBrief; emails: CampaignEmail[] }
  | { ok: false; raw: string };

/** Strips stray markdown decoration a model might wrap a label in ("**EMAIL 1**"). */
const LABEL = (word: string) =>
  new RegExp(`^[\\s*#_]*${word}[\\s*#_:]*$`, "im");

function field(section: string, name: string, next: string[]): string | null {
  const stop = next.length
    ? `(?=^[\\s*_]*(?:${next.join("|")})[\\s*_]*:)`
    : "(?![\\s\\S])"; // end of section, not end of line (multiline flag)
  const re = new RegExp(
    `^[\\s*_]*${name}[\\s*_]*:[\\s*_]*([\\s\\S]*?)\\s*${stop}`,
    "im",
  );
  const m = section.match(re);
  const value = m?.[1]?.trim();
  return value ? value : null;
}

export function parseCampaign(raw: string): ParsedCampaign {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const fail: ParsedCampaign = { ok: false, raw: text };

  const briefLabel = text.match(LABEL("CAMPAIGN BRIEF"));
  if (!briefLabel || briefLabel.index == null) return fail;

  // Split on "EMAIL n" label lines.
  const emailLabel = /^[\s*#_]*EMAIL\s+(\d)[\s*#_:]*$/gim;
  const marks = [...text.matchAll(emailLabel)];
  if (marks.length !== 3) return fail;
  if (marks.some((m, i) => Number(m[1]) !== i + 1)) return fail;

  const briefText = text.slice(
    briefLabel.index + briefLabel[0].length,
    marks[0].index,
  );
  const audience = field(briefText, "Audience", ["Message arc", "Timeline"]);
  const messageArc = field(briefText, "Message arc", ["Timeline"]);
  const timeline = field(briefText, "Timeline", []);
  if (!audience || !messageArc || !timeline) return fail;

  const emails: CampaignEmail[] = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index! + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index! : text.length;
    const chunk = text.slice(start, end).trim();
    const send = chunk.match(/^[\s*_]*Send[\s*_]*:\s*(.+)$/im)?.[1]?.trim();
    const subjectMatch = chunk.match(/^[\s*_]*Subject[\s*_]*:\s*(.+)$/im);
    const subject = subjectMatch?.[1]?.trim();
    if (!send || !subject || subjectMatch?.index == null) return fail;
    const body = chunk
      .slice(subjectMatch.index + subjectMatch[0].length)
      .trim();
    if (!body) return fail;
    emails.push({ send, subject, body });
  }

  return { ok: true, brief: { audience, messageArc, timeline }, emails };
}

/** Plain-text rendering of a parsed campaign (for "Copy all"). */
export function campaignToText(c: {
  brief: CampaignBrief;
  emails: CampaignEmail[];
}): string {
  return [
    "CAMPAIGN BRIEF",
    `Audience: ${c.brief.audience}`,
    `Message arc: ${c.brief.messageArc}`,
    `Timeline: ${c.brief.timeline}`,
    ...c.emails.flatMap((e, i) => [
      "",
      `EMAIL ${i + 1}`,
      `Send: ${e.send}`,
      `Subject: ${e.subject}`,
      "",
      e.body,
    ]),
  ].join("\n");
}
