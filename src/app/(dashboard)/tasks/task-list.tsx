"use client";
import { useState } from "react";
import { CheckCircle2, Circle, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { addTaskAction, toggleTaskAction, deleteTaskAction } from "./actions";
export function TaskList({ initialTasks, userId }: { initialTasks: any[], userId: string }) {
  const [newTask, setNewTask] = useState("");
  const handleAdd = async (e: React.FormEvent) => { e.preventDefault(); if (!newTask.trim()) return; await addTaskAction(userId, newTask); setNewTask(""); };
  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2"><Input placeholder="¿Qué hay que hacer hoy?..." value={newTask} onChange={(e) => setNewTask(e.target.value)} className="flex-1" /><Button type="submit"><Plus className="h-4 w-4 mr-2" /> Agregar</Button></form>
      <div className="space-y-2">
        {initialTasks.length === 0 ? <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-xl">No hay tareas pendientes.</div> :
          initialTasks.map((t) => (
            <Card key={t.id} className={`transition-all ${t.status === 'COMPLETADA' ? "opacity-50" : ""}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3"><button onClick={() => toggleTaskAction(t.id, t.status)}>{t.status === 'COMPLETADA' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-slate-300" />}</button><span className={`text-sm ${t.status === 'COMPLETADA' ? "line-through text-slate-500" : ""}`}>{t.title}</span></div>
                <Button variant="ghost" size="icon" onClick={() => deleteTaskAction(t.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
