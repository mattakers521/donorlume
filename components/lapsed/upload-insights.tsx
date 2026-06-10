"use client";

/**
 * "Here's what we found" panel — renders above the scored donor table
 * after an upload completes (or on page reload while a list exists).
 *
 * Plain-English insight cards computed from the persisted donor list +
 * cohort assignments. The card mix adapts to whichever signals are
 * present in the data — a pure event-attendee list won't show a giving
 * mix, a giving-history-only list won't show event-year analysis.
 */

import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Layers,
  Mail,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { C, shadow } from "@/lib/design";
import type { DonorWithCohorts } from "@/components/lapsed/lapsed-client";

type Card = {
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  headline: string;
  detail: string;
};

type Props = {
  donors: DonorWithCohorts[];
  fileName: string | null;
};

export function UploadInsights({ donors, fileName }: Props) {
  const cards = computeCards(donors);
  if (cards.length === 0) return null;

  return (
    <section
      aria-label="Upload insights"
      style={{ marginBottom: 24 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 800,
            color: C.amberDark,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          Here&rsquo;s what we found
        </h2>
        {fileName && (
          <span
            style={{
              fontSize: 12,
              color: C.textSecondary,
              fontWeight: 600,
            }}
          >
            {fileName}
          </span>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {cards.map((c, i) => (
          <InsightCard key={i} card={c} />
        ))}
      </div>
    </section>
  );
}

function InsightCard({ card }: { card: Card }) {
  const { Icon } = card;
  return (
    <div
      style={{
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: shadow.sm,
        border: `1px solid ${C.border}`,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: card.iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={card.iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: C.text,
            marginBottom: 4,
            letterSpacing: -0.1,
            lineHeight: 1.3,
          }}
        >
          {card.headline}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.55,
            color: C.textSecondary,
            fontWeight: 500,
          }}
        >
          {card.detail}
        </p>
      </div>
    </div>
  );
}

// ─── Card computation ──────────────────────────────────────────────────

function computeCards(donors: DonorWithCohorts[]): Card[] {
  const total = donors.length;
  if (total === 0) return [];

  const cards: Card[] = [];

  // 1. Total contacts. Always shown — it's the headline confirmation
  //    that the upload landed.
  const withEmail = donors.filter(
    (d) => !!d.email && d.email.trim().length > 0,
  ).length;
  cards.push({
    Icon: Users,
    iconColor: C.amber,
    iconBg: C.amberLight,
    headline: `${total.toLocaleString()} contacts uploaded`,
    detail:
      withEmail === total
        ? `Every record has an email — all ${total.toLocaleString()} are ready for outreach.`
        : `${withEmail.toLocaleString()} have an email and are ready for outreach.`,
  });

  // 2. Giving mix. The post-CSV scorer's `hasGivingHistory` signal —
  //    which lives on `tier` since the persisted Donor model doesn't
  //    carry the boolean directly — splits the upload into actionable
  //    cells. Skip the card entirely if the entire upload is one mode
  //    so we don't waste a slot on "100% donors" / "100% attendees".
  const withGiving = donors.filter(
    (d) =>
      d.lastGiftDate != null ||
      (d.totalGifts != null && d.totalGifts > 0) ||
      (d.totalGiven != null && d.totalGiven > 0),
  ).length;
  const attendees = total - withGiving;
  if (withGiving > 0 && attendees > 0) {
    cards.push({
      Icon: BarChart3,
      iconColor: C.orange,
      iconBg: C.orangeLight,
      headline: `${withGiving.toLocaleString()} donors · ${attendees.toLocaleString()} attendees`,
      detail: `${pct(withGiving, total)} have recorded giving and got reactivation scores. ${pct(attendees, total)} are first-time-conversion candidates.`,
    });
  } else if (attendees === total) {
    cards.push({
      Icon: Calendar,
      iconColor: C.orange,
      iconBg: C.orangeLight,
      headline: "Attendee list (no giving history)",
      detail:
        "Treated as first-time-donor conversion targets. AI outreach skips reactivation language and asks for their first gift.",
    });
  } else {
    // All-giving list.
    const lapsed = donors.filter((d) => d.isLapsed).length;
    cards.push({
      Icon: TrendingUp,
      iconColor: C.orange,
      iconBg: C.orangeLight,
      headline: `${lapsed.toLocaleString()} lapsed of ${total.toLocaleString()}`,
      detail: `${pct(lapsed, total)} crossed the lapsed-threshold and got reactivation priority scores.`,
    });
  }

  // 3. Attendance pattern — only if attendee cohorts surfaced.
  const attendeeBuckets = countByAttendeeKey(donors);
  if (
    attendeeBuckets.firstTime + attendeeBuckets.multiYear > 0
  ) {
    cards.push({
      Icon: Calendar,
      iconColor: "#0F766E",
      iconBg: "rgba(15,118,110,0.12)",
      headline: `${(attendeeBuckets.firstTime + attendeeBuckets.multiYear).toLocaleString()} attendees segmented by year`,
      detail: [
        attendeeBuckets.multiYear > 0
          ? `${attendeeBuckets.multiYear.toLocaleString()} multi-year`
          : null,
        attendeeBuckets.firstTime > 0
          ? `${attendeeBuckets.firstTime.toLocaleString()} first-time`
          : null,
        attendeeBuckets.recent > 0
          ? `${attendeeBuckets.recent.toLocaleString()} recent`
          : null,
        attendeeBuckets.lapsed > 0
          ? `${attendeeBuckets.lapsed.toLocaleString()} lapsed`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  // 4. Top segments by member count. Excludes the four attendee
  //    cohorts (already surfaced above) so this card adds a different
  //    angle: which giving-behavior / entity / tag segments dominate.
  const cohortCounts = countByCohort(donors);
  const topCohorts = [...cohortCounts.entries()]
    .filter(
      ([slug]) =>
        !slug.startsWith("attendee-") && slug !== "individual-donors",
    )
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);
  if (topCohorts.length > 0) {
    const top = topCohorts[0];
    const others = topCohorts.slice(1);
    cards.push({
      Icon: Layers,
      iconColor: C.purple,
      iconBg: "rgba(175,82,222,0.14)",
      headline: `Top segment: ${top[1].name}`,
      detail: [
        `${top[1].count.toLocaleString()} ${top[1].count === 1 ? "person" : "people"} (${pct(top[1].count, total)})`,
        ...others.map(
          ([, info]) =>
            `${info.name}: ${info.count.toLocaleString()} (${pct(info.count, total)})`,
        ),
      ].join(" · "),
    });
  }

  // 5. Email-readiness confirmation when not already shown in card 1.
  if (withEmail < total) {
    cards.push({
      Icon: Mail,
      iconColor: C.amberDark,
      iconBg: C.amberLight,
      headline: `${(total - withEmail).toLocaleString()} rows missing email`,
      detail:
        "Those rows uploaded but can't receive outreach. Add emails in your CRM and re-upload to reach them.",
    });
  } else if (cards.length < 4) {
    cards.push({
      Icon: CheckCircle2,
      iconColor: C.green,
      iconBg: C.greenLight,
      headline: "All set for outreach",
      detail:
        "Pick a segment on the next screen and let Claude draft personalized emails — or open the AI Outreach studio from the sidebar.",
    });
  }

  return cards;
}

function pct(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function countByAttendeeKey(donors: DonorWithCohorts[]): {
  firstTime: number;
  multiYear: number;
  recent: number;
  lapsed: number;
} {
  const out = { firstTime: 0, multiYear: 0, recent: 0, lapsed: 0 };
  for (const d of donors) {
    for (const dc of d.cohorts) {
      switch (dc.cohort.slug) {
        case "attendee-first-time":
          out.firstTime++;
          break;
        case "attendee-multi-year":
          out.multiYear++;
          break;
        case "attendee-recent":
          out.recent++;
          break;
        case "attendee-lapsed":
          out.lapsed++;
          break;
      }
    }
  }
  return out;
}

function countByCohort(
  donors: DonorWithCohorts[],
): Map<string, { name: string; count: number }> {
  const out = new Map<string, { name: string; count: number }>();
  for (const d of donors) {
    for (const dc of d.cohorts) {
      const slug = dc.cohort.slug;
      const existing = out.get(slug);
      if (existing) existing.count++;
      else out.set(slug, { name: dc.cohort.name, count: 1 });
    }
  }
  return out;
}
