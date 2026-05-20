import { redirect } from "next/navigation";

import { auth } from "@/auth";

/**
 * Single admin email — hardcoded so a database compromise can't grant
 * admin via a `is_admin` row flip. Move to an env-var allowlist (with
 * multiple operators) if the team ever grows.
 *
 * Matched case-insensitively + whitespace-trimmed because email
 * canonicalization elsewhere in the app stores everything lowercase,
 * but a session.user.email could theoretically arrive with mixed
 * casing depending on how the OAuth provider returned it.
 */
export const ADMIN_EMAIL = "matt.akers@vibrantcauses.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

/**
 * Server-side gate for /admin routes. Resolves the session and
 * redirects to /dashboard if the caller isn't the admin. Returns the
 * resolved session.user when admin — typed so the caller can use
 * `.email` etc. without optional chaining.
 *
 * Used by every /admin server component AND by /api/admin/* route
 * handlers so the policy is enforced in one place.
 */
export async function requireAdmin(): Promise<{
  email: string;
  id: string;
  name: string | null;
}> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!isAdminEmail(email)) {
    redirect("/dashboard");
  }
  // Narrow types — once isAdminEmail passes, email is non-null and the
  // user record must have an id (NextAuth's session.user always does
  // once authenticated).
  return {
    email: email!,
    id: session!.user!.id,
    name: session!.user!.name ?? null,
  };
}
