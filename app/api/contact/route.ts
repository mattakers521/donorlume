import { NextResponse } from "next/server";
import { z } from "zod";

import { getFromAddress, getResend } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(300)
    .email("Enter a valid email"),
  organization: z.string().trim().max(200).optional().default(""),
  message: z
    .string()
    .trim()
    .min(1, "A short message is required")
    .max(5000),
});

const escape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * POST /api/contact
 *
 * Landing-page contact form. Sends the submission to hello@donorlume.com
 * via Resend. Public endpoint — no auth required. Validates input via
 * Zod and returns a clean error if validation fails. If Resend isn't
 * configured the submission still succeeds for the user (logged
 * server-side so we don't lose the lead), but a misconfigured prod
 * deploy would show up as a 500 in the dashboard — intentional.
 */
export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Couldn't read your message — please check the fields.",
      },
      { status: 400 },
    );
  }
  const { name, email, organization, message } = parsed.data;

  let resend: ReturnType<typeof getResend>;
  let from: string;
  try {
    resend = getResend();
    from = getFromAddress();
  } catch (e) {
    console.error("Contact form: Resend not configured", { error: e });
    return NextResponse.json(
      {
        error:
          "Our contact form is temporarily unavailable. Please email hello@donorlume.com directly.",
      },
      { status: 500 },
    );
  }

  const subject = `New contact form submission from ${name}`;
  const lines = [
    `From: ${name} <${email}>`,
    organization ? `Organization: ${organization}` : null,
    "",
    message,
  ].filter((l): l is string => l !== null);

  const text = lines.join("\n");
  const html = `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1D1D1F;line-height:1.6;">
      <tr><td>
        <h2 style="font-size:18px;margin:0 0 16px;">New contact form submission</h2>
        <p style="margin:0 0 8px;"><strong>Name:</strong> ${escape(name)}</p>
        <p style="margin:0 0 8px;"><strong>Email:</strong> <a href="mailto:${escape(email)}">${escape(email)}</a></p>
        ${organization ? `<p style="margin:0 0 8px;"><strong>Organization:</strong> ${escape(organization)}</p>` : ""}
        <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
        <p style="white-space:pre-wrap;margin:0;">${escape(message)}</p>
      </td></tr>
    </table>
  `;

  try {
    const result = await resend.emails.send({
      from,
      to: "hello@donorlume.com",
      replyTo: email,
      subject,
      html,
      text,
      headers: {
        "X-DonorLume-Form": "contact",
      },
    });
    if (result.error) {
      console.error("Contact form Resend error", { error: result.error });
      return NextResponse.json(
        {
          error:
            "Couldn't send your message. Please email hello@donorlume.com directly.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Contact form send failed", { error: e });
    return NextResponse.json(
      {
        error:
          "Couldn't send your message. Please email hello@donorlume.com directly.",
      },
      { status: 502 },
    );
  }
}
