"use client";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, Pie, PieChart, Line, LineChart, CartesianGrid } from "recharts";
import { useTheme } from "next-themes";
import { Layers, ShieldCheck, HeartHandshake, Home, Building } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLORS = ['#004a80', '#10b981', '#f5a623', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

interface DashboardChartsProps {
  casesByAreaData: any[];
  poStatusData: any[];
  trendData: any[];
  areas?: any[];
}

export function DashboardCharts({
  casesByAreaData,
  poStatusData,
  trendData,
  areas = []
}: DashboardChartsProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [selectedArea, setSelectedArea] = useState<string>("all");

  const areaTabs = [
    { id: "all", label: "Todas las Áreas", icon: Layers },
    ...(areas.length > 0
      ? areas.map((a) => ({
          id: a.id,
          label: a.name.replace("Dirección de ", "").replace("Coordinación de ", "").trim(),
          icon: a.name.toLowerCase().includes("hábitat") ? Home : a.name.toLowerCase().includes("niñez") ? HeartHandshake : ShieldCheck
        }))
      : casesByAreaData.map((c) => ({
          id: c.name,
          label: c.name.replace("Dirección de ", "").replace("Coordinación de ", "").trim(),
          icon: Building
        })))
  ];

  const filteredCasesData = casesByAreaData.filter((item) => {
    if (selectedArea === "all") return true;
    const targetArea = areas.find(a => a.id === selectedArea);
    if (targetArea) {
      return item.name === targetArea.name;
    }
    return item.name === selectedArea;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-card/60 backdrop-blur-md border border-white/[0.06] shadow-sm">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3">Filtrar por Área:</span>
        {areaTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedArea === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedArea(tab.id)}
              className={`h-8 text-xs font-semibold rounded-xl transition-all duration-200 gap-1.5 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </Button>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-card/50 backdrop-blur-sm p-6 rounded-3xl border border-border/50 shadow-sm col-span-full lg:col-span-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6">Tendencia de Casos (Últimos 6 Meses)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#e2e8f0'} />
                <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} dy={10} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', borderRadius: '12px', border: isDark ? '1px solid #1e293b' : 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', color: isDark ? '#f8fafc' : '#0f172a' }} />
                <Line type="monotone" dataKey="casos" stroke="#004a80" strokeWidth={4} dot={{ r: 4, fill: '#004a80', strokeWidth: 2, stroke: isDark ? '#0f172a' : '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-sm p-6 rounded-3xl border border-border/50 shadow-sm">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6">Casos por Área</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredCasesData.length > 0 ? filteredCasesData : casesByAreaData}>
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                <Tooltip cursor={{fill: isDark ? '#1e293b' : '#f8fafc'}} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', borderRadius: '8px', border: isDark ? '1px solid #1e293b' : 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', color: isDark ? '#f8fafc' : '#0f172a' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                  {(filteredCasesData.length > 0 ? filteredCasesData : casesByAreaData).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-sm p-6 rounded-3xl border border-border/50 shadow-sm">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6">Órdenes de Compra</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={poStatusData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={8} dataKey="value" stroke="none">
                  {poStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', borderRadius: '8px', border: isDark ? '1px solid #1e293b' : 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', color: isDark ? '#f8fafc' : '#0f172a' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
