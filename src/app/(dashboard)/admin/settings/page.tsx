"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2, Shield, Phone, Globe, MapPin, Save,
  RotateCcw, CheckCircle2, Sliders, Database, Sparkles, User
} from "lucide-react";
import { MunicipalCrest } from "@/components/ui/municipal-crest";

export default function MunicipalSettingsPage() {
  const [activeTab, setActiveTab] = useState<"identity" | "contact" | "security">("identity");
  const [loading, setLoading] = useState(false);

  const [settings, setSettings] = useState({
    municipalityName: "Municipalidad de Gestión Territorial",
    provinceName: "Provincia de Buenos Aires • República Argentina",
    secretariatName: "Secretaría de Desarrollo Humano y Hábitat",
    directionName: "Dirección General de Gestión Social y Hábitat",
    mayorName: "Dr. Ramón Valenzuela (Intendente Municipal)",
    secretaryName: "Lic. Mariana Rossi (Secretaria General)",
    mainPhone: "0800-888-MUNI (6864)",
    emergencyPhone: "Línea 103 (Defensa Civil)",
    officialEmail: "desarrollohumano@municipio.gob.ar",
    officialWebsite: "https://www.municipio.gob.ar",
    headquartersAddress: "Av. San Martín 1500, Palacio Municipal",
    sessionTimeout: "8",
    aiAnonymization: true,
    maintenanceMode: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem("muni-system-settings");
    if (saved) {
      try {
        setSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {}
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem("muni-system-settings", JSON.stringify(settings));
      window.dispatchEvent(new Event("muni-settings-updated"));
      setLoading(false);
      toast.success("Configuración Municipal guardada correctamente", {
        description: "Los cambios se aplicaron a los encabezados, reportes y pantalla de acceso."
      });
    }, 400);
  };

  const handleReset = () => {
    localStorage.removeItem("muni-system-settings");
    window.location.reload();
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
            Configuración Municipal
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Personalización de identidad institucional, autoridades, contactos y parámetros del sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            className="rounded-2xl h-11 px-4 text-xs font-bold border-border/60"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Restaurar Predeterminados
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="rounded-2xl h-11 px-5 font-bold text-xs uppercase tracking-wider bg-primary text-primary-foreground shadow-lg shadow-primary/20"
          >
            <Save className="mr-2 h-4 w-4" /> {loading ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/50 max-w-xl">
        <button
          onClick={() => setActiveTab("identity")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === "identity"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Identidad Institucional</span>
        </button>
        <button
          onClick={() => setActiveTab("contact")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === "contact"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Phone className="h-4 w-4" />
          <span>Contacto y Enlaces</span>
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === "security"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Seguridad y Servidor</span>
        </button>
      </div>

      {activeTab === "identity" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          <Card className="lg:col-span-2 rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-6">
            <div>
              <h3 className="text-base font-black text-foreground">Datos del Distrito y Dependencia</h3>
              <p className="text-xs text-muted-foreground font-medium">
                Esta información figurará en el encabezado oficial, login y documentos PDF descargables.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Nombre del Municipio / Distrito</Label>
                  <Input
                    value={settings.municipalityName}
                    onChange={(e) => setSettings({ ...settings, municipalityName: e.target.value })}
                    className="rounded-xl h-11 text-xs"
                    placeholder="Ej: Municipalidad de Morón"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Provincia / Jurisdicción</Label>
                  <Input
                    value={settings.provinceName}
                    onChange={(e) => setSettings({ ...settings, provinceName: e.target.value })}
                    className="rounded-xl h-11 text-xs"
                    placeholder="Ej: Provincia de Buenos Aires"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Secretaría a Cargo</Label>
                  <Input
                    value={settings.secretariatName}
                    onChange={(e) => setSettings({ ...settings, secretariatName: e.target.value })}
                    className="rounded-xl h-11 text-xs"
                    placeholder="Ej: Secretaría de Desarrollo Humano y Hábitat"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Dirección General</Label>
                  <Input
                    value={settings.directionName}
                    onChange={(e) => setSettings({ ...settings, directionName: e.target.value })}
                    className="rounded-xl h-11 text-xs"
                    placeholder="Ej: Dirección General de Gestión Social"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Intendente / Jefe Comunal</Label>
                  <Input
                    value={settings.mayorName}
                    onChange={(e) => setSettings({ ...settings, mayorName: e.target.value })}
                    className="rounded-xl h-11 text-xs"
                    placeholder="Ej: Dr. Ramón Valenzuela"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Secretario / Autoridad de Firma</Label>
                  <Input
                    value={settings.secretaryName}
                    onChange={(e) => setSettings({ ...settings, secretaryName: e.target.value })}
                    className="rounded-xl h-11 text-xs"
                    placeholder="Ej: Lic. Mariana Rossi"
                  />
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Vista Previa Institucional</h3>
            <Card className="rounded-3xl border-border/60 shadow-sm bg-muted/20 p-6 space-y-4 text-center">
              <div className="mx-auto p-3 bg-primary/10 rounded-2xl border border-primary/20 w-fit">
                <MunicipalCrest className="h-14 w-14" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  {settings.provinceName}
                </p>
                <h4 className="text-lg font-black text-foreground tracking-tight mt-1">
                  {settings.municipalityName}
                </h4>
                <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                  {settings.secretariatName}
                </p>
              </div>

              <div className="pt-3 border-t border-border/40 text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Intendente:</span>
                  <span className="font-bold text-foreground">{settings.mayorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Secretaría:</span>
                  <span className="font-bold text-foreground">{settings.secretaryName}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "contact" && (
        <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-6 max-w-3xl animate-in fade-in duration-300">
          <div>
            <h3 className="text-base font-black text-foreground">Canales Oficiales y Mesa de Entradas</h3>
            <p className="text-xs text-muted-foreground font-medium">
              Teléfonos de contacto y sedes para orientación del ciudadano.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" /> Teléfono Conmutador Municipal
                </Label>
                <Input
                  value={settings.mainPhone}
                  onChange={(e) => setSettings({ ...settings, mainPhone: e.target.value })}
                  className="rounded-xl h-11 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-rose-500" /> Línea de Emergencias / Defensa Civil
                </Label>
                <Input
                  value={settings.emergencyPhone}
                  onChange={(e) => setSettings({ ...settings, emergencyPhone: e.target.value })}
                  className="rounded-xl h-11 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-blue-500" /> Correo Electrónico Institucional
                </Label>
                <Input
                  value={settings.officialEmail}
                  onChange={(e) => setSettings({ ...settings, officialEmail: e.target.value })}
                  className="rounded-xl h-11 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-emerald-500" /> Portal Web Oficial
                </Label>
                <Input
                  value={settings.officialWebsite}
                  onChange={(e) => setSettings({ ...settings, officialWebsite: e.target.value })}
                  className="rounded-xl h-11 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" /> Domicilio del Palacio Municipal / Sede Central
              </Label>
              <Input
                value={settings.headquartersAddress}
                onChange={(e) => setSettings({ ...settings, headquartersAddress: e.target.value })}
                className="rounded-xl h-11 text-xs"
              />
            </div>
          </div>
        </Card>
      )}

      {activeTab === "security" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
          <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-4">
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-500" /> Estado del Servidor y Base de Datos
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-3 rounded-2xl bg-muted/30">
                <div>
                  <p className="font-bold text-foreground">Motor de Base de Datos</p>
                  <p className="text-[11px] text-muted-foreground">PostgreSQL Cloud (Neon Serverless)</p>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-500 font-bold border-none">Conectado (Online)</Badge>
              </div>

              <div className="flex justify-between items-center p-3 rounded-2xl bg-muted/30">
                <div>
                  <p className="font-bold text-foreground">Hospedaje de Aplicación</p>
                  <p className="text-[11px] text-muted-foreground">Vercel Edge Network (iad1)</p>
                </div>
                <Badge className="bg-blue-500/10 text-blue-500 font-bold border-none">Activo (SSL HTTPS)</Badge>
              </div>

              <div className="flex justify-between items-center p-3 rounded-2xl bg-muted/30">
                <div>
                  <p className="font-bold text-foreground">Motor de Inteligencia Artificial</p>
                  <p className="text-[11px] text-muted-foreground">Google Gemini con RAG Local</p>
                </div>
                <Badge className="bg-purple-500/10 text-purple-500 font-bold border-none">Operativo</Badge>
              </div>
            </div>
          </Card>

          <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-4">
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Políticas de Privacidad y Acceso
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30">
                <div>
                  <p className="text-xs font-bold text-foreground">Anonimización PII de IA Activa</p>
                  <p className="text-[11px] text-muted-foreground">Enmascara DNI y nombres antes de enviar a la nube</p>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-500 font-bold border-none">Habilitado</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30">
                <div>
                  <p className="text-xs font-bold text-foreground">Cierre Automático de Sesión</p>
                  <p className="text-[11px] text-muted-foreground">Expiración por inactividad administrativa</p>
                </div>
                <span className="text-xs font-bold text-foreground">8 Horas</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
