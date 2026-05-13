# DonorLume — Email Sending & Campaign Tracking Spec

*Feed this file to Claude Code. This adds direct email sending, open/click tracking, and campaign reporting to the existing AI Outreach module.*

---

## Overview

Currently, the AI Outreach Studio generates draft emails that users copy/paste or open in their mail client. This spec adds direct sending via Resend, per-email tracking (opens, clicks, bounces, replies), and campaign-level reporting.

---

## 1. Email Provider: Resend

**Why Resend:** Simple API, excellent deliverability, built for transactional/personalized email (not mass marketing), generous free tier (100 emails/day), clear pricing beyond that ($20/mo for 50K emails). Perfect for the 50-500 emails/month our users will send.

**Setup:**
- npm install resend
- RESEND_API_KEY in .env
- Sending domain: verify donorlume.com in Resend dashboard (DNS records: SPF, DKIM, DMARC)
- From address: outreach@donorlume.com (or customizable per org in OrgSettings)

---

## 2. Database Schema Additions

Update existing OutreachDraft model:

```prisma
model OutreachDraft {
  // ... existing fields ...
  
  // Email tracking
  messageId       String?    // Resend message ID
  sentAt          DateTime?  // Already exists
  deliveredAt     DateTime?
  openedAt        DateTime?  // Already exists — make functional
  openCount       Int        @default(0)
  clickedAt       DateTime?
  clickCount      Int        @default(0)
  repliedAt       DateTime?  // Already exists — make functional  
  bouncedAt       DateTime?
  bounceReason    String?
  unsubscribedAt  DateTime?
  
  // Tracking pixel and link IDs
  trackingId      String?    @unique  // UUID for tracking pixel
  
  clicks          EmailClick[]
}

model EmailClick {
  id          String   @id @default(cuid())
  draftId     String
  url         String   // The original URL that was clicked
  clickedAt   DateTime @default(now())
  userAgent   String?
  
  draft       OutreachDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)
  
  @@index([draftId])
}
```

Update OutreachCampaign:
```prisma
model OutreachCampaign {
  // ... existing fields ...
  sentCount       Int     @default(0)  // Already exists
  deliveredCount  Int     @default(0)
  openedCount     Int     @default(0)
  clickedCount    Int     @default(0)
  repliedCount    Int     @default(0)
  bouncedCount    Int     @default(0)
}
```

---

## 3. API Routes

```
// Sending
POST   /api/outreach/drafts/[id]/send     — Send a single draft via Resend
POST   /api/outreach/campaigns/[id]/send   — Send all DRAFT/APPROVED drafts in a campaign

// Tracking (public, no auth — called by email clients)
GET    /api/track/open/[trackingId]        — Tracking pixel endpoint (returns 1x1 transparent gif)
GET    /api/track/click/[trackingId]/[linkIndex] — Click redirect endpoint

// Webhooks
POST   /api/webhooks/resend               — Resend webhook for delivery, bounce, complaint events

// Reporting
GET    /api/outreach/campaigns/[id]/report — Campaign performance summary
GET    /api/outreach/report                — Cross-campaign reporting (date range, cohort filters)
```

---

## 4. Sending Flow

### Single Email Send

```typescript
// lib/email/send.ts

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOutreachEmail(draft: OutreachDraftWithDonor, org: Organization) {
  const trackingId = draft.trackingId || generateUUID();
  
  // Prepare HTML body with tracking
  const htmlBody = prepareEmailHtml(draft.body, trackingId, draft.id);
  
  const result = await resend.emails.send({
    from: `${org.settings.senderName || org.name} <outreach@donorlume.com>`,
    to: draft.recipientEmail,
    subject: draft.subject,
    html: htmlBody,
    text: draft.body, // Plain text fallback
    headers: {
      "X-DonorLume-Draft-Id": draft.id,
      "X-DonorLume-Campaign-Id": draft.campaignId,
    },
  });
  
  // Update draft status
  await prisma.outreachDraft.update({
    where: { id: draft.id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      messageId: result.data?.id,
      trackingId,
    },
  });
  
  // Update campaign counts
  await prisma.outreachCampaign.update({
    where: { id: draft.campaignId },
    data: { sentCount: { increment: 1 } },
  });
  
  return result;
}
```

### HTML Preparation (tracking pixel + link wrapping)

```typescript
// lib/email/prepare.ts

export function prepareEmailHtml(
  bodyText: string, 
  trackingId: string,
  draftId: string
): string {
  const baseUrl = process.env.NEXTAUTH_URL || "https://app.donorlume.com";
  
  // Convert plain text to HTML paragraphs
  let html = bodyText
    .split("\n\n")
    .map(p => `<p style="margin: 0 0 16px; line-height: 1.6; color: #1D1D1F;">${p.trim()}</p>`)
    .join("");
  
  // Wrap links for click tracking
  let linkIndex = 0;
  html = html.replace(
    /https?:\/\/[^\s<"]+/g,
    (url) => {
      const tracked = `${baseUrl}/api/track/click/${trackingId}/${linkIndex}?url=${encodeURIComponent(url)}`;
      linkIndex++;
      return tracked;
    }
  );
  
  // Add tracking pixel at the end
  const pixel = `<img src="${baseUrl}/api/track/open/${trackingId}" width="1" height="1" style="display:none" alt="" />`;
  
  return `
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 15px; color: #1D1D1F; max-width: 600px;">
      ${html}
      ${pixel}
    </div>
  `;
}
```

---

## 5. Tracking Endpoints

### Open Tracking

```typescript
// app/api/track/open/[trackingId]/route.ts

export async function GET(req, { params }) {
  const { trackingId } = params;
  
  // Update draft — fire and forget, don't block the response
  prisma.outreachDraft.updateMany({
    where: { trackingId },
    data: {
      openedAt: new Date(), // Only set if null? Or always update for latest open
      openCount: { increment: 1 },
      status: "OPENED",
    },
  }).catch(() => {}); // Don't fail if DB is slow
  
  // Also increment campaign openedCount (only on first open)
  // Use a transaction to check if this is the first open
  
  // Return 1x1 transparent GIF
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  
  return new Response(pixel, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
```

### Click Tracking

```typescript
// app/api/track/click/[trackingId]/[linkIndex]/route.ts

export async function GET(req, { params }) {
  const { trackingId, linkIndex } = params;
  const url = req.nextUrl.searchParams.get("url");
  
  if (!url) return new Response("Missing URL", { status: 400 });
  
  // Log click
  const draft = await prisma.outreachDraft.findUnique({
    where: { trackingId },
  });
  
  if (draft) {
    await prisma.emailClick.create({
      data: {
        draftId: draft.id,
        url: decodeURIComponent(url),
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });
    
    await prisma.outreachDraft.update({
      where: { id: draft.id },
      data: {
        clickedAt: new Date(),
        clickCount: { increment: 1 },
        status: draft.status === "SENT" ? "OPENED" : draft.status, // At minimum, a click implies an open
      },
    });
  }
  
  // Redirect to original URL
  return Response.redirect(decodeURIComponent(url), 302);
}
```

---

## 6. Resend Webhook Handler

```typescript
// app/api/webhooks/resend/route.ts

export async function POST(req) {
  const body = await req.json();
  const { type, data } = body;
  
  // Find draft by Resend message ID
  const draft = await prisma.outreachDraft.findFirst({
    where: { messageId: data.email_id },
  });
  
  if (!draft) return new Response("OK"); // Unknown email, ignore
  
  switch (type) {
    case "email.delivered":
      await prisma.outreachDraft.update({
        where: { id: draft.id },
        data: { deliveredAt: new Date() },
      });
      break;
      
    case "email.bounced":
      await prisma.outreachDraft.update({
        where: { id: draft.id },
        data: { 
          bouncedAt: new Date(), 
          bounceReason: data.bounce?.message,
          status: "BOUNCED",
        },
      });
      break;
      
    case "email.complained":
      // Spam complaint — log and potentially flag the donor
      await prisma.outreachDraft.update({
        where: { id: draft.id },
        data: { unsubscribedAt: new Date() },
      });
      break;
  }
  
  return new Response("OK");
}
```

---

## 7. UI Changes

### Outreach Results Page — Add "Send" Button

Replace the current "Open in Mail" button with two options:
- **"Send from DonorLume"** (primary, amber gradient) — sends via Resend, updates status to SENT
- **"Open in Mail"** (secondary, outline) — existing mailto: behavior

After sending, the draft card shows delivery status:
- "Sent" → gray clock icon
- "Delivered" → blue check
- "Opened" → amber eye icon + "Opened X times"
- "Clicked" → amber pointer icon + "Clicked X links"
- "Bounced" → red alert icon + reason
- "Replied" → green check (manual mark or detected via webhook)

### Campaign Report Page (/outreach/campaigns/[id])

After a campaign is sent, show a report page:

**Top metrics bar:**
- Sent: 40
- Delivered: 38 (95%)
- Opened: 29 (76%)
- Clicked: 12 (32%)  
- Replied: 3 (8%)
- Bounced: 2 (5%)

**Timeline chart:** Opens and clicks over the first 7 days after send

**Per-draft table:** All emails in the campaign with individual status, open count, click count, and quick actions (resend, view draft)

**Cohort breakdown (if applicable):** Performance by cohort — "Gala Attendees: 85% open rate vs. All Others: 62% open rate"

### Campaign Management Page (/outreach)

Update the outreach page to show:
- List of past campaigns with key metrics (sent, opened, clicked)
- "New Campaign" button (existing flow)
- Click into any campaign → campaign report page

### Dashboard Updates

Add to dashboard:
- "Recent Outreach" widget showing last 3 campaigns with open/click rates
- "Outreach Performance" KPI card with aggregate open rate

---

## 8. Compliance

- Include unsubscribe link in every email footer (CAN-SPAM requirement)
- Unsubscribe endpoint: GET /api/unsubscribe/[trackingId] — marks donor, shows confirmation page
- Honor unsubscribes: check before sending, exclude unsubscribed donors from future campaign sends
- Include physical address in email footer (CAN-SPAM): pull from OrgSettings or default to Vibrant Causes address
- Rate limit sending: max 10 emails/second to avoid triggering spam filters

---

## 9. Tier Restrictions

| Feature | Starter | Growth | Scale |
|---------|---------|--------|-------|
| AI outreach generation | 50/mo | 250/mo | Unlimited |
| Direct email sending | No (copy/paste only) | Yes | Yes |
| Open/click tracking | No | Yes | Yes |
| Campaign reporting | Basic (counts only) | Full | Full + cohort breakdown |

This means the "Send from DonorLume" button only appears for Growth+ plans. Starter users see "Upgrade to send directly and track engagement."
