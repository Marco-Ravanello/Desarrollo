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

  // Create Sample Providers
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
