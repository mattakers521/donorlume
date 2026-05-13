/**
 * Shared email scaffolding — header (starburst SVG inline) + body content
 * area + footer + plain-text twin. Inline styles only; many email clients
 * strip <style> blocks. Apple Warm palette pulled from the design tokens.
 *
 * Renders an email that looks like the brand without depending on any
 * external image hosting — the starburst is an inline SVG (~1KB) so it
 * shows even when image-loading is blocked.
 */

const AMBER = "#E8860C";
const AMBER_DARK = "#C26A00";
const ORANGE = "#D44A1A";
const TEXT = "#1D1D1F";
const TEXT_TERTIARY = "#AEAEB2";
const BG = "#FAFAF8";
const SURFACE = "#FFFFFF";
const BORDER = "rgba(0,0,0,0.06)";

// 16-ray gradient starburst, identical to the in-app SVG component.
// Inlined as a string so the email is self-contained.
const STARBURST = `<svg width="56" height="56" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g" cx="50%" cy="50%"><stop offset="0%" stop-color="#F5B731"/><stop offset="40%" stop-color="#E8860C"/><stop offset="70%" stop-color="#D44A1A"/><stop offset="100%" stop-color="#B83A15"/></radialGradient></defs><g>${Array.from(
  { length: 16 },
)
  .map((_, i) => {
    const angle = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const innerR = i % 2 === 0 ? 12 : 16;
    const outerR = i % 2 === 0 ? 38 : 30;
    const spread = (Math.PI / 16) * 0.45;
    const cx = 50,
      cy = 50;
    const x1 = (cx + Math.cos(angle - spread) * innerR).toFixed(2);
    const y1 = (cy + Math.sin(angle - spread) * innerR).toFixed(2);
    const x2 = (cx + Math.cos(angle) * outerR).toFixed(2);
    const y2 = (cy + Math.sin(angle) * outerR).toFixed(2);
    const x3 = (cx + Math.cos(angle + spread) * innerR).toFixed(2);
    const y3 = (cy + Math.sin(angle + spread) * innerR).toFixed(2);
    return `<polygon points="${cx},${cy} ${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="url(#g)" opacity="${(0.85 + (i % 3) * 0.05).toFixed(2)}"/>`;
  })
  .join(
    "",
  )}<circle cx="50" cy="50" r="5" fill="#F5B731"/><circle cx="50" cy="50" r="2.5" fill="#FFDD70"/></g></svg>`;

export type EmailContent = {
  /** <title> + preheader (the snippet shown next to the subject in inbox). */
  preheader: string;
  /** Serif headline at the top of the email body. */
  heading: string;
  /** Paragraph strings — each rendered as a <p>. Plain text; no HTML. */
  paragraphs: string[];
  /**
   * Optional "Here's what to do first" block. Rendered between
   * `paragraphs` and the CTA as a tinted card with a serif sub-heading
   * and a numbered list. Each step has a short title (bold) + a one-line
   * body. Plain text twin renders as "1. Title — body".
   */
  steps?: {
    title: string;
    items: { title: string; body: string }[];
  };
  cta: {
    label: string;
    href: string;
  };
  /** Optional postscript paragraph, smaller text. */
  postscript?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmail(content: EmailContent): {
  html: string;
  text: string;
} {
  const { preheader, heading, paragraphs, steps, cta, postscript } = content;

  const paragraphsHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT}">${escapeHtml(p)}</p>`,
    )
    .join("");

  // Numbered "Here's what to do first" block. Amber-tinted card with a
  // serif sub-heading and a column of numbered rows. Uses table-based
  // layout so the circle badges hold their shape in Outlook/Gmail.
  const stepsHtml = steps
    ? (() => {
        const rows = steps.items
          .map((s, i) => {
            const n = i + 1;
            return `<tr>
              <td style="padding:10px 0 10px;vertical-align:top;width:38px">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,${AMBER},${ORANGE});color:#fff;font-size:14px;font-weight:800;text-align:center;line-height:30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${n}</td></tr></table>
              </td>
              <td style="padding:10px 0 10px 14px;vertical-align:top">
                <div style="font-size:15px;font-weight:700;color:${TEXT};margin:0 0 2px;line-height:1.3">${escapeHtml(s.title)}</div>
                <div style="font-size:14px;line-height:1.55;color:${TEXT}">${escapeHtml(s.body)}</div>
              </td>
            </tr>`;
          })
          .join("");
        return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:8px 0 24px;background:#FFF4E6;border-radius:14px">
          <tr><td style="padding:18px 22px 6px">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:400;letter-spacing:-0.3px;color:${TEXT};margin:0 0 4px">${escapeHtml(steps.title)}</div>
          </td></tr>
          <tr><td style="padding:0 22px 18px">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%">${rows}</table>
          </td></tr>
        </table>`;
      })()
    : "";

  const postscriptHtml = postscript
    ? `<p style="margin:32px 0 0;font-size:13px;line-height:1.6;color:${TEXT_TERTIARY};font-style:italic">${escapeHtml(postscript)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
<span style="display:none;color:${BG};font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(preheader)}</span>
<div style="padding:32px 16px;background:${BG}">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="width:100%;max-width:560px;margin:0 auto;background:${SURFACE};border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
    <tr>
      <td style="padding:32px 36px 24px;border-bottom:1px solid ${BORDER}">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="vertical-align:middle">${STARBURST}</td>
            <td style="padding-left:14px;vertical-align:middle">
              <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${TEXT};line-height:1.1">DonorLume</div>
              <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:${TEXT_TERTIARY};text-transform:uppercase;margin-top:2px">by Vibrant Causes</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 36px 28px">
        <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;font-weight:400;letter-spacing:-0.8px;color:${TEXT}">${escapeHtml(heading)}</h1>
        ${paragraphsHtml}
        ${stepsHtml}
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 0">
          <tr>
            <td style="border-radius:14px;background:linear-gradient(135deg,${AMBER},${ORANGE});box-shadow:0 8px 22px rgba(232,134,12,0.30)">
              <a href="${cta.href}" style="display:inline-block;padding:16px 32px;color:#fff;font-size:16px;font-weight:800;text-decoration:none;letter-spacing:0.2px">${escapeHtml(cta.label)}</a>
            </td>
          </tr>
        </table>
        ${postscriptHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:20px 36px 28px;background:${BG};border-top:1px solid ${BORDER};text-align:center">
        <p style="margin:0;font-size:12px;color:${TEXT_TERTIARY}">Sent by DonorLume · <a href="${escapeHtml(baseUrl())}" style="color:${AMBER_DARK};text-decoration:none">donorlume.com</a></p>
      </td>
    </tr>
  </table>
</div>
</body>
</html>`;

  const stepsText = steps
    ? [
        "",
        steps.title,
        "",
        ...steps.items.map((s, i) => `${i + 1}. ${s.title} — ${s.body}`),
      ]
    : [];

  const text = [
    preheader,
    "",
    heading,
    "",
    ...paragraphs,
    ...stepsText,
    "",
    `${cta.label}: ${cta.href}`,
    postscript ? `\n${postscript}` : "",
    "",
    "—",
    "DonorLume by Vibrant Causes",
  ]
    .join("\n")
    .trim();

  return { html, text };
}

export function baseUrl(): string {
  return (
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000"
  );
}
