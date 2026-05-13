# DonorLuma — Technical Architecture & Build Specification
## Donor Intelligence SaaS for Nonprofits & Charities — by Vibrant Causes, LLC

---

## 1. Product Overview

DonorLuma is a multi-tenant SaaS platform that helps fundraisers at nonprofits, charities, and fundraising organizations discover new donor prospects, score lapsed donors for reactivation, and generate AI-powered personalized outreach — all from publicly available data sources.

**Product name:** DonorLuma
**Parent company:** Vibrant Causes, LLC
**Domain:** donorluma.com
**Tagline:** Stop reacting. Start strategizing.

**Positioning:** DonorLuma gives fundraisers the donor intelligence that major institutions take for granted — prospect discovery, lapsed donor scoring, and AI-powered outreach — at a price and complexity level built for the rest of the nonprofit world. It makes overworked, under-resourced fundraisers feel like they finally have superpowers.

### Core Modules
1. **Dashboard** — KPI overview, action queue, pipeline summary
2. **Prospect Discovery** — Search IRS 990/990-PF filings via ProPublica API; save prospects to pipeline
3. **Lapsed Donor Scoring** — CSV upload from CRM, RFM+ scoring engine, enrichment signals
4. **AI Outreach Studio** — Claude-powered personalized email generation with edit/copy/send workflow
5. **Donor Intelligence** — Enrichment layer (Phase 2)
6. **Reports** — Pipeline analytics and outreach performance (Phase 2)

### Target Customer
Development Directors and fundraising teams at mid-size nonprofits. They export donor lists from CRMs like Bloomerang, Salesforce NPSP, Little Green Light, or Kindful.

---

## 2. Technical Stack

### Frontend
- **Framework:** Next.js 14+ (App Router)
- **UI:** React + Tailwind CSS
- **State:** Zustand (lightweight, no boilerplate)
- **Charts:** Recharts
- **Tables:** TanStack Table
- **Forms:** React Hook Form + Zod validation
- **File parsing:** Papaparse (CSV)

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Next.js API Routes (or separate FastAPI if preferred)
- **ORM:** Prisma
- **Database:** PostgreSQL 15+ (Supabase or Neon for managed hosting)
- **Auth:** NextAuth.js v5 (Auth.js) with email/password + Google OAuth
- **File storage:** S3-compatible (Cloudflare R2 or AWS S3) for CSV uploads
- **Job queue:** Inngest or BullMQ for async AI generation
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Email delivery:** Resend or SendGrid (for outreach sends)
- **Payments:** Stripe (subscriptions)

### Infrastructure
- **Hosting:** Vercel (frontend + API routes) or Railway
- **Database:** Supabase (Postgres + built-in auth option)
- **CDN:** Vercel Edge / Cloudflare
- **Monitoring:** Sentry
- **Analytics:** PostHog or Mixpanel

### Design System — "Apple Warm"

**Aesthetic:** Clean, spacious, premium — Apple's design language with warm nonprofit heart. No visible borders on cards (use subtle shadows). Generous whitespace. Restrained color usage.

**Fonts:**
- Headlines: `Instrument Serif` (elegant, warm)
- Body/UI: `Plus Jakarta Sans` (modern, slightly rounded)
- Never use Inter, Roboto, or system fonts

**Color Palette (from Vibrant Causes logo):**
- Amber (primary): `#E8860C`
- Amber Light: `#FFF4E6`
- Amber Dark: `#C26A00`
- Orange: `#D44A1A`
- Orange Light: `#FFF0EB`
- Gold: `#F5B731`
- Gold Light: `#FFFAED`
- Text: `#1D1D1F`
- Text Secondary: `#6E6E73`
- Text Tertiary: `#AEAEB2`
- Background: `#FAFAF8`
- Surface: `#FFFFFF`
- Sidebar: `#1C1C1E`
- Green (success): `#34C759`
- Purple (enrichment): `#AF52DE`

**Shadows (not borders):**
- sm: `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)`
- md: `0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)`
- lg: `0 12px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)`

**Logo:** SVG starburst mark derived from Vibrant Causes logo. Renders as 16-ray radial gradient (gold center → amber → orange → red tips) with soft glow filter. Used in sidebar (60px), auth screens (58px left / 120px hero), loading state (88px), and empty states (96px).

**Branding hierarchy:** "DonorLuma" in bold weight + "by Vibrant Causes" in uppercase tracked small caps below.

---

## 3. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── MULTI-TENANCY ───

model Organization {
  id            String   @id @default(cuid())
  name          String
  mission       String?  @db.Text
  website       String?
  logo          String?
  plan          Plan     @default(FREE)
  stripeId      String?  @unique
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  users         OrgUser[]
  prospects     Prospect[]
  donorLists    DonorList[]
  outreachCampaigns OutreachCampaign[]
  settings      OrgSettings?
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  passwordHash  String?
  image         String?
  createdAt     DateTime @default(now())

  orgs          OrgUser[]
  outreachDrafts OutreachDraft[]
}

model OrgUser {
  id            String   @id @default(cuid())
  userId        String
  orgId         String
  role          Role     @default(MEMBER)
  createdAt     DateTime @default(now())

  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  org           Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([userId, orgId])
}

model OrgSettings {
  id                  String   @id @default(cuid())
  orgId               String   @unique
  lapsedThresholdMonths Int    @default(12)
  defaultTone         String   @default("warm")
  defaultEmailType    String   @default("reactivation")
  senderName          String?
  senderTitle         String?
  senderEmail         String?
  customInstructions  String?  @db.Text

  org                 Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
}

enum Plan {
  FREE        // 50 prospects, 10 outreach/mo
  STARTER     // 500 prospects, 100 outreach/mo — $49/mo
  GROWTH      // 2500 prospects, 500 outreach/mo — $149/mo
  ENTERPRISE  // Unlimited — custom pricing
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

// ─── PROSPECT DISCOVERY ───

model Prospect {
  id            String   @id @default(cuid())
  orgId         String
  ein           String?
  name          String
  type          ProspectType
  city          String?
  state         String?
  nteeCode      String?
  revenue       Float?
  assets        Float?
  causeAffinity String?
  capacity      String?
  score         Int?
  status        ProspectStatus @default(RESEARCHING)
  notes         String?  @db.Text
  source        String?  // "propublica", "manual", "enrichment"
  metadata      Json?    // flexible storage for API data
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  org           Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId, status])
  @@index([orgId, score])
}

enum ProspectType {
  INDIVIDUAL
  FOUNDATION
  CORPORATE
  DAF
  GOVERNMENT
}

enum ProspectStatus {
  RESEARCHING
  WARM
  HOT
  CONTACTED
  CULTIVATING
  ASKED
  COMMITTED
  DECLINED
  ARCHIVED
}

// ─── LAPSED DONOR SCORING ───

model DonorList {
  id            String   @id @default(cuid())
  orgId         String
  name          String   // "Spring 2026 Upload", "Full CRM Export"
  fileName      String
  fileUrl       String?  // S3 path
  totalDonors   Int
  lapsedCount   Int?
  processedAt   DateTime?
  createdAt     DateTime @default(now())

  org           Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  donors        Donor[]
}

model Donor {
  id                String   @id @default(cuid())
  donorListId       String
  name              String
  email             String?
  donorType         String?  // Individual, Corporate, Foundation
  firstGiftDate     DateTime?
  lastGiftDate      DateTime?
  totalGifts        Int?
  totalGiven        Float?
  largestGift       Float?
  notes             String?  @db.Text

  // Computed scores
  isLapsed          Boolean  @default(false)
  reactivationScore Int?
  tier              String?  // High, Medium, Low, Cold
  recencyScore      Int?
  frequencyScore    Int?
  monetaryScore     Int?
  tenureScore       Int?

  // Enrichment
  activeElsewhere   Boolean?
  searchIntent      Boolean?
  enrichmentData    Json?

  createdAt         DateTime @default(now())

  donorList         DonorList @relation(fields: [donorListId], references: [id], onDelete: Cascade)
  outreachDrafts    OutreachDraft[]

  @@index([donorListId, reactivationScore])
  @@index([donorListId, isLapsed])
}

// ─── AI OUTREACH ───

model OutreachCampaign {
  id              String   @id @default(cuid())
  orgId           String
  name            String
  tone            String   @default("warm")
  emailType       String   @default("reactivation")
  campaign        String?
  customInstructions String? @db.Text
  totalDrafts     Int      @default(0)
  sentCount       Int      @default(0)
  createdAt       DateTime @default(now())

  org             Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  drafts          OutreachDraft[]
}

model OutreachDraft {
  id              String   @id @default(cuid())
  campaignId      String
  donorId         String?
  userId          String
  recipientName   String
  recipientEmail  String?
  subject         String
  body            String   @db.Text
  status          DraftStatus @default(DRAFT)
  sentAt          DateTime?
  openedAt        DateTime?
  repliedAt       DateTime?
  metadata        Json?    // donor context snapshot
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  campaign        OutreachCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  donor           Donor? @relation(fields: [donorId], references: [id])
  user            User @relation(fields: [userId], references: [id])

  @@index([campaignId, status])
}

enum DraftStatus {
  DRAFT
  APPROVED
  SENT
  OPENED
  REPLIED
  BOUNCED
}
```

---

## 4. API Routes

### Auth
```
POST   /api/auth/register          — Create account + org
POST   /api/auth/login             — Email/password login
POST   /api/auth/[...nextauth]     — NextAuth handlers
GET    /api/auth/session            — Current session
```

### Organization
```
GET    /api/org                     — Get current org
PATCH  /api/org                     — Update org details
GET    /api/org/settings            — Get org settings
PATCH  /api/org/settings            — Update settings
GET    /api/org/members             — List members
POST   /api/org/members/invite      — Invite member
DELETE /api/org/members/:id         — Remove member
```

### Prospects
```
GET    /api/prospects               — List prospects (paginated, filterable)
POST   /api/prospects               — Add prospect (from discovery or manual)
PATCH  /api/prospects/:id           — Update prospect
DELETE /api/prospects/:id           — Archive prospect
GET    /api/prospects/search        — Proxy to ProPublica API
GET    /api/prospects/:ein/details  — Proxy to ProPublica org details
POST   /api/prospects/bulk          — Bulk save from search results
GET    /api/prospects/stats         — Pipeline counts and KPIs
```

### Donor Lists & Scoring
```
GET    /api/donors/lists            — List uploaded donor files
POST   /api/donors/upload           — Upload CSV, parse, and score
GET    /api/donors/lists/:id        — Get scored donor list
DELETE /api/donors/lists/:id        — Delete donor list
GET    /api/donors/lists/:id/donors — Get donors (paginated, filterable)
PATCH  /api/donors/:id              — Update donor notes/status
POST   /api/donors/rescore/:listId  — Re-score with new threshold
GET    /api/donors/stats            — Lapsed donor KPIs
```

### AI Outreach
```
GET    /api/outreach/campaigns      — List campaigns
POST   /api/outreach/campaigns      — Create campaign
GET    /api/outreach/campaigns/:id  — Get campaign with drafts
POST   /api/outreach/generate       — Generate drafts (async job)
GET    /api/outreach/drafts/:id     — Get single draft
PATCH  /api/outreach/drafts/:id     — Edit draft
POST   /api/outreach/drafts/:id/regenerate — Regenerate single draft
POST   /api/outreach/drafts/:id/send       — Send via email provider
POST   /api/outreach/export         — Export drafts as CSV/TXT
GET    /api/outreach/stats          — Outreach KPIs
```

### Dashboard
```
GET    /api/dashboard/kpis          — Aggregated KPIs
GET    /api/dashboard/actions       — Action queue items
GET    /api/dashboard/pipeline      — Pipeline summary
```

### Billing (Stripe)
```
POST   /api/billing/checkout        — Create Stripe checkout session
POST   /api/billing/portal          — Create Stripe billing portal
POST   /api/billing/webhook         — Stripe webhook handler
GET    /api/billing/usage           — Current plan usage
```

---

## 5. AI Outreach — Prompt Architecture

### System Prompt Template
Stored per-organization. Variables are injected at generation time.

```
You are a nonprofit fundraising expert writing personalized donor
communications for {{org.name}}.

Organization context:
- Mission: {{org.mission}}
- Current campaign: {{campaign.name}}
- Sender: {{settings.senderName}}, {{settings.senderTitle}}

Rules:
- Write Subject: line first, then email body
- Personalize using donor history and notes
- Adjust approach by donor type (Individual/Foundation/Corporate)
- Under 250 words
- No placeholder brackets
- End with sender signature
- Tone: {{campaign.tone}}
- Type: {{campaign.emailType}}
{{#if campaign.customInstructions}}
Additional: {{campaign.customInstructions}}
{{/if}}
```

### Per-Donor User Message
```
DONOR: {{donor.name}} ({{donor.donorType}})
- {{donor.totalGifts}} gifts totaling {{donor.totalGiven}}
- Last gift: {{donor.lastGiftDate}} ({{donor.lapsedMonths}} months ago)
- Largest: {{donor.largestGift}} | Average: {{donor.avgGift}}
- Reactivation score: {{donor.reactivationScore}}/100 ({{donor.tier}})
- Active elsewhere: {{donor.activeElsewhere}}
- Notes: {{donor.notes}}

Write the personalized {{campaign.emailType}} email now.
```

### Generation Flow
1. User creates campaign (selects tone, type, donors)
2. API enqueues generation job
3. Worker processes each donor sequentially:
   - Build prompt from templates + donor data
   - Call Claude API (claude-sonnet-4-20250514, max_tokens: 1000)
   - Parse subject line and body from response
   - Save OutreachDraft to database
   - Emit progress event via SSE or WebSocket
4. Frontend shows real-time progress bar
5. Rate limit: ~10 requests/minute to Anthropic API

---

## 6. Scoring Engine — RFM+ Algorithm

The reactivation score is computed server-side when a CSV is uploaded.

```javascript
function scoreReactivation(donor, today, thresholdMonths = 12) {
  const daysSinceLast = daysBetween(donor.lastGiftDate, today);
  const tenureDays = daysBetween(donor.firstGiftDate, donor.lastGiftDate);
  const avgGift = donor.totalGifts > 0 ? donor.totalGiven / donor.totalGifts : 0;

  // Recency: 0–30 points (less time = higher)
  const recency = Math.max(0, 30 - (daysSinceLast / 30) * 1.5);

  // Frequency: 0–25 points
  const frequency = Math.min(25, donor.totalGifts * 2.5);

  // Monetary: 0–25 points
  const monetary = Math.min(25, (avgGift / 200) * 2.5);

  // Tenure: 0–20 points
  const tenure = Math.min(20, (tenureDays / 365) * 4);

  const score = Math.round(Math.min(100, recency + frequency + monetary + tenure));
  const tier = score >= 80 ? "High" : score >= 55 ? "Medium" : score >= 30 ? "Low" : "Cold";

  return { score, tier, recency, frequency, monetary, tenure };
}
```

Enrichment signals (Phase 2) will add bonus points:
- Active elsewhere (FEC data match): +10
- Recent cause-related search intent: +8
- Board/committee affiliations: +5

---

## 7. Multi-Tenant Data Isolation

Every database query MUST include `orgId` in the WHERE clause. Enforce this at the middleware level:

```javascript
// middleware/withOrg.js
export function withOrg(handler) {
  return async (req, res) => {
    const session = await getServerSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const orgUser = await prisma.orgUser.findFirst({
      where: { userId: session.user.id },
      include: { org: true },
    });
    if (!orgUser) return res.status(403).json({ error: "No organization" });

    req.org = orgUser.org;
    req.orgRole = orgUser.role;
    return handler(req, res);
  };
}
```

---

## 8. Pricing & Usage Limits

| Feature | Free | Starter ($49/mo) | Growth ($149/mo) | Enterprise |
|---------|------|-------------------|-------------------|------------|
| Saved Prospects | 50 | 500 | 2,500 | Unlimited |
| AI Outreach / month | 10 | 100 | 500 | Unlimited |
| Donor List Uploads | 1 | 10 | Unlimited | Unlimited |
| Team Members | 1 | 3 | 10 | Unlimited |
| ProPublica Search | Yes | Yes | Yes | Yes |
| FEC Enrichment | No | Basic | Full | Full |
| Priority Support | No | Email | Email + Chat | Dedicated |

Track usage in a `Usage` table, reset monthly via cron.

---

## 9. Deployment Checklist

### Environment Variables
```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://app.donorluma.com
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
S3_BUCKET=donorluma-uploads
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
RESEND_API_KEY=re_...
SENTRY_DSN=...
```

### Deploy Steps
1. `npx create-next-app@latest donorluma --typescript --tailwind --app`
2. `npm install prisma @prisma/client next-auth @auth/prisma-adapter`
3. `npm install @anthropic-ai/sdk stripe resend papaparse zustand`
4. `npm install recharts @tanstack/react-table react-hook-form zod`
5. `npx prisma init` → paste schema → `npx prisma db push`
6. Configure auth providers in `auth.ts`
7. Build API routes per Section 4
8. Port frontend components from prototype artifacts
9. Deploy to Vercel: `vercel --prod`
10. Configure Stripe products + webhook
11. Set up custom domain: app.donorluma.com

### Claude Code Command to Scaffold
```bash
claude "Build a Next.js 14 SaaS app called DonorLuma using the
technical spec in DONORLUMA-SPEC.md. Use App Router, Prisma with
PostgreSQL, NextAuth v5, Tailwind CSS, and the Anthropic SDK.
Follow the 'Apple Warm' design system in Section 2 — use Instrument
Serif for headlines, Plus Jakarta Sans for body, amber (#E8860C)
as primary accent, subtle shadows instead of borders, and the SVG
starburst logo from the prototype. Start with the database schema,
then auth, then API routes, then port the React components from
the donorluma-app.jsx prototype. Follow the multi-tenant pattern
in Section 7."
```

---

## 10. Phase Roadmap

### Phase 1 — MVP (Weeks 1–4) ✅ PROTOTYPE COMPLETE
- [x] Dashboard shell with KPIs and navigation
- [x] Prospect Discovery with live ProPublica API
- [x] Lapsed Donor Scoring with CSV upload and RFM engine
- [x] AI Outreach Studio with Claude email generation
- [x] Unified app with shared navigation
- [ ] Persistent storage (window.storage for prototype)
- [ ] Auth flow UI

### Phase 2 — Production Backend (Weeks 5–8)
- [ ] Next.js project scaffold with Prisma + PostgreSQL
- [ ] Auth (email/password + Google OAuth)
- [ ] Multi-tenant org model
- [ ] API routes for all modules
- [ ] File upload to S3 for CSV
- [ ] Async outreach generation with job queue
- [ ] Deploy to Vercel + Supabase

### Phase 3 — Polish & Launch (Weeks 9–12)
- [ ] Stripe billing integration
- [ ] Usage tracking and limits
- [ ] Email delivery (Resend) for outreach sends
- [ ] Onboarding wizard for new orgs
- [ ] Reports module with Recharts
- [ ] Mobile responsive polish
- [ ] Landing page / marketing site

### Phase 4 — Enrichment & Scale (Months 4–6)
- [ ] FEC donation data integration
- [ ] Board/committee affiliation enrichment
- [ ] CRM integrations (Bloomerang, Salesforce NPSP API)
- [ ] Donor Intelligence module (full enrichment profiles)
- [ ] AI prospect scoring (Claude analyzes org alignment)
- [ ] Webhooks for CRM sync
- [ ] White-label option for consultants

---

## 11. Revenue Projections

### Assumptions
- Target: 200 paying orgs within 12 months
- Mix: 60% Starter ($49), 30% Growth ($149), 10% Enterprise ($299)
- Monthly churn: 5%
- CAC: $150 (content marketing + nonprofit conference presence)

### Month 12 Projection
- 120 Starter × $49 = $5,880/mo
- 60 Growth × $149 = $8,940/mo
- 20 Enterprise × $299 = $5,980/mo
- **MRR: ~$20,800/mo ($249,600 ARR)**

### Cost Structure
- Vercel Pro: $20/mo
- Supabase Pro: $25/mo
- Anthropic API: ~$200–500/mo (scales with usage)
- Stripe fees: 2.9% + $0.30
- Resend: $20/mo
- Domain/DNS: $20/yr
- **Total fixed: ~$300–600/mo**

---

*This specification is the complete blueprint for building DonorLuma as a production SaaS. Hand this document plus the donorluma-app.jsx prototype to Claude Code to scaffold the full application.*
