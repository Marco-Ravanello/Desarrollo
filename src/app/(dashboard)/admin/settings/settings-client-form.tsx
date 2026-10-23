"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2, Shield, Phone, Globe, MapPin, Save,
  RotateCcw, Database, Upload, Image as ImageIcon, Trash2, Link as LinkIcon,
  FileText, ExternalLink, Settings, LifeBuoy, Bot, FolderUp, Timer
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MunicipalCrest } from "@/components/ui/municipal-crest";
import { MunicipalLetterhead } from "@/components/ui/municipal-letterhead";
import { PrintButton } from "@/components/ui/print-layout";
import {
  saveSystemSettingsAction,
  resetSystemSettingsAction
} from "@/app/(dashboard)/admin/actions/settings-actions";
import { MunicipalSettings, DEFAULT_MUNICIPAL_SETTINGS } from "@/types/settings";

export interface SystemStatus {
  database: boolean;
  assistant: boolean;
  fileStorage: boolean;
  inactivityMinutes: number;
}

export function MunicipalSettingsClient({
  initialSettings,
  status,
  canEdit
}: {
  initialSettings: MunicipalSettings;
  status: SystemStatus;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"identity" | "contact" | "preview" | "security">("identity");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<MunicipalSettings>(initialSettings || DEFAULT_MUNICIPAL_SETTINGS);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen es muy pesada", {
        description: "Subí una imagen de hasta 2 MB (PNG, JPG o SVG)."
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSettings((prev) => ({ ...prev, customLogoUrl: base64 }));
      toast.success("Logo cargado", {
        description: "Acordate de tocar \"Guardar cambios\" para que se aplique en toda la app."
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({ ...prev, customLogoUrl: "" }));
    toast.info("Se vuelve a usar el escudo de fábrica. Tocá \"Guardar cambios\" para aplicarlo.");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await saveSystemSettingsAction(settings);
      if (!res.success) {
        toast.error("No se pudo guardar la configuración", { description: res.error });
        return;
      }
      if (res.settings) setSettings(res.settings);
      toast.success("Configuración guardada", {
        description: "Los encabezados y las impresiones ya la usan, en todas las compus."
      });
      router.refresh();
    } catch {
      toast.error("No se pudo guardar la configuración. Revisá la conexión y probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("¿Volver todos los datos de Configuración a los de fábrica? Se pierde lo que se cargó.")) return;
    setLoading(true);
    try {
      const res = await resetSystemSettingsAction();
      if (!res.success) {
        toast.error("No se pudo restablecer la configuración", { description: res.error });
        return;
      }
      setSettings(res.settings ?? DEFAULT_MUNICIPAL_SETTINGS);
      toast.success("Configuración restablecida a los datos de fábrica");
      router.refresh();
    } catch {
      toast.error("No se pudo restablecer la configuración. Revisá la conexión y probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Configuración"
        description="El nombre, el escudo, las autoridades y los contactos de la Municipalidad que aparecen en la app y en los documentos."
        icon={Settings}
        actions={
          canEdit ? (
          <>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={loading}
            className="rounded-2xl h-11 px-4 text-xs font-bold border-border/60"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Restaurar predeterminados
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="rounded-2xl h-11 px-5 font-bold text-xs bg-primary text-primary-foreground shadow-lg shadow-primary/20"
          >
            <Save className="mr-2 h-4 w-4" /> {loading ? "Guardando…" : "Guardar cambios"}
          </Button>
          </>
          ) : undefined
        }
      />

      {!canEdit && (
        <p className="text-sm text-muted-foreground rounded-xl border border-border/60 bg-muted/30 px-4 py-3 max-w-3xl">
          Podés ver la configuración. Para cambiarla, pedíselo a Superadmin o a Administración General.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/50 max-w-2xl">
        <button
          onClick={() => setActiveTab("identity")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === "identity"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Identidad y logotipo</span>
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
          <span>Contacto y enlaces</span>
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === "preview"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Previsualización membrete</span>
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
          <span>Estado del sistema</span>
        </button>
      </div>

      <fieldset disabled={!canEdit} className="contents">
      {activeTab === "identity" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-2xl border-border/60 shadow-sm bg-card p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" /> Escudo o logotipo municipal
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    Subí el escudo o logo oficial de Tres de Febrero (PNG transparente, JPG o SVG).
                  </p>
                </div>
                {settings.customLogoUrl && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                    Logo personalizado activo
                  </Badge>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-muted/30 border border-border/40">
                <div className="w-24 h-24 rounded-2xl bg-card border border-border/80 flex items-center justify-center p-3 shadow-inner shrink-0 relative group">
                  {settings.customLogoUrl ? (
                    <img
                      src={settings.customLogoUrl}
                      alt="Logo Municipal"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <MunicipalCrest className="h-16 w-16" forceDefault />
                  )}
                </div>

                <div className="flex-1 space-y-3 w-full text-center sm:text-left">
                  <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/png, image/jpeg, image/svg+xml, image/webp"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl h-10 px-4 text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:scale-102 transition-transform"
                    >
                      <Upload className="mr-2 h-4 w-4" /> Subir imagen de logo
                    </Button>

                    {settings.customLogoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRemoveLogo}
                        className="rounded-xl h-10 px-3 text-xs font-bold text-destructive hover:bg-destructive/10 border-border/60"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Quitar logo
                      </Button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1 justify-center sm:justify-start">
                      <LinkIcon className="h-3 w-3" /> O pegar enlace directo de la imagen (URL):
                    </Label>
                    <Input
                      value={settings.customLogoUrl.startsWith("data:") ? "" : settings.customLogoUrl}
                      onChange={(e) => setSettings({ ...settings, customLogoUrl: e.target.value })}
                      placeholder="https://www.tresdefebrero.gov.ar/escudo-3f.png"
                      className="rounded-xl h-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border-border/60 shadow-sm bg-card p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-foreground">Datos del distrito y dependencia</h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Aparecen en el encabezado y el pie de todo lo que se imprime desde la app.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Nombre del municipio / distrito</Label>
                    <Input
                      value={settings.municipalityName}
                      onChange={(e) => setSettings({ ...settings, municipalityName: e.target.value })}
                      className="rounded-xl h-11 text-xs"
                      placeholder="Municipalidad de Tres de Febrero"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Provincia / jurisdicción</Label>
                    <Input
                      value={settings.provinceName}
                      onChange={(e) => setSettings({ ...settings, provinceName: e.target.value })}
                      className="rounded-xl h-11 text-xs"
                      placeholder="Provincia de Buenos Aires • República Argentina"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Secretaría a cargo</Label>
                    <Input
                      value={settings.secretariatName}
                      onChange={(e) => setSettings({ ...settings, secretariatName: e.target.value })}
                      className="rounded-xl h-11 text-xs"
                      placeholder="Secretaría de Desarrollo Humano y Hábitat"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Dirección General</Label>
                    <Input
                      value={settings.directionName}
                      onChange={(e) => setSettings({ ...settings, directionName: e.target.value })}
                      className="rounded-xl h-11 text-xs"
                      placeholder="Dirección General de Desarrollo Humano y Hábitat"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Intendente / jefe comunal</Label>
                    <Input
                      value={settings.mayorName}
                      onChange={(e) => setSettings({ ...settings, mayorName: e.target.value })}
                      className="rounded-xl h-11 text-xs"
                      placeholder="Lic. Diego Valenzuela (Intendente Municipal)"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Secretario / autoridad de firma</Label>
                    <Input
                      value={settings.secretaryName}
                      onChange={(e) => setSettings({ ...settings, secretaryName: e.target.value })}
                      className="rounded-xl h-11 text-xs"
                      placeholder="Lic. Bautista Pino (Secretario General)"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground">Vista previa institucional</h3>
            <Card className="rounded-2xl border-border/60 shadow-sm bg-muted/20 p-6 space-y-4 text-center sticky top-24">
              <div className="mx-auto p-3 bg-card rounded-2xl border border-border/80 w-24 h-24 flex items-center justify-center shadow-sm">
                {settings.customLogoUrl ? (
                  <img
                    src={settings.customLogoUrl}
                    alt="Logo Preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <MunicipalCrest className="h-16 w-16" forceDefault />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-primary">
                  {settings.provinceName}
                </p>
                <h4 className="text-lg font-bold text-foreground tracking-tight mt-1">
                  {settings.municipalityName}
                </h4>
                <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                  {settings.secretariatName}
                </p>
              </div>

              <div className="pt-3 border-t border-border/40 text-left space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground font-medium shrink-0">Intendente:</span>
                  <span className="font-bold text-foreground truncate">{settings.mayorName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground font-medium shrink-0">Secretaría:</span>
                  <span className="font-bold text-foreground truncate">{settings.secretaryName}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "contact" && (
        <Card className="rounded-2xl border-border/60 shadow-sm bg-card p-6 space-y-6 max-w-3xl animate-in fade-in duration-300">
          <div>
            <h3 className="text-base font-bold text-foreground">Canales oficiales y Mesa de Entradas</h3>
            <p className="text-xs text-muted-foreground font-medium">
              Teléfonos de contacto y sedes oficiales de la Municipalidad de Tres de Febrero.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5 p-4 rounded-2xl bg-primary/5 border border-primary/15">
              <Label htmlFor="helpdeskPhone" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <LifeBuoy className="h-3.5 w-3.5 text-primary" /> Mesa de ayuda de la app
              </Label>
              <Input
                id="helpdeskPhone"
                value={settings.helpdeskPhone}
                onChange={(e) => setSettings({ ...settings, helpdeskPhone: e.target.value })}
                className="rounded-xl h-11 text-xs bg-card"
                placeholder="Ej.: interno o teléfono de quien da soporte"
              />
              <p className="text-xs text-muted-foreground">Aparece en las páginas de error, para que la gente sepa a quién avisar. Si queda vacío, no se muestra.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" /> Teléfono conmutador municipal
                </Label>
                <Input
                  value={settings.mainPhone}
                  onChange={(e) => setSettings({ ...settings, mainPhone: e.target.value })}
                  className="rounded-xl h-11 text-xs"
                  placeholder="0800-888-0333 / Línea 147"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-rose-500" /> Línea de emergencias / Defensa Civil
                </Label>
                <Input
                  value={settings.emergencyPhone}
                  onChange={(e) => setSettings({ ...settings, emergencyPhone: e.target.value })}
                  className="rounded-xl h-11 text-xs"
                  placeholder="Línea 103 (Defensa Civil) • 107 (SAME) • 911"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-blue-500" /> Correo electrónico institucional
                </Label>
                <Input
                  value={settings.officialEmail}
                  onChange={(e) => setSettings({ ...settings, officialEmail: e.target.value })}
                  className="rounded-xl h-11 text-xs"
                  placeholder="desarrollohumano@tresdefebrero.gov.ar"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-emerald-500" /> Portal web oficial
                </Label>
                <Input
                  value={settings.officialWebsite}
                  onChange={(e) => setSettings({ ...settings, officialWebsite: e.target.value })}
                  className="rounded-xl h-11 text-xs"
                  placeholder="https://www.tresdefebrero.gov.ar"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" /> Domicilio del palacio municipal / sede central
              </Label>
              <Input
                value={settings.headquartersAddress}
                onChange={(e) => setSettings({ ...settings, headquartersAddress: e.target.value })}
                className="rounded-xl h-11 text-xs"
                placeholder="Juan Bautista Alberdi 4840, Caseros, Tres de Febrero (B1678)"
              />
            </div>

            <div className="pt-3 border-t border-border/40 flex justify-end">
              <Button
                variant="outline"
                asChild
                className="rounded-xl text-xs font-bold gap-2 border-border/60"
              >
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.headquartersAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>Ver sede central en Google Maps</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === "preview" && (
        <Card className="rounded-2xl border-border/60 shadow-sm bg-card p-6 sm:p-8 space-y-6 max-w-4xl animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Previsualización de membrete oficial
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Simulación en tiempo real de los encabezados e impresiones institucionales A4 de Tres de Febrero.
              </p>
            </div>
            <PrintButton label="Probar impresión oficial" />
          </div>

          <div className="p-6 sm:p-8 rounded-2xl border border-border/60 bg-background shadow-inner space-y-6 relative overflow-hidden">
            <MunicipalLetterhead showWatermark={true} preview={settings} />

            <div className="space-y-4 py-4 text-xs leading-relaxed text-foreground/90">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-2">
                <p className="font-bold text-xs text-primary">
                  Documento de prueba de identidad municipal
                </p>
                <p>
                  El presente formato membretado aplica a constancias de subsidios, ordenes de compra, fichas sociales unificadas e informes técnicos emitidos desde la plataforma <b>MuniGestión</b>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1">
                  <span className="text-xs font-bold text-muted-foreground">Intendente municipal</span>
                  <p className="font-bold text-foreground">{settings.mayorName}</p>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1">
                  <span className="text-xs font-bold text-muted-foreground">Secretaría general</span>
                  <p className="font-bold text-foreground">{settings.secretaryName}</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border/60 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-1">
                <div className="border-t border-foreground/40 w-36 mx-auto mb-1" />
                <p className="font-bold text-xs">Firma autorizada</p>
                <p className="text-xs text-muted-foreground">{settings.directionName}</p>
              </div>
              <div className="space-y-1">
                <div className="border-t border-foreground/40 w-36 mx-auto mb-1" />
                <p className="font-bold text-xs">Sello de Mesa de Entradas</p>
                <p className="text-xs text-muted-foreground">{settings.municipalityName}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      </fieldset>

      {activeTab === "security" && (
        <Card className="rounded-2xl border-border/60 shadow-sm bg-card p-6 space-y-4 max-w-3xl animate-in fade-in duration-300">
          <div>
            <h3 className="text-base font-bold text-foreground">Estado del sistema</h3>
            <p className="text-xs text-muted-foreground font-medium">Se revisa cada vez que abrís esta pestaña.</p>
          </div>
          <div className="space-y-3 text-xs">
            <StatusRow
              icon={Database}
              title="Base de datos"
              detail={status.database ? "Responde bien." : "No responde. Si sigue así, avisá a quien administra la app."}
              ok={status.database}
              label={status.database ? "Conectada" : "Sin conexión"}
            />
            <StatusRow
              icon={Bot}
              title="Asistente de IA"
              detail={status.assistant ? "Tiene la clave de Google Gemini cargada." : "Falta cargar la clave de Google Gemini, así que el asistente no responde."}
              ok={status.assistant}
              label={status.assistant ? "Configurado" : "Sin configurar"}
            />
            <StatusRow
              icon={FolderUp}
              title="Archivos adjuntos"
              detail={status.fileStorage ? "Los documentos se guardan en el almacenamiento de Vercel." : "Falta conectar el almacenamiento de archivos (Vercel Blob): lo que se sube puede perderse."}
              ok={status.fileStorage}
              label={status.fileStorage ? "Conectado" : "Sin conectar"}
            />
            <StatusRow
              icon={Timer}
              title="Cierre de sesión por inactividad"
              detail={`La sesión se cierra sola después de ${status.inactivityMinutes} minutos sin usar la app.`}
              ok
              label={`${status.inactivityMinutes} minutos`}
            />
          </div>
        </Card>
      )}
    </div>
  );
}


function StatusRow({ icon: Icon, title, detail, ok, label }: { icon: React.ElementType; title: string; detail: string; ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-muted/30">
      <div className="flex items-start gap-3 min-w-0">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`} />
        <div className="min-w-0">
          <p className="font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Badge className={`shrink-0 font-bold border-none ${ok ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-800 dark:text-amber-300"}`}>
        {label}
      </Badge>
    </div>
  );
}
