import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const initSecretHeader = request.headers.get("x-init-secret");
    const session = await auth();

    const isSecretValid = Boolean(
      process.env.INIT_DB_SECRET &&
      initSecretHeader &&
      initSecretHeader === process.env.INIT_DB_SECRET
    );

    const isSuperAdmin = session?.user?.role === "SUPERADMIN";

    if (!isSecretValid && !isSuperAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@municipio.gob.ar' },
    });

    if (existingAdmin) {
      return NextResponse.json({
        success: false,
        error: "La base de datos ya se encuentra inicializada. El usuario administrador ya existe.",
      }, { status: 400 });
    }

    const areas = [
      { name: 'Dirección General de Desarrollo Humano y Hábitat' },
      { name: 'Dirección de Protección Social' },
      { name: 'Dirección de Niñez, Adolescencia y Familia' },
      { name: 'Dirección de Hábitat, Vivienda y Regularización Dominial' },
      { name: 'Coordinación de Asistencia y Protección a Mujeres Víctimas de Violencia' },
      { name: 'Coordinación Centro de Formación' },
    ];

    for (const area of areas) {
      await prisma.area.upsert({
        where: { name: area.name },
        update: {},
        create: area,
      });
    }

    const adminArea = await prisma.area.findUnique({
      where: { name: 'Dirección General de Desarrollo Humano y Hábitat' }
    });

    // Clave inicial aleatoria (o la de INIT_ADMIN_PASSWORD): nunca una clave fija conocida.
    const initialPassword = process.env.INIT_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
    const hashedPassword = await bcrypt.hash(initialPassword, 10);

    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@municipio.gob.ar',
        name: 'Administrador General',
        password: hashedPassword,
        role: 'SUPERADMIN',
        areaId: adminArea?.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "¡Base de datos inicializada con éxito!",
      adminUser: adminUser.email,
      // Se muestra una sola vez; hay que cambiarla al entrar.
      ...(process.env.INIT_ADMIN_PASSWORD ? {} : { initialPassword }),
      areasCount: areas.length,
    });
  } catch (error: any) {
    console.error("Error al inicializar la base de datos:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Error al inicializar la base de datos",
    }, { status: 500 });
  }
}
