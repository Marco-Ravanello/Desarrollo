"use client";
import * as React from "react";
import { LayoutDashboard, Users, ShieldAlert, ClipboardList, LogOut, Briefcase } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { GlobalSearch } from "@/components/search/global-search";

export function AppSidebar() {
  const { data: session } = useSession();
  const user = session?.user;

  const navigation = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, color: "text-slate-400" },
    { title: "Registro Único", url: "/people", icon: Users, color: "text-slate-400" },
    { title: "Admin. General", url: "/admin/purchase-orders", icon: Briefcase, color: "text-slate-400" },
  ];

  const socialAreas = [
    { title: "Protección Social", url: "/areas/social", icon: ClipboardList, color: "text-emerald-400" },
    { title: "Niñez y Familia", url: "/areas/ninez", icon: ClipboardList, color: "text-amber-400" },
    { title: "Hábitat y Vivienda", url: "/areas/habitat", icon: ClipboardList, color: "text-blue-400" },
  ];

  return (
    <div className="w-64 h-screen sticky top-0 bg-slate-900 text-white flex flex-col shrink-0 overflow-hidden">
      <div className="p-6 space-y-6">
        <div className="text-2xl font-bold flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-lg shadow-blue-900/20">
            <Briefcase className="h-6 w-6" />
          </div>
          <span className="tracking-tight">MuniGestión</span>
        </div>

        <GlobalSearch />
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        <div className="pb-2">
          <p className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Principal</p>
          {navigation.map((item) => (
            <Link
              key={item.title}
              href={item.url}
              className="flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all group"
            >
              <item.icon className={`h-5 w-5 ${item.color} group-hover:text-white transition-colors`} />
              <span className="text-sm font-medium">{item.title}</span>
            </Link>
          ))}
        </div>

        <div className="pt-4 pb-2">
          <p className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Áreas Sociales</p>
          {socialAreas.map((item) => (
            <Link
              key={item.title}
              href={item.url}
              className="flex items-center gap-3 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all group"
            >
              <item.icon className={`h-5 w-5 ${item.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
              <span className="text-sm font-medium">{item.title}</span>
            </Link>
          ))}

          {(user?.role === "SUPERADMIN" || user?.role === "DIRECCION_GENERAL" || user?.role === "VIOLENCIA_GENERO") && (
            <Link
              href="/areas/violence"
              className="flex items-center gap-3 px-3 py-2 text-red-400/80 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all group mt-1"
            >
              <ShieldAlert className="h-5 w-5" />
              <span className="text-sm font-medium">Violencia de Género</span>
            </Link>
          )}
        </div>
      </nav>

      <div className="border-t border-slate-800 pt-4 mt-auto flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-slate-700 text-slate-200">{user?.name?.[0] || "U"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
          <p className="text-sm font-medium truncate">{user?.name || "Invitado"}</p>
          <p className="text-xs text-slate-500 truncate">{user?.role || "Sin rol"}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => signOut()} className="text-slate-400 hover:text-white">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
