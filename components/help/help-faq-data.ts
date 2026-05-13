/**
 * In-app help FAQ — categorized for the /help search-and-browse UI.
 *
 * Keep answers practical and DonorLume-specific. When a question maps to
 * a real route in the app, link to it inline so the user can jump there
 * instead of hunting through menus.
 */

export type FaqCategory =
  | "getting-started"
  | "prospect-discovery"
  | "lapsed-scoring"
  | "ai-outreach"
  | "cohorts"
  | "billing"
  | "security";

export type FaqItem = {
  category: FaqCategory;
  q: string;
  a: string;
};

export const FAQ_CATEGORIES: { key: FaqCategory; label: string }[] = [
  { key: "getting-started", label: "Getting Started" },
  { key: "prospect-discovery", label: "Prospect Discovery" },
  { key: "lapsed-scoring", label: "Lapsed Donor Scoring" },
  { key: "ai-outreach", label: "AI Outreach" },
  { key: "cohorts", label: "Cohorts" },
  { key: "billing", label: "Billing & Account" },
  { key: "security", label: "Data & Security" },
];

export const FAQS: FaqItem[] = [
  // ─── Getting Started ───
  {
    category: "getting-started",
    q: "What's the fastest way to see value from DonorLume?",
    a: "Upload a CSV of your donor list at /lapsed (or hit \"Load Sample Data\" to preview). Within seconds you'll see every donor classified into cohorts, scored for reactivation, and ready for outreach. Most teams have their first AI-drafted email going out in under five minutes.",
  },
  {
    category: "getting-started",
    q: "Which CRMs and event platforms work with DonorLume?",
    a: "Any CRM or event platform that can export a CSV. We've tested Bloomerang, Salesforce NPSP, Little Green Light, Kindful, Neon CRM, and DonorPerfect on the CRM side, plus OneCause, GiveButter, BetterUnite, Givesmart, and Greater Giving for event fundraising data. Our column auto-detector works with arbitrary header names, so unusual exports are usually fine too.",
  },
  {
    category: "getting-started",
    q: "Can I use DonorLume with my event fundraising software?",
    a: "Absolutely. DonorLume works with all major event fundraising platforms including OneCause, GiveButter, BetterUnite, Givesmart, and Greater Giving. Export your attendee, bidder, and donor data as a CSV after your event, upload it to DonorLume, and we'll automatically classify your event attendees into cohorts, score them for follow-up potential, and generate personalized outreach to convert one-time event donors into lifelong supporters.",
  },
  {
    category: "getting-started",
    q: "Are direct CRM integrations or custom email sending domains coming?",
    a: "Yes — both are on the near-term roadmap. Direct CRM integrations will replace the CSV-export step for the most-requested platforms, and custom sending domains will let you send outreach from your own org's email address (instead of via Resend's shared infrastructure) with full SPF/DKIM/DMARC alignment. We're prioritizing which CRMs and domain features to ship first based on what customers ask for, so please email support@donorlume.com and tell us which CRM you use today.",
  },
  {
    category: "getting-started",
    q: "Do I need to clean my CSV before uploading?",
    a: "Almost never. DonorLume auto-detects the columns it needs (donor name, email, gift dates, totals) regardless of case or naming. Rows with no parseable last-gift date are skipped silently; everything else is scored. If a column you care about isn't picked up, rename it to something closer to its plain-English label and re-upload.",
  },
  {
    category: "getting-started",
    q: "How do I invite a teammate?",
    a: "Go to Settings → Team Members, click Invite Member, enter your teammate's email, and pick a role (Owner, Admin, Member, or Viewer). They'll receive a branded email invitation that expires in 7 days. Each plan has a seat allowance — Starter includes 2 seats, Growth 5, Scale unlimited — and pending invitations count toward that cap until they're accepted or revoked. You can manage seats and see your remaining allowance at /settings/team.",
  },

  // ─── Prospect Discovery ───
  {
    category: "prospect-discovery",
    q: "Where does prospect data come from?",
    a: "Prospect Discovery searches public IRS 990 and 990-PF filings — the same data anyone can pull from the IRS. We make it searchable, surface revenue/assets/grants/officers, and link to the actual filing PDFs. We don't scrape, broker, or buy personal data.",
  },
  {
    category: "prospect-discovery",
    q: "How do I save a foundation to my pipeline?",
    a: "Click the bookmark icon on any search result or detail page. Saved prospects appear on your /dashboard and persist for your whole org — anyone on your team can see and act on them.",
  },
  {
    category: "prospect-discovery",
    q: "Can I search by cause area?",
    a: "Yes. The search bar accepts free text (\"food security\", \"arts education\"), and the cause-suggestion chips below it map to NTEE categories under the hood. You can also filter by state to scope to local funders.",
  },
  {
    category: "prospect-discovery",
    q: "Why don't I see a foundation I know exists?",
    a: "The ProPublica index only covers 501(c)(3) and related public-charity entities. Smaller family foundations, fiscally sponsored entities, and very-new registrations sometimes lag in filings. Try searching with the parent organization's name or its EIN if you have it.",
  },

  // ─── Lapsed Donor Scoring ───
  {
    category: "lapsed-scoring",
    q: "What is the reactivation score?",
    a: "A 0–100 score based on the RFM+ algorithm: 30% recency (how long since last gift), 25% frequency (total gifts), 25% monetary (largest + lifetime value), 20% tenure (years on file). Higher = better candidate for reactivation outreach.",
  },
  {
    category: "lapsed-scoring",
    q: "How is \"lapsed\" defined?",
    a: "Default is 12 months since last gift, configurable per-org in OrgSettings. The threshold filter on /lapsed lets you preview different windows (3/6/12/18/24 months) without re-uploading — useful when you want to see who's at the edge before they fully lapse.",
  },
  {
    category: "lapsed-scoring",
    q: "What do the score tiers mean?",
    a: "High (80+): warm — call first. Medium (55–79): worth a personal email. Low (30–54): mass outreach territory. Cold (under 30): probably gone — focus elsewhere. Tiers help you batch your outreach effort across hundreds of donors.",
  },
  {
    category: "lapsed-scoring",
    q: "Why does a lapsed donor show \"Active Elsewhere\"?",
    a: "That flag signals the donor appears to be giving to other nonprofits based on enrichment data. They haven't stopped being generous — they've stopped giving to you. These are often your best reactivation targets because the giving habit is intact.",
  },

  // ─── AI Outreach ───
  {
    category: "ai-outreach",
    q: "How does the AI generate emails?",
    a: "Each draft is generated individually using Claude with the donor's actual giving history, cohort context, your organization's mission, and the tone you've selected. Two donors in the same campaign never get the same email — it's not a template engine.",
  },
  {
    category: "ai-outreach",
    q: "Can I edit drafts before sending?",
    a: "Yes — every draft is editable in the Results step. Click Edit on any card, change the subject or body, and the new copy persists for sending or export. You can also regenerate a single draft if you want a different angle.",
  },
  {
    category: "ai-outreach",
    q: "What's the difference between \"Open in Mail\" and \"Send from DonorLume\"?",
    a: "Open in Mail launches your local mail client (Outlook, Apple Mail, Gmail web) with the draft prefilled — useful if you want to send from your own address. Send from DonorLume delivers it through our Resend integration, which tracks opens, clicks, replies, and bounces so you can measure what worked.",
  },
  {
    category: "ai-outreach",
    q: "How do I see open and click rates?",
    a: "Visit /outreach to see every campaign with sent/open/click rates inline, or click a campaign for the full report — per-draft delivery state, cohort breakdown, and the rates compared to your other campaigns.",
  },

  // ─── Cohorts ───
  {
    category: "cohorts",
    q: "What's a cohort?",
    a: "A meaningful grouping of donors — like \"Major Donors\", \"Lapsed Sustainers\", \"Gala Attendees\". DonorLume auto-classifies every donor across four dimensions (giving behavior, engagement, entity type, trajectory) the moment you upload. Cohorts overlap — one donor is often in five or more.",
  },
  {
    category: "cohorts",
    q: "How are donors assigned to cohorts?",
    a: "Giving-behavior and entity-type cohorts use rules over your CSV data (e.g., totalGiven ≥ $1,000 + lastGift within 18 months = Major Donor). Engagement cohorts are pulled from columns you tag during upload (\"Gala Attendees\", \"Volunteers\", etc.). Trajectory cohorts (Rising Star, Churn Risk) ship in Phase 3.",
  },
  {
    category: "cohorts",
    q: "Can I create custom cohorts?",
    a: "Yes — engagement cohorts auto-create from any CSV column you mark as a cohort source during upload. Fully-custom rule-based cohorts (e.g., \"donors who gave to two campaigns last year\") are on the roadmap.",
  },
  {
    category: "cohorts",
    q: "Why is a donor showing in multiple cohorts?",
    a: "By design. A long-tenure $50K donor who came to the gala is a Major Donor AND a Gala Attendee AND a Legacy Prospect — the right outreach treats all three. Click any cohort badge on /lapsed to filter the table to just that intersection.",
  },

  // ─── Billing & Account ───
  {
    category: "billing",
    q: "What plan am I on?",
    a: "Visit /settings/billing — you'll see your current tier, usage meters (donor records, AI emails this month, team members), and the option to upgrade. New accounts start on Starter with a 14-day free trial.",
  },
  {
    category: "billing",
    q: "How do I upgrade or downgrade?",
    a: "From /settings/billing click \"Switch to this plan\" on the tier you want, or open the Stripe Billing Portal via \"Manage subscription\" to change plans, update payment, or cancel. Upgrades prorate instantly; downgrades take effect at your next renewal so you keep the features you paid for.",
  },
  {
    category: "billing",
    q: "What happens if I hit a plan limit?",
    a: "DonorLume blocks the over-limit action (extra donor uploads, additional AI emails this month) with a 402 response and an upgrade prompt — but your existing data stays exactly where it is. Bump to the next tier and you're back in business.",
  },
  {
    category: "billing",
    q: "Can I cancel anytime?",
    a: "Yes. Month-to-month, no contracts, no cancellation fees. Cancel via Manage Subscription in /settings/billing → Stripe Portal. Your account stays active through the end of the paid period, then downgrades cleanly — we don't hold data hostage.",
  },

  // ─── Data & Security ───
  {
    category: "security",
    q: "Is my donor data isolated from other organizations?",
    a: "Yes. Every DB query is scoped by orgId via the withOrg middleware — there is no code path that can return another org's donors, prospects, or campaigns. Data is encrypted in transit (TLS) and at rest (Postgres on Neon).",
  },
  {
    category: "security",
    q: "Does DonorLume sell or share my donor data?",
    a: "No. We use your data exclusively to run DonorLume for your organization. We don't sell to third parties, we don't pool it across orgs for analytics, and we don't train AI models on it. Your data is yours.",
  },
  {
    category: "security",
    q: "Can I export my data?",
    a: "Donor-list export is on the roadmap. Today you can request an export by emailing support@donorlume.com and we'll deliver a CSV of every donor + cohort + outreach event we hold for your org within 48 hours. Billing history is exportable anytime via the Stripe Billing Portal.",
  },
  {
    category: "security",
    q: "How do I delete my account and all my data?",
    a: "Email support@donorlume.com with the request. We'll confirm the org name + owner, then hard-delete every row (donors, prospects, campaigns, drafts, audit log) within 7 days and send confirmation. Deletion is permanent — there is no undelete.",
  },
];
