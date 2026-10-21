import { DefaultSession } from "next-auth";
import { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      areaId: string | null;
      /** La contraseña la puso un administrador: hay que cambiarla antes de seguir. */
      mustChangePassword?: boolean;
      /** Nombre con el que ingresa. */
      username?: string | null;
    } & DefaultSession["user"]
  }

  interface User {
    role: Role;
    areaId: string | null;
    mustChangePassword?: boolean;
    username?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    areaId: string | null;
    mustChangePassword?: boolean;
    username?: string | null;
  }
}
