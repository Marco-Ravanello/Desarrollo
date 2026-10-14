import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Package, Car, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";

export default function AdminPlaceholder({ title, description }: { title: string, description: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} icon={Briefcase} />

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

      <Card className="border-dashed border-border/60 bg-card">
        <EmptyMessage
          className="py-16"
          icon={Briefcase}
          title="Módulo en construcción"
          description={`Próximamente podrá gestionar ${title} desde aquí.`}
        />
      </Card>
    </div>
  );
}
