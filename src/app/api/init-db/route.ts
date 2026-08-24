import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
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

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@municipio.gob.ar',
        name: 'Administrador General',
        password: hashedPassword,
        role: 'ADMIN_GENERAL',
        areaId: adminArea?.id,
      },
    });

    const providers = [
      { name: 'Distribuidora Alimentos S.A.', cuit: '30-12345678-9', bank: 'Banco Nación', cbu: '0110123456789012345678' },
      { name: 'Papelera Municipal', cuit: '20-87654321-0', bank: 'Banco Provincia', cbu: '0140123456789012345678' },
      { name: 'Insumos Médicos S.R.L.', cuit: '33-11223344-5', bank: 'Banco Galicia', cbu: '0070123456789012345678' },
    ];

    for (const provider of providers) {
      await prisma.provider.upsert({
        where: { cuit: provider.cuit },
        update: {},
        create: provider,
      });
    }

    return NextResponse.json({
      success: true,
      message: "¡Base de datos inicializada con éxito!",
      adminUser: adminUser.email,
      defaultPassword: "admin123",
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
