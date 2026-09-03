import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Package, Car, Users } from "lucide-react";
import Link from "next/link";

export default function AdminPlaceholder({ title, description }: { title: string, description: string }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
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
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer border border-border/60 bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-foreground">{tab.label}</CardTitle>
                <tab.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed border-border/60 bg-card">
        <div className="bg-muted/40 p-4 rounded-full mb-4">
          <Briefcase className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Módulo en construcción</h3>
        <p className="text-muted-foreground max-w-xs mx-auto">
          Próximamente podrá gestionar {title} desde aquí.
        </p>
      </Card>
    </div>
  );
}
