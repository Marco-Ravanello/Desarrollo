import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { canAccessPath } from "@/lib/permissions";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith("/login");

      if (nextUrl.pathname.startsWith("/api/")) {
        if (!isLoggedIn) {
          return Response.json({ error: "No autorizado. Inicie sesión." }, { status: 401 });
        }
      }

      if (isAuthPage) {
        if (isLoggedIn) {
          // In Colab/Tunnel, nextUrl might sometimes have a localhost base when we want the tunnel URL.
          // Using a relative path for the redirect is often safer with Auth.js v5 middleware.
          return Response.redirect(new URL("/dashboard", nextUrl.origin));
        }
        return true;
      }

      if (!isLoggedIn) return false;

      // Pantallas restringidas por rol: aunque se escriba la URL a mano, se vuelve al inicio.
      if (!canAccessPath((auth?.user as any)?.role, nextUrl.pathname)) {
        const url = new URL("/dashboard", nextUrl.origin);
        url.searchParams.set("sin-permiso", "1");
        return Response.redirect(url);
      }

      return true;
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
