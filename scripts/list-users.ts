import { prisma } from "@/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      createdAt: true,
      orgs: {
        select: { orgId: true, role: true, org: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Total users: ${users.length}\n`);
  for (const u of users) {
    console.log(
      `• ${u.email}  (${u.name ?? "no name"})  hasPwd=${!!u.passwordHash}  orgs=${u.orgs.length}`,
    );
    for (const ou of u.orgs) {
      console.log(`    - ${ou.org.name} (${ou.role})`);
    }
    console.log(`    created: ${u.createdAt.toISOString()}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
