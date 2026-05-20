import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create Areas
  const areas = [
    { name: 'Administración' },
    { name: 'Protección Social' },
    { name: 'Niñez, Adolescencia y Familia' },
    { name: 'Hábitat y Vivienda' },
    { name: 'Violencia de Género' },
  ];

  for (const area of areas) {
    await prisma.area.upsert({
      where: { name: area.name },
      update: {},
      create: area,
    });
  }

  const adminArea = await prisma.area.findUnique({ where: { name: 'Administración' } });

  // Create Admin User
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@municipio.gob.ar' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'admin@municipio.gob.ar',
      name: 'Administrador General',
      password: hashedPassword,
      role: 'ADMIN_GENERAL',
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
