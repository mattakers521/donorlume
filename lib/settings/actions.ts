"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Ok = { ok: true; message?: string };
type Err = { ok: false; error: string };
type Result = Ok | Err;

async function requireSession(): Promise<{ userId: string } | null> {
  const s = await auth();
  if (!s?.user?.id) return null;
  return { userId: s.user.id };
}

async function requireOrgUser(): Promise<
  { userId: string; orgId: string; role: string } | null
> {
  const session = await requireSession();
  if (!session) return null;
  const orgUser = await prisma.orgUser.findFirst({
    where: { userId: session.userId },
    select: { orgId: true, role: true },
  });
  if (!orgUser) return null;
  return { userId: session.userId, orgId: orgUser.orgId, role: orgUser.role };
}

// ─── /settings/organization ────────────────────────────────────────────

const orgSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  mission: z.string().trim().max(2000).optional().nullable(),
  causeArea: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  website: z.string().trim().max(300).optional().nullable(),
  logo: z.string().trim().max(500).optional().nullable(),
});

export async function updateOrganization(formData: FormData): Promise<Result> {
  const ctx = await requireOrgUser();
  if (!ctx) return { ok: false, error: "Sign in required." };

  const parsed = orgSchema.safeParse({
    name: formData.get("name"),
    mission: formData.get("mission"),
    causeArea: formData.get("causeArea"),
    address: formData.get("address"),
    website: formData.get("website"),
    logo: formData.get("logo"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Validation failed — check the form.",
    };
  }

  const d = parsed.data;
  await prisma.organization.update({
    where: { id: ctx.orgId },
    data: {
      name: d.name,
      mission: d.mission || null,
      causeArea: d.causeArea || null,
      address: d.address || null,
      website: d.website || null,
      logo: d.logo || null,
    },
  });

  revalidatePath("/settings/organization");
  revalidatePath("/dashboard");
  return { ok: true, message: "Organization profile updated." };
}

// ─── /settings/preferences (legacy /settings) ──────────────────────────

const prefsSchema = z.object({
  lapsedThresholdMonths: z.coerce.number().int().min(1).max(120),
  defaultTone: z.string().trim().min(1).max(40),
  defaultEmailType: z.string().trim().min(1).max(40),
  senderName: z.string().trim().max(120).optional().nullable(),
  senderTitle: z.string().trim().max(120).optional().nullable(),
  senderEmail: z.string().trim().max(300).optional().nullable(),
  customInstructions: z.string().trim().max(2000).optional().nullable(),
});

export async function updatePreferences(formData: FormData): Promise<Result> {
  const ctx = await requireOrgUser();
  if (!ctx) return { ok: false, error: "Sign in required." };

  const parsed = prefsSchema.safeParse({
    lapsedThresholdMonths: formData.get("lapsedThresholdMonths"),
    defaultTone: formData.get("defaultTone"),
    defaultEmailType: formData.get("defaultEmailType"),
    senderName: formData.get("senderName"),
    senderTitle: formData.get("senderTitle"),
    senderEmail: formData.get("senderEmail"),
    customInstructions: formData.get("customInstructions"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed.",
    };
  }
  const d = parsed.data;

  await prisma.orgSettings.upsert({
    where: { orgId: ctx.orgId },
    update: {
      lapsedThresholdMonths: d.lapsedThresholdMonths,
      defaultTone: d.defaultTone,
      defaultEmailType: d.defaultEmailType,
      senderName: d.senderName || null,
      senderTitle: d.senderTitle || null,
      senderEmail: d.senderEmail || null,
      customInstructions: d.customInstructions || null,
    },
    create: {
      orgId: ctx.orgId,
      lapsedThresholdMonths: d.lapsedThresholdMonths,
      defaultTone: d.defaultTone,
      defaultEmailType: d.defaultEmailType,
      senderName: d.senderName || null,
      senderTitle: d.senderTitle || null,
      senderEmail: d.senderEmail || null,
      customInstructions: d.customInstructions || null,
    },
  });

  revalidatePath("/settings");
  return { ok: true, message: "Preferences saved." };
}

// ─── /settings/profile ─────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(300)
    .email("Enter a valid email"),
});

export async function updateProfile(formData: FormData): Promise<Result> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed.",
    };
  }
  const { name, email } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // Check email uniqueness only when it actually changed.
  const current = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  if (current && current.email !== normalizedEmail) {
    const collision = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (collision && collision.id !== session.userId) {
      return { ok: false, error: "That email is already in use." };
    }
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { name, email: normalizedEmail },
  });
  revalidatePath("/settings/profile");
  return { ok: true, message: "Profile updated." };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(200),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(200),
});

export async function changePassword(formData: FormData): Promise<Result> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return {
      ok: false,
      error:
        "This account signs in via Google. Add a password through the password-reset flow.",
    };
  }

  const verified = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash,
  );
  if (!verified) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: newHash },
  });
  return { ok: true, message: "Password updated." };
}

const notifSchema = z.object({
  notifyWelcomeEmails: z.string().nullable().optional(),
  notifyGettingStartedNudges: z.string().nullable().optional(),
  notifyCampaignCompletionAlerts: z.string().nullable().optional(),
});

export async function updateNotificationPreferences(
  formData: FormData,
): Promise<Result> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "Sign in required." };

  // Checkboxes only appear in FormData when checked — read presence,
  // not value.
  const parsed = notifSchema.safeParse({
    notifyWelcomeEmails: formData.get("notifyWelcomeEmails"),
    notifyGettingStartedNudges: formData.get("notifyGettingStartedNudges"),
    notifyCampaignCompletionAlerts: formData.get(
      "notifyCampaignCompletionAlerts",
    ),
  });
  if (!parsed.success) {
    return { ok: false, error: "Couldn't parse preferences." };
  }
  const d = parsed.data;

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      notifyWelcomeEmails: d.notifyWelcomeEmails === "on",
      notifyGettingStartedNudges: d.notifyGettingStartedNudges === "on",
      notifyCampaignCompletionAlerts:
        d.notifyCampaignCompletionAlerts === "on",
    },
  });
  revalidatePath("/settings/profile");
  return { ok: true, message: "Notification preferences updated." };
}
