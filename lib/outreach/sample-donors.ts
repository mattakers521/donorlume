/**
 * Sample donors for the AI Outreach Studio's demo flow.
 * Ported from donorluma-app.jsx:589 so first-time users can try the
 * generation flow without uploading a real donor list.
 */

import type { DonorContext } from "@/lib/outreach/prompt";

export type SampleDonor = DonorContext & {
  /** Stable id used by the client to track selection. */
  id: string;
};

export const SAMPLE_DONORS: SampleDonor[] = [
  {
    id: "sample-margaret-chen",
    name: "Margaret Chen",
    email: "margaret.chen@email.com",
    donorType: "Individual",
    totalGifts: 12,
    totalGiven: 14_500,
    largestGift: 5_000,
    averageGift: 1_208,
    lastGiftLabel: "Jan 2024",
    lapsedMonths: 16,
    reactivationScore: 82,
    tier: "High",
    activeElsewhere: true,
    notes: "Board member emeritus. Passionate about cancer research.",
  },
  {
    id: "sample-robert-torres",
    name: "Robert Torres",
    email: "robert.torres@email.com",
    donorType: "Individual",
    totalGifts: 8,
    totalGiven: 9_200,
    largestGift: 2_500,
    averageGift: 1_150,
    lastGiftLabel: "Mar 2024",
    lapsedMonths: 14,
    reactivationScore: 74,
    tier: "Medium",
    activeElsewhere: true,
    notes: "Annual gala attendee. Local business owner.",
  },
  {
    id: "sample-susan-abernathy",
    name: "Susan Abernathy",
    email: "s.abernathy@email.com",
    donorType: "Individual",
    totalGifts: 15,
    totalGiven: 18_000,
    largestGift: 3_000,
    averageGift: 1_200,
    lastGiftLabel: "Jun 2024",
    lapsedMonths: 11,
    reactivationScore: 88,
    tier: "High",
    activeElsewhere: false,
    notes: "Volunteer since 2017. Recently retired teacher.",
  },
  {
    id: "sample-pacific-ventures",
    name: "Pacific Ventures Fund",
    email: "grants@pacificventures.org",
    donorType: "Foundation",
    totalGifts: 4,
    totalGiven: 120_000,
    largestGift: 50_000,
    averageGift: 30_000,
    lastGiftLabel: "Jan 2024",
    lapsedMonths: 16,
    reactivationScore: 65,
    tier: "Medium",
    activeElsewhere: true,
    notes: "Health equity focus. New grant cycle opens Q3.",
  },
];

export function getSampleDonor(id: string): SampleDonor | undefined {
  return SAMPLE_DONORS.find((d) => d.id === id);
}
