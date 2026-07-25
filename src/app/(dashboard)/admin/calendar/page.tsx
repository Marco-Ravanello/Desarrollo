export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UnifiedCalendar } from "@/components/calendar/unified-calendar";

export default async function AdminCalendarPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 1. Fetch Reservations
  const reservations = await prisma.vehicleReservation.findMany({
    where: {
      status: { in: ["APROBADA", "EN_CURSO", "PENDIENTE"] }
    },
    include: {
      vehicle: {
        select: { plate: true, brand: true, model: true }
      },
      user: {
        select: {
          id: true,
          name: true,
          area: { select: { name: true } }
        }
      }
    }
  });

  // 2. Fetch Purchase Orders
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      status: { in: ["PENDIENTE_APROBACION", "APROBADA"] }
    }
  });

  // 3. Fetch Tasks
  const tasks = await prisma.task.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          area: { select: { name: true } }
        }
      }
    }
  });

  // 4. Fetch Users (to allow inviting viewers)
  const users = await prisma.user.findMany({
    include: {
      area: { select: { name: true } }
    },
    orderBy: { name: "asc" }
  });

  // Sanitize non-serializable decimals/dates to keep React 19/Next 15 happy!
  const serializedReservations = reservations.map(r => ({
    ...r,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString()
  }));

  const serializedOrders = purchaseOrders.map(o => ({
    ...o,
    amount: Number(o.amount),
    deliveryDate: o.deliveryDate ? o.deliveryDate.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString()
  }));

  const serializedTasks = tasks.map(t => ({
    ...t,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    createdAt: t.createdAt.toISOString()
  }));

  const serializedUsers = users.map(u => ({
    id: u.id,
    name: u.name,
    area: u.area ? { name: u.area.name } : null
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-foreground">Agenda de Logística y Tareas</h2>
          <p className="text-muted-foreground">Calendario unificado e interactivo de reservas, entregas de compras y tareas compartidas.</p>
        </div>
      </div>

      <UnifiedCalendar
        reservations={serializedReservations}
        purchaseOrders={serializedOrders}
        tasks={serializedTasks}
        users={serializedUsers}
        currentUserId={session.user.id}
      />
    </div>
  );
}
