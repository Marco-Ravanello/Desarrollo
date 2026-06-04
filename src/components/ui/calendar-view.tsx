"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, User, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
export function VehicleCalendar({ reservations }: { reservations: any[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) { days.push(<div key={`empty-${i}`} className="h-32 border bg-slate-50/50 dark:bg-slate-900/20" />); }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
    const dayReservations = (reservations || []).filter(r => {
      const start = new Date(r.startDate); const end = new Date(r.endDate);
      const checkDate = new Date(date); checkDate.setHours(0,0,0,0);
      const checkEnd = new Date(date); checkEnd.setHours(23,59,59,999);
      return start <= checkEnd && end >= checkDate;
    });
    days.push(
      <div key={d} className="h-32 border p-1 overflow-y-auto bg-card relative group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
        <span className="text-[10px] font-bold text-slate-400 mb-1 block px-1">{d}</span>
        <div className="space-y-1">
          {dayReservations.map(r => (
            <div key={r.id} className="text-[9px] p-1 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 leading-tight">
              <div className="font-bold truncate">{r.vehicle.plate}</div>
              <div className="flex items-center gap-0.5 truncate opacity-80"><User className="h-2 w-2" /> {r.user.name}</div>
              <div className="flex items-center gap-0.5 truncate opacity-80"><Briefcase className="h-2 w-2" /> {r.user.area?.name || 'S/A'}</div>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="absolute bottom-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
          <Link href={`/admin/vehicles/reserve?date=${date.toISOString().split('T')[0]}`}><Clock className="h-3 w-3" /></Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
        <h3 className="font-bold text-lg">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
        <div className="flex gap-1"><Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="h-8">Hoy</Button><Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button></div>
      </div>
      <div className="grid grid-cols-7 text-center border-b bg-slate-50 dark:bg-slate-900/20">{["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(d => (<div key={d} className="py-2 text-[10px] font-bold text-slate-400 uppercase">{d}</div>))}</div>
      <div className="grid grid-cols-7">{days}</div>
    </div>
  );
}
