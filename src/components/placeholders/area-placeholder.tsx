import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ClipboardList, Users, AlertCircle } from "lucide-react";

export default function AreaPlaceholder({ title, description }: { title: string, description: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">{title}</h2>
        <p className="text-slate-500">{description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-50 border-dashed border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Casos Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-dashed border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Users className="h-4 w-4" /> Intervenciones este mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-dashed border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
        <div className="bg-slate-100 p-4 rounded-full mb-4">
          <ClipboardList className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">Módulo en construcción</h3>
        <p className="text-slate-500 max-w-xs mx-auto">
          Estamos preparando las herramientas específicas para el área de {title}.
        </p>
      </Card>
    </div>
  );
}
