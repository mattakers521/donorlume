/**
 * Admin lifecycle notifications.
 *
 * Single entry-point `notifyAdmin(event, payload)` fans out independently
 * to two channels:
 *
 *   • Email (via Resend) — when ADMIN_EMAIL is set. The default channel.
 *   • Slack — when SLACK_WEBHOOK_URL is set. Optional fallback / extra
 *     destination. Configured independently of email; both can fire at
 *     once if both env vars are set.
 *
 * Fire-and-forget: never awaited at the call site, never throws. Each
 * channel's I/O errors are logged but don't fail the calling request.
 *
 * Five events trigger admin alerts:
 *   - signup          — every new account
 *   - first-upload    — first donor CSV per org (lifetime milestone)
 *   - first-campaign  — first AI outreach campaign per org (milestone)
 *   - plan-upgrade    — Stripe webhook detects a tier jump
 *   - churn-alert     — daily cron flags users inactive 14+ days
 */

import "server-only";

import { getFromAddress, getResend } from "@/lib/email/resend";

export type AdminEvent =
  | "signup"
  | "first-upload"
  | "first-campaign"
  | "plan-upgrade"
  | "churn-alert";

type SignupPayload = {
  userName: string;
  userEmail: string;
  orgName: string;
  /** How the account was created — "password" or "google-onboarding". */
  source: "password" | "google-onboarding";
};

type FirstUploadPayload = {
  orgName: string;
  totalDonors: number;
  lapsedCount: number;
  fileName: string;
};

type FirstCampaignPayload = {
  orgName: string;
  campaignName: string;
  draftsRequested: number;
};

type PlanUpgradePayload = {
  orgName: string;
  fromPlan: string;
  toPlan: string;
};

type ChurnAlertPayload = {
  inactiveUsers: {
    name: string | null;
    email: string;
    daysSinceActive: number;
  }[];
};

type EventMap = {
  signup: SignupPayload;
  "first-upload": FirstUploadPayload;
  "first-campaign": FirstCampaignPayload;
  "plan-upgrade": PlanUpgradePayload;
  "churn-alert": ChurnAlertPayload;
};

/**
 * Public API. Triggers email + Slack independently based on which env
 * vars are populated. Always returns void; never throws.
 */
export function notifyAdmin<E extends AdminEvent>(
  event: E,
  payload: EventMap[E],
): void {
  // Both channels are independent fire-and-forget. We do the env-var
  // checks here (not inside the fan-out fns) so the helpers can stay
  // small + cleanly testable.
  if (process.env.ADMIN_EMAIL?.trim()) {
    void sendAdminEmail(event, payload).catch((e) => {
      console.error("admin email send failed", { event, error: e });
    });
  }
  if (process.env.SLACK_WEBHOOK_URL?.trim()) {
    void sendSlackMessage(event, payload).catch((e) => {
      console.error("admin slack send failed", { event, error: e });
    });
  }
}

// ─── Email channel ────────────────────────────────────────────────────

async function sendAdminEmail<E extends AdminEvent>(
  event: E,
  payload: EventMap[E],
): Promise<void> {
  const to = process.env.ADMIN_EMAIL?.trim();
  if (!to) return;

  let resend: ReturnType<typeof getResend>;
  let from: string;
  try {
    resend = getResend();
    from = getFromAddress();
  } catch (e) {
    console.warn("admin email skipped — Resend not configured", {
      event,
      reason: e instanceof Error ? e.message : "unknown",
    });
    return;
  }

  const { subject, text, html } = buildEmailMessage(event, payload);

  const result = await resend.emails.send({
    from,
    to,
    subject,
    text,
    html,
    headers: {
      "X-DonorLume-Admin-Event": event,
    },
  });
  if (result.error) {
    console.error("admin email Resend error", {
      event,
      error: result.error,
    });
  }
}

type EmailMessage = { subject: string; text: string; html: string };

function buildEmailMessage(
  event: AdminEvent,
  payload: EventMap[AdminEvent],
): EmailMessage {
  switch (event) {
    case "signup": {
      const p = payload as SignupPayload;
      const sourceLabel =
        p.source === "password" ? "Email + password" : "Google OAuth";
      return wrap({
        subject: `🎉 New DonorLume signup — ${p.userName} (${p.orgName})`,
        preheader: `${p.userName} from ${p.orgName} just joined DonorLume.`,
        heading: "🎉 New signup",
        rows: [
          ["Name", p.userName],
          ["Email", p.userEmail],
          ["Org", p.orgName],
          ["Source", sourceLabel],
        ],
      });
    }
    case "first-upload": {
      const p = payload as FirstUploadPayload;
      return wrap({
        subject: `📤 First upload — ${p.orgName} (${p.totalDonors.toLocaleString()} donors)`,
        preheader: `${p.orgName} uploaded their first donor list.`,
        heading: "📤 First donor upload",
        rows: [
          ["Org", p.orgName],
          ["File", p.fileName],
          ["Donors", p.totalDonors.toLocaleString()],
          ["Lapsed", p.lapsedCount.toLocaleString()],
        ],
      });
    }
    case "first-campaign": {
      const p = payload as FirstCampaignPayload;
      return wrap({
        subject: `✉️ First outreach campaign — ${p.orgName}`,
        preheader: `${p.orgName} just started their first AI outreach campaign.`,
        heading: "✉️ First outreach campaign",
        rows: [
          ["Org", p.orgName],
          ["Campaign", p.campaignName],
          [
            "Drafts",
            p.draftsRequested > 0
              ? p.draftsRequested.toLocaleString()
              : "(generation in flight)",
          ],
        ],
      });
    }
    case "plan-upgrade": {
      const p = payload as PlanUpgradePayload;
      return wrap({
        subject: `💸 Plan upgrade — ${p.orgName} → ${p.toPlan}`,
        preheader: `${p.orgName} upgraded from ${p.fromPlan} to ${p.toPlan}.`,
        heading: "💸 Plan upgrade",
        rows: [
          ["Org", p.orgName],
          ["From", p.fromPlan],
          ["To", p.toPlan],
        ],
      });
    }
    case "churn-alert": {
      const p = payload as ChurnAlertPayload;
      const count = p.inactiveUsers.length;
      const truncated = p.inactiveUsers.slice(0, 10);
      const overflow = count > 10 ? count - 10 : 0;
      // Custom body — the table-of-rows wrap() doesn't fit a variable
      // list of inactive users. Render manually.
      const userListHtml = truncated
        .map(
          (u) => `
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#1D1D1F;">
                <strong>${escape(u.name ?? u.email)}</strong>
                <span style="color:#6E6E73;"> &lt;${escape(u.email)}&gt;</span>
              </td>
              <td style="padding:6px 0;font-size:14px;color:#6E6E73;text-align:right;">
                ${u.daysSinceActive}d
              </td>
            </tr>
          `,
        )
        .join("");
      const overflowHtml = overflow
        ? `<p style="margin:14px 0 0;font-size:13px;color:#6E6E73;">… and ${overflow} more</p>`
        : "";
      const userListText = truncated
        .map(
          (u) =>
            `• ${u.name ?? u.email} <${u.email}> — ${u.daysSinceActive}d inactive`,
        )
        .join("\n");
      const overflowText = overflow ? `\n… and ${overflow} more` : "";

      const html = wrap({
        subject: "",
        preheader: "",
        heading: "🌙 Inactivity alert",
        rows: [],
      }).html;
      // Inject the per-user table where wrap() would have rendered the
      // empty rows list.
      const withUsers = html.replace(
        '<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;"></table>',
        `<p style="margin:0 0 14px;font-size:15px;color:#1D1D1F;"><strong>${count}</strong> user${count === 1 ? "" : "s"} inactive for 14+ days:</p>
         <table cellpadding="0" cellspacing="0" border="0" width="100%">${userListHtml}</table>
         ${overflowHtml}`,
      );

      return {
        subject: `🌙 ${count} inactive user${count === 1 ? "" : "s"} (14+ days)`,
        text: `🌙 ${count} inactive user${count === 1 ? "" : "s"} (14+ days):\n${userListText}${overflowText}`,
        html: withUsers,
      };
    }
    default:
      return {
        subject: `DonorLume event: ${String(event)}`,
        text: `DonorLume admin event: ${String(event)}`,
        html: `<p>DonorLume admin event: <code>${escape(String(event))}</code></p>`,
      };
  }
}

const escape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Renders a brand-styled admin email with a heading + a label/value
 * row table. Returns subject + text + html. The HTML uses inline
 * styles for email-client compat.
 */
function wrap({
  subject,
  preheader,
  heading,
  rows,
}: {
  subject: string;
  preheader: string;
  heading: string;
  rows: [string, string][];
}): EmailMessage {
  const text =
    `${heading}\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n");

  const rowsHtml = rows
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:6px 12px 6px 0;font-size:13px;color:#6E6E73;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;width:120px;vertical-align:top;">
            ${escape(k)}
          </td>
          <td style="padding:6px 0;font-size:15px;color:#1D1D1F;">
            ${escape(v)}
          </td>
        </tr>
      `,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:0;line-height:0;mso-hide:all;">${escape(preheader)}</div>
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FAFAF8;padding:40px 20px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:18px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 4px 16px rgba(0,0,0,0.06);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#E8860C,#D44A1A);height:4px;"></td></tr>
        <tr><td style="padding:28px 32px 24px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#C26A00;">DonorLume admin</p>
          <h1 style="margin:0 0 22px;font-family:Georgia,serif;font-size:24px;font-weight:400;letter-spacing:-0.5px;color:#1D1D1F;line-height:1.2;">
            ${escape(heading)}
          </h1>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;">${rowsHtml}</table>
        </td></tr>
        <tr><td style="padding:18px 32px 24px;border-top:1px solid rgba(0,0,0,0.06);font-size:12px;color:#AEAEB2;">
          Sent automatically by DonorLume · <a href="https://donorluma.com" style="color:#C26A00;text-decoration:none;">donorluma.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

// ─── Slack channel ────────────────────────────────────────────────────

type SlackMessage = {
  text: string;
  blocks: Array<Record<string, unknown>>;
};

async function sendSlackMessage<E extends AdminEvent>(
  event: E,
  payload: EventMap[E],
): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return;

  const body = buildSlackMessage(event, payload);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Slack webhook returned non-OK", {
      event,
      status: res.status,
      body: text.slice(0, 200),
    });
  }
}

function buildSlackMessage(
  event: AdminEvent,
  payload: EventMap[AdminEvent],
): SlackMessage {
  switch (event) {
    case "signup": {
      const p = payload as SignupPayload;
      return {
        text: `🎉 New DonorLume signup: ${p.userName} (${p.orgName})`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "🎉 New signup", emoji: true },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Name:*\n${p.userName}` },
              { type: "mrkdwn", text: `*Email:*\n${p.userEmail}` },
              { type: "mrkdwn", text: `*Org:*\n${p.orgName}` },
              {
                type: "mrkdwn",
                text: `*Source:*\n${p.source === "password" ? "Email + password" : "Google OAuth"}`,
              },
            ],
          },
        ],
      };
    }
    case "first-upload": {
      const p = payload as FirstUploadPayload;
      return {
        text: `📤 First CSV upload from ${p.orgName} — ${p.totalDonors} donors`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "📤 First donor upload",
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Org:*\n${p.orgName}` },
              { type: "mrkdwn", text: `*File:*\n${p.fileName}` },
              {
                type: "mrkdwn",
                text: `*Donors:*\n${p.totalDonors.toLocaleString()}`,
              },
              {
                type: "mrkdwn",
                text: `*Lapsed:*\n${p.lapsedCount.toLocaleString()}`,
              },
            ],
          },
        ],
      };
    }
    case "first-campaign": {
      const p = payload as FirstCampaignPayload;
      return {
        text: `✉️ First outreach campaign from ${p.orgName} — ${p.draftsRequested} drafts`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "✉️ First outreach campaign",
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Org:*\n${p.orgName}` },
              { type: "mrkdwn", text: `*Campaign:*\n${p.campaignName}` },
              {
                type: "mrkdwn",
                text: `*Drafts:*\n${p.draftsRequested.toLocaleString()}`,
              },
            ],
          },
        ],
      };
    }
    case "plan-upgrade": {
      const p = payload as PlanUpgradePayload;
      return {
        text: `💸 Plan upgrade: ${p.orgName} → ${p.toPlan}`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "💸 Plan upgrade", emoji: true },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Org:*\n${p.orgName}` },
              {
                type: "mrkdwn",
                text: `*From → To:*\n${p.fromPlan} → ${p.toPlan}`,
              },
            ],
          },
        ],
      };
    }
    case "churn-alert": {
      const p = payload as ChurnAlertPayload;
      const count = p.inactiveUsers.length;
      const lines = p.inactiveUsers
        .slice(0, 10)
        .map(
          (u) =>
            `• ${u.name ?? u.email} (${u.email}) — ${u.daysSinceActive}d inactive`,
        )
        .join("\n");
      const overflow = count > 10 ? `\n… and ${count - 10} more` : "";
      return {
        text: `🌙 ${count} inactive user${count === 1 ? "" : "s"} (14+ days)`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🌙 Inactivity alert",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${count}* user${count === 1 ? "" : "s"} inactive for 14+ days:\n${lines}${overflow}`,
            },
          },
        ],
      };
    }
    default:
      return {
        text: `DonorLume event: ${String(event)}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `DonorLume event: \`${String(event)}\``,
            },
          },
        ],
      };
  }
}
