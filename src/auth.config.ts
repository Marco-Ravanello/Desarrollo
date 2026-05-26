import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith("/login");

      if (isAuthPage) {
        if (isLoggedIn) {
          // In Colab/Tunnel, nextUrl might sometimes have a localhost base when we want the tunnel URL.
          // Using a relative path for the redirect is often safer with Auth.js v5 middleware.
          return Response.redirect(new URL("/dashboard", nextUrl.origin));
        }
        return true;
      }

      return isLoggedIn;
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
        token.areaId = user.areaId;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.areaId = token.areaId;
      }
      return session;
    },
  },
  providers: [], // Add empty providers to satisfy type, will be populated in auth.ts
} satisfies NextAuthConfig;
