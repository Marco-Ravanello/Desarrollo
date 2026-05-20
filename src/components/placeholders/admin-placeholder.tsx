import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Package, Car, Users } from "lucide-react";
import Link from "next/link";

export default function AdminPlaceholder({ title, description }: { title: string, description: string }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">{title}</h2>
          <p className="text-slate-500">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Órdenes", href: "/admin/purchase-orders", icon: Briefcase },
          { label: "Vehículos", href: "/admin/vehicles", icon: Car },
          { label: "Proveedores", href: "/admin/providers", icon: Users },
          { label: "Insumos/Stock", href: "/admin/stock", icon: Package },
        ].map((tab) => (
          <Link key={tab.label} href={tab.href}>
            <Card className="hover:bg-slate-50 transition-colors cursor-pointer border-2 hover:border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">{tab.label}</CardTitle>
                <tab.icon className="h-4 w-4 text-slate-400" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
        <div className="bg-slate-100 p-4 rounded-full mb-4">
          <Briefcase className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">Módulo en construcción</h3>
        <p className="text-slate-500 max-w-xs mx-auto">
          Próximamente podrá gestionar {title} desde aquí.
        </p>
      </Card>
    </div>
  );
}
