import NextAuth, { CredentialsSignin } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { isAccountLocked, logLogin } from "@/services/login-security";

// Cada cuánto se vuelve a consultar la base para confirmar que la cuenta sigue activa.
const ACCOUNT_RECHECK_MS = 5 * 60 * 1000;

class AccountLockedError extends CredentialsSignin {
  code = "bloqueada";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params: any) {
      const token = await authConfig.callbacks.jwt(params);
      if (params.user) {
        token.checkedAt = Date.now();
        return token;
      }
      if (!token?.sub) return token;

      // Mientras tenga que cambiar la contraseña se consulta la base en cada pedido, así el cambio
      // se nota enseguida. Después de cambiarla la pantalla también pide actualizar la sesión ("update").
      const checkedAt = typeof token.checkedAt === "number" ? token.checkedAt : 0;
      const recent = Date.now() - checkedAt < ACCOUNT_RECHECK_MS;
      if (params.trigger !== "update" && !token.mustChangePassword && recent) return token;

      // Cierra la sesión de cuentas suspendidas o eliminadas y toma cambios de rol o área.
      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { isActive: true, role: true, areaId: true, mustChangePassword: true },
      });
      if (!dbUser || dbUser.isActive === false) return null;

      token.role = dbUser.role;
      token.areaId = dbUser.areaId;
      token.mustChangePassword = dbUser.mustChangePassword;
      token.checkedAt = Date.now();
      return token;
    },
  },
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

          
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user) {
            console.warn("⚠️ Login rechazado: usuario no encontrado");
            return null;
          }

          if (!user.password) {
            console.warn("⚠️ Login rechazado: usuario sin contraseña configurada");
            return null;
          }

          if (await isAccountLocked(user.id)) {
            console.warn(`🔒 Login rechazado: cuenta bloqueada por intentos fallidos (id ${user.id})`);
            throw new AccountLockedError();
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!isPasswordValid) {
            console.warn("❌ Login rechazado: contraseña inválida");
            await logLogin(user.id, "LOGIN_FAILED", "Contraseña incorrecta");
            return null;
          }

          if (user.isActive === false) {
            console.warn(`⛔ Login rechazado: cuenta suspendida (id ${user.id})`);
            return null;
          }

          console.log(`✅ Login exitoso (id ${user.id}, rol ${user.role})`);
          await logLogin(user.id, "LOGIN", "Ingreso al sistema");

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            areaId: user.areaId,
            mustChangePassword: user.mustChangePassword,
          };
        } catch (error) {
          if (error instanceof AccountLockedError) throw error;
          console.error("🔥 Error crítico en authorize:", error);
          return null;
        }
      },
    }),
  ],
});
