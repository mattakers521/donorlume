import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAuthed = !!auth?.user;
      const isOnAuthPages =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/signup");

      if (isOnAuthPages) {
        if (isAuthed) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      const isProtected =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/discover") ||
        nextUrl.pathname.startsWith("/lapsed") ||
        nextUrl.pathname.startsWith("/outreach") ||
        nextUrl.pathname.startsWith("/donors") ||
        nextUrl.pathname.startsWith("/reports") ||
        nextUrl.pathname.startsWith("/settings") ||
        nextUrl.pathname.startsWith("/onboarding") ||
        nextUrl.pathname.startsWith("/celebrate");

      if (isProtected && !isAuthed) return false;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
