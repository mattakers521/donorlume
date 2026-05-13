/**
 * HTML preparation for outbound donor email — Spec §4 "HTML Preparation".
 *
 * Takes the plain-text body Claude wrote and produces a minimal HTML
 * shell with:
 *   1. Each paragraph wrapped in a styled <p>
 *   2. Every absolute http(s) link rewritten to point at our
 *      /api/track/click/[trackingId]/[linkIndex]?url=… redirect
 *   3. A 1×1 transparent tracking pixel at the end pointing at
 *      /api/track/open/[trackingId]
 *
 * Plain-text body is preserved separately for the Resend `text` field.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ENTITY_MAP[c]!);
}

/**
 * Resolve the public base URL used in tracking links. Falls back to
 * NEXTAUTH_URL (configured in .env) and then to the localhost dev URL.
 *
 * Note: this URL must be reachable by the recipient's email client.
 * In local dev, `http://localhost:3000` only works if the recipient is
 * on the same machine — production deploys need a public hostname.
 */
export function trackingBaseUrl(): string {
  return (
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000"
  );
}

const URL_RE = /https?:\/\/[^\s<"'`)]+/g;

export type PreparedEmail = {
  html: string;
  text: string;
  /** Per-link records the click endpoint will dereference. */
  linkMap: { index: number; url: string }[];
};

export function prepareEmailHtml(
  bodyText: string,
  trackingId: string,
): PreparedEmail {
  const baseUrl = trackingBaseUrl().replace(/\/$/, "");
  const linkMap: { index: number; url: string }[] = [];

  // Split on blank lines for paragraphs; preserve single newlines as <br />.
  const paragraphs = bodyText
    .split(/\r?\n\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const paragraphHtml = paragraphs
    .map((p) => {
      // Escape first, then re-introduce wrapped tracking links so escaping
      // doesn't mangle the rewritten URL.
      const escaped = escapeHtml(p).replace(/\r?\n/g, "<br />");
      const linked = escaped.replace(URL_RE, (rawUrl) => {
        // Strip any trailing punctuation common in prose ("foo.com," / "foo.com.").
        const trailing = rawUrl.match(/[.,;:!?)]+$/);
        const url = trailing
          ? rawUrl.slice(0, -trailing[0].length)
          : rawUrl;
        const idx = linkMap.length;
        linkMap.push({ index: idx, url });
        const tracked = `${baseUrl}/api/track/click/${encodeURIComponent(trackingId)}/${idx}?url=${encodeURIComponent(url)}`;
        const tail = trailing ? trailing[0] : "";
        return `<a href="${tracked}" style="color:#C26A00;text-decoration:underline">${escapeHtml(url)}</a>${tail}`;
      });
      return `<p style="margin:0 0 16px;line-height:1.6;color:#1D1D1F">${linked}</p>`;
    })
    .join("");

  const pixelUrl = `${baseUrl}/api/track/open/${encodeURIComponent(trackingId)}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px" />`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#fafaf8"><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#1D1D1F;max-width:600px;padding:24px">${paragraphHtml}${pixel}</div></body></html>`;

  return { html, text: bodyText, linkMap };
}
