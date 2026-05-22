import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          console.log(`🔐 Intento de login para: ${credentials.email}`);

          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user) {
            console.warn(`⚠️ Usuario no encontrado: ${credentials.email}`);
            return null;
          }

          if (!user.password) {
            console.warn(`⚠️ Usuario sin contraseña configurada: ${credentials.email}`);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!isPasswordValid) {
            console.warn(`❌ Contraseña inválida para: ${credentials.email}`);
            return null;
          }

          console.log(`✅ Login exitoso: ${user.email} (${user.role})`);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            areaId: user.areaId,
          };
        } catch (error) {
          console.error("🔥 Error crítico en authorize:", error);
          return null;
        }
      },
    }),
  ],
});
