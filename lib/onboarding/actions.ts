"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Marks the caller's user account as having dismissed the dashboard
 * onboarding checklist. One-way flip — the UI never re-shows the
 * checklist once this is true. Re-arming would require a manual UPDATE
 * (or a future "reset" affordance in /settings).
 *
 * Returns nothing on success — callers should let the page re-render
 * via revalidatePath("/dashboard"). Silently no-ops if the session is
 * missing; the page guard already redirects unauthed users.
 */
export async function dismissOnboarding(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { dismissedOnboarding: true },
  });

  revalidatePath("/dashboard");
}
