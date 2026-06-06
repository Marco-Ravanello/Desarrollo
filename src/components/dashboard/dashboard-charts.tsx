"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, Pie, PieChart } from "recharts";
import { useTheme } from "next-themes";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function DashboardCharts({ casesByAreaData, poStatusData }: { casesByAreaData: any[], poStatusData: any[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">Casos por Área</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={casesByAreaData}>
              <XAxis
                dataKey="name"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tick={{ fill: isDark ? '#94a3b8' : '#64748b' }}
              />
              <YAxis
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tick={{ fill: isDark ? '#94a3b8' : '#64748b' }}
              />
              <Tooltip
                cursor={{fill: isDark ? '#1e293b' : '#f8fafc'}}
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #1e293b' : 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  color: isDark ? '#f8fafc' : '#0f172a'
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {casesByAreaData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">Órdenes de Compra</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={poStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {poStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #1e293b' : 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  color: isDark ? '#f8fafc' : '#0f172a'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
