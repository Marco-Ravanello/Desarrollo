import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      areaId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    areaId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    areaId: string | null;
  }
}
