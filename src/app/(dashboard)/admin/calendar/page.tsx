export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UnifiedCalendar } from "@/components/calendar/unified-calendar";
import { PageHeader } from "@/components/layout/page-header";
import { Car, ShoppingBag, CheckSquare, Calendar as CalendarIcon } from "lucide-react";

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

    prisma.task.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            area: { select: { name: true } }
          }
        }
      }
    }).catch(() => []),

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
        description="Tareas, reservas de vehículos y eventos en un mismo calendario. Arrastrá un evento para cambiarle la fecha."
        icon={CalendarIcon}
        actions={
          <>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-bold">
              <Car className="h-3.5 w-3.5" />
              <span>{serializedReservations.length} Móviles en servicio</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>{serializedOrders.length} Entregas de Compras</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold">
              <CheckSquare className="h-3.5 w-3.5" />
              <span>{serializedTasks.length} Tareas Compartidas</span>
            </div>
          </>
        }
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
