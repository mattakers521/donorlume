"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { C } from "@/lib/design";

type QA = { q: string; a: string };

const FAQ: QA[] = [
  {
    q: "What is DonorLume?",
    a: "DonorLume is a cohort intelligence platform for nonprofits. It automatically classifies your donors into meaningful segments, scores them for action, discovers new funding prospects, and generates personalized outreach — so you always know who to talk to, what to say, and when.",
  },
  {
    q: "What are donor cohorts?",
    a: "Cohorts are meaningful groups within your donor base — like major donors, lapsed sustainers, gala attendees, corporate sponsors, first-time givers, or donors who are increasing their giving. Every fundraiser thinks in cohorts, but most tools force them to build these segments manually in spreadsheets. DonorLume creates them automatically.",
  },
  {
    q: "Who is DonorLume for?",
    a: "Development Directors, Fundraising Directors, Executive Directors, and anyone responsible for raising money at a nonprofit, charity, or fundraising organization — regardless of size or cause area. If you've ever spent hours building donor segments in Excel, DonorLume is for you.",
  },
  {
    q: "What kinds of donors can I analyze?",
    a: "Any kind. Individual donors, corporate sponsors, foundation funders, monthly sustainers, gala attendees, volunteers who also give, board members — any donor or supporter in your CRM. Upload them all and DonorLume sorts them into actionable cohorts.",
  },
  {
    q: "Where does the prospect data come from?",
    a: "Prospect Discovery searches publicly available IRS 990 and 990-PF filings. This is the same data available to anyone through the IRS — we make it searchable and actionable. We don't scrape, buy, or broker personal data.",
  },
  {
    q: "How does the AI outreach work?",
    a: "Select donors from any cohort, choose a tone and approach, and DonorLume generates a unique email for each person based on their actual giving history, cohort context, and your organization's mission. You review and approve every draft. The AI never sends anything without your sign-off.",
  },
  {
    q: "Can I send emails directly from DonorLume?",
    a: "Yes. Growth and Scale plans include direct email sending with open, click, and response tracking. Starter plans can copy drafts to send from their own email client.",
  },
  {
    q: "Will this replace my CRM?",
    a: "No — and it's not trying to. DonorLume is the intelligence layer that sits on top of your CRM. Export your donor list, let DonorLume analyze and segment it, run your outreach, then log results back in your CRM. It makes your existing tools smarter without replacing them.",
  },
  {
    q: "Can I use DonorLume with my event fundraising software?",
    a: "Absolutely. DonorLume works with all major event fundraising platforms including OneCause, GiveButter, BetterUnite, Givesmart, and Greater Giving. Export your attendee, bidder, and donor data as a CSV after your event, upload it to DonorLume, and we'll automatically classify your event attendees into cohorts, score them for follow-up potential, and generate personalized outreach to convert one-time event donors into lifelong supporters.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. Every organization's data is completely isolated. We never sell or share your donor data. All data is encrypted in transit and at rest. You can export or delete your data at any time.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Yes. All plans are month-to-month with no contracts and no cancellation fees. Your data stays accessible if you downgrade. We never hold data hostage.",
  },
  {
    q: "How is this different from wealth screening tools like iWave or DonorSearch?",
    a: "Wealth screening tools tell you how rich someone is. DonorLume tells you who to talk to, what to say, and when — across every cohort in your donor base. We combine prospecting, scoring, cohort analysis, and AI outreach in one platform at a fraction of enterprise pricing. And we work with your existing CRM instead of requiring you to switch.",
  },
  {
    q: "I'm a consultant working with multiple nonprofits. Can I use DonorLume?",
    a: "Absolutely. Each nonprofit gets its own isolated account. Our Managed tier is designed for consultants and agencies. Contact us for custom setup.",
  },
];

export function LandingFaq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section
      id="faq"
      style={{
        padding: "88px 24px",
        backgroundColor: C.dark,
        color: C.textOnDark,
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div
            className="landing-amber-rule"
            aria-hidden
            style={{ width: 80, margin: "0 auto 28px" }}
          />
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: C.amberOnDark,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Frequently Asked
          </div>
          <h2
            className="landing-section-h2"
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontWeight: 400,
              color: "#fff",
              margin: 0,
            }}
          >
            Questions? We&rsquo;ve got answers.
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FAQ.map((item, i) => {
            const isOpen = openIdx === i;
            return (
              <div
                key={item.q}
                style={{
                  backgroundColor: isOpen
                    ? C.darkPanel
                    : "rgba(255,255,255,0.03)",
                  borderRadius: 16,
                  border: isOpen
                    ? `1px solid ${C.borderDarkStrong}`
                    : `1px solid ${C.borderDark}`,
                  overflow: "hidden",
                  transition: "background-color 0.2s, border-color 0.2s",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%",
                    padding: "20px 22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily:
                      "var(--font-jakarta), -apple-system, sans-serif",
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {item.q}
                  </span>
                  <Plus
                    size={18}
                    color={isOpen ? C.amberOnDark : C.textOnDarkTertiary}
                    style={{
                      flexShrink: 0,
                      transform: isOpen ? "rotate(45deg)" : "none",
                      transition: "transform 0.2s, color 0.2s",
                    }}
                  />
                </button>
                {isOpen && (
                  <div
                    style={{
                      padding: "0 22px 22px",
                      fontSize: 15,
                      lineHeight: 1.7,
                      color: C.textOnDarkBody,
                      fontWeight: 500,
                    }}
                  >
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
