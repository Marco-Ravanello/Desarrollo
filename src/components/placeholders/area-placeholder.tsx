import { Card } from "@/components/ui/card";
import { ClipboardList, Users, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyMessage } from "@/components/ui/empty-message";

export default function AreaPlaceholder({ title, description }: { title: string, description: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} icon={ClipboardList} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Casos Activos" value={0} icon={ClipboardList} tone="blue" />
        <StatCard label="Intervenciones este mes" value={0} icon={Users} tone="purple" />
        <StatCard label="Pendientes" value={0} icon={AlertCircle} tone="orange" />
      </div>

      <Card className="border-dashed border-border/60 bg-card">
        <EmptyMessage
          className="py-16"
          icon={ClipboardList}
          title="Módulo en construcción"
          description={`Estamos preparando las herramientas específicas para el área de ${title}.`}
        />
      </Card>
    </div>
  );
}
