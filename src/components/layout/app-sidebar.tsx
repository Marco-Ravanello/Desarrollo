"use client";
import * as React from "react";
import { LayoutDashboard, Users, ShieldAlert, ClipboardList, LogOut, Briefcase } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";

export function AppSidebar() {
  const { data: session } = useSession();
  const user = session?.user;

  const navigation = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Personas", url: "/people", icon: Users },
    { title: "Administración", url: "/admin/purchase-orders", icon: Briefcase },
  ];

  return (
    <div className="w-64 h-screen bg-slate-900 text-white flex flex-col p-4 shrink-0">
      <div className="text-2xl font-bold mb-8 flex items-center gap-2">
        <div className="bg-blue-600 p-1 rounded text-white">M</div>
        <span>MuniGestión</span>
      </div>

      <nav className="flex-1 space-y-2">
        {navigation.map((item) => (
          <Link key={item.title} href={item.url} className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-md transition-colors">
            <item.icon className="h-5 w-5 text-slate-400" />
            <span>{item.title}</span>
          </Link>
        ))}

        {(user?.role === "SUPERADMIN" || user?.role === "DIRECCION_GENERAL") && (
           <Link href="/areas/violence" className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-md transition-colors text-red-400">
            <ShieldAlert className="h-5 w-5" />
            <span>Violencia de Género</span>
          </Link>
        )}
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
