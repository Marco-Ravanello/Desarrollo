import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create Areas with NEW official names
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

  const adminArea = await prisma.area.findUnique({ where: { name: 'Dirección General de Desarrollo Humano y Hábitat' } });

  // Usuario administrador inicial. Solo se crea si no existe: si ya está,
  // el seed no le toca la clave ni el rol (antes la reseteaba a una clave conocida).
  const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@municipio.gob.ar' } });
  if (!existingAdmin) {
    const initialPassword = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString('base64url');
    await prisma.user.create({
      data: {
        email: 'admin@municipio.gob.ar',
        name: 'Administrador General',
        password: await bcrypt.hash(initialPassword, 10),
        role: 'SUPERADMIN',
        areaId: adminArea?.id,
      },
    });
    if (process.env.SEED_ADMIN_PASSWORD) {
      console.log('👤 Admin creado: admin@municipio.gob.ar (clave tomada de SEED_ADMIN_PASSWORD)');
    } else {
      console.log(`👤 Admin creado: admin@municipio.gob.ar · clave inicial: ${initialPassword} (cambiala al entrar)`);
    }
  } else {
    console.log('👤 El admin ya existe: no se modifica su clave.');
  }

  console.log('✅ Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
