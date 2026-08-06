import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const provider = await prisma.provider.findFirst();
  const area = await prisma.area.findFirst();
  const user = await prisma.user.findFirst();

  if (!provider || !area || !user) {
    console.error('Missing required data for PO');
    return;
  }

  const order = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'OC-2026-001',
      expediente: 'EXP-123/2026',
      providerId: provider.id,
      providerName: provider.name,
      providerCuit: provider.cuit,
      areaId: area.id,
      amount: 1500.50,
      status: 'PENDIENTE',
      items: {
        create: [
          {
            description: 'Resma de papel A4 75gr - Caja x 5 resmas de alta calidad para oficina central',
            quantity: 10,
            unitPrice: 100.00,
            totalPrice: 1000.00
          },
          {
            description: 'Toner para impresora Laser Jet Pro M404n original HP color negro',
            quantity: 2,
            unitPrice: 250.25,
            totalPrice: 500.50
          }
        ]
      }
    }
  });

  console.log('Created PO ID:', order.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
