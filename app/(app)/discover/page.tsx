import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/with-org";
import { DiscoverClient } from "@/components/discover/discover-client";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const { org } = await getOrgContext();

  const saved = await prisma.prospect.findMany({
    where: { orgId: org.id, ein: { not: null } },
    select: { id: true, ein: true },
  });

  // Map<EIN, prospect.id> for the client to look up "is this saved? what's the id to delete?"
  const savedEntries: [string, string][] = saved.map((p) => [p.ein!, p.id]);

  return <DiscoverClient initialSaved={savedEntries} />;
}
