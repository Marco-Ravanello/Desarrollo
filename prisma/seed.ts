import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

  // Create Admin User
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@municipio.gob.ar' },
    update: {
      password: hashedPassword,
      role: 'SUPERADMIN',
    },
    create: {
      email: 'admin@municipio.gob.ar',
      name: 'Administrador General',
      password: hashedPassword,
      role: 'SUPERADMIN',
      areaId: adminArea?.id,
    },
  });

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
