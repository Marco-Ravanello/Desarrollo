export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UnifiedCalendar } from "@/components/calendar/unified-calendar";
import { Badge } from "@/components/ui/badge";
import { Car, ShoppingBag, CheckSquare, Calendar as CalendarIcon } from "lucide-react";

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

  // 4. Fetch Users
  const users = await prisma.user.findMany({
    include: {
      area: { select: { name: true } }
    },
    orderBy: { name: "asc" }
  });

  const serializedReservations = reservations.map((r) => ({
    ...r,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString()
  }));

  const serializedOrders = purchaseOrders.map((o) => ({
    ...o,
    amount: Number(o.amount),
    deliveryDate: o.deliveryDate ? o.deliveryDate.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString()
  }));

  const serializedTasks = tasks.map((t) => ({
    ...t,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    createdAt: t.createdAt.toISOString()
  }));

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    area: u.area ? { name: u.area.name } : null
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-primary/10 text-primary border border-primary/20 rounded-2xl">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
                Agenda Unificada de Logística y Tareas
                <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase py-0.5">
                  Planificación 3F
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Calendario interactivo con vista semanal/diaria, capas operativas, arrastrar y soltar (drag & drop) y mini mapa mensual.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-bold">
            <Car className="h-3.5 w-3.5" />
            <span>{reservations.length} Móviles en servicio</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold">
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>{purchaseOrders.length} Entregas de Compras</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold">
            <CheckSquare className="h-3.5 w-3.5" />
            <span>{tasks.length} Tareas Compartidas</span>
          </div>
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
