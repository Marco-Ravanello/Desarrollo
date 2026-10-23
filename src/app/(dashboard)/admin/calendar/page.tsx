export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UnifiedCalendar } from "@/components/calendar/unified-calendar";
import { PageHeader } from "@/components/layout/page-header";
import { getAgendaTasks } from "@/services/agenda";
import { Calendar as CalendarIcon } from "lucide-react";

export const metadata = { title: "Agenda" };

export default async function AdminCalendarPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch all calendar datasets concurrently with error resilience
  const [reservations, purchaseOrders, tasks, users] = await Promise.all([
    prisma.vehicleReservation.findMany({
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
    }).catch(() => []),

    prisma.purchaseOrder.findMany({
      where: {
        status: { in: ["PENDIENTE_APROBACION", "APROBADA"] }
      }
    }).catch(() => []),

    getAgendaTasks(session.user.id).catch(() => []),

    prisma.user.findMany({
      include: {
        area: { select: { name: true } }
      },
      orderBy: { name: "asc" }
    }).catch(() => [])
  ]);

  const serializedReservations = (reservations || []).map((r) => ({
    ...r,
    startDate: r.startDate ? new Date(r.startDate).toISOString() : new Date().toISOString(),
    endDate: r.endDate ? new Date(r.endDate).toISOString() : new Date().toISOString(),
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString()
  }));

  const serializedOrders = (purchaseOrders || []).map((o) => ({
    ...o,
    amount: Number(o.amount || 0),
    deliveryDate: o.deliveryDate ? new Date(o.deliveryDate).toISOString() : null,
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: o.updatedAt ? new Date(o.updatedAt).toISOString() : new Date().toISOString()
  }));

  const serializedTasks = (tasks || []).map((t) => ({
    ...t,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString()
  }));

  const serializedUsers = (users || []).map((u) => ({
    id: u.id,
    name: u.name,
    area: u.area ? { name: u.area.name } : null
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <PageHeader
        title="Agenda"
        description={
          <>
            Reservas de vehículos, entregas de órdenes de compra y tus tareas en un mismo calendario.
            <span className="hidden lg:inline"> Arrastrá un evento para cambiarle la fecha.</span>
          </>
        }
        icon={CalendarIcon}
      />

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
