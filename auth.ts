import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { getPlan } from "@/lib/billing/plans";
import { effectivePlan } from "@/lib/billing/trial";
import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Seat-cap enforcement at login.
     *
     * For each org the signing-in user belongs to, count members
     * ordered by join date. If the user's rank exceeds the org's plan
     * seat limit (effectivePlan accounts for the in-app trial), deny
     * the sign-in and redirect to /login?error=seats_exceeded. This
     * catches the "plan was downgraded after invites were accepted"
     * case while letting the earliest joiners (typically the owner)
     * stay in to fix it.
     *
     * New users (no OrgUser rows yet — e.g. Google OAuth pre-onboarding)
     * always pass; they'll be routed to /onboarding by getOrgContext().
     */
    async signIn({ user }) {
      const id = user?.id;
      console.log("[auth-trace] signIn callback start", { id, email: user?.email });
      if (!id) {
        console.log("[auth-trace] signIn allowed: no user id (new account)");
        return true;
      }

      const memberships = await prisma.orgUser.findMany({
        where: { userId: id },
        include: {
          org: {
            select: {
              plan: true,
              trialEndsAt: true,
            },
          },
        },
      });
      console.log(
        `[auth-trace] signIn: user ${id} has ${memberships.length} org membership(s)`,
      );

      for (const m of memberships) {
        const plan = getPlan(
          effectivePlan(m.org.plan, m.org.trialEndsAt),
        );
        if (plan.limits.seats === null) {
          console.log(
            `[auth-trace] signIn: org ${m.orgId} has unlimited seats, skipping`,
          );
          continue;
        }

        const orderedMembers = await prisma.orgUser.findMany({
          where: { orgId: m.orgId },
          orderBy: { createdAt: "asc" },
          select: { userId: true },
        });
        const rank = orderedMembers.findIndex((om) => om.userId === id) + 1;
        console.log(
          `[auth-trace] signIn: org ${m.orgId} plan=${plan.key} seats=${plan.limits.seats} rank=${rank}`,
        );
        if (rank > 0 && rank > plan.limits.seats) {
          console.warn(
            `[auth-trace] signIn DENIED for seat-cap on org ${m.orgId}`,
          );
          return "/login?error=seats_exceeded";
        }
      }

      console.log(`[auth-trace] signIn ALLOWED for user ${id}`);
      return true;
    },
  },
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) {
          console.warn("[auth-trace] authorize REJECT: zod schema failed", {
            issues: parsed.error.flatten().fieldErrors,
            rawKeys:
              raw && typeof raw === "object" ? Object.keys(raw) : typeof raw,
          });
          return null;
        }

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (!user) {
          console.warn(
            `[auth-trace] authorize REJECT: no user found for email=${normalizedEmail}`,
          );
          return null;
        }
        if (!user.passwordHash) {
          console.warn(
            `[auth-trace] authorize REJECT: user ${user.id} has no passwordHash (likely Google OAuth signup)`,
          );
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          console.warn(
            `[auth-trace] authorize REJECT: bcrypt mismatch for user ${user.id} (${normalizedEmail})`,
          );
          return null;
        }

        console.log(
          `[auth-trace] authorize OK: user ${user.id} (${normalizedEmail})`,
        );
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
});
