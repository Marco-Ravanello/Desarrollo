"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2, Shield, Phone, Globe, MapPin, Save,
  RotateCcw, Database, Upload, Image as ImageIcon, Trash2, Link as LinkIcon,
  FileText, ExternalLink
} from "lucide-react";
import { MunicipalCrest } from "@/components/ui/municipal-crest";
import { MunicipalLetterhead } from "@/components/ui/municipal-letterhead";
import { PrintButton } from "@/components/ui/print-layout";
import {
  saveSystemSettingsAction,
  resetSystemSettingsAction,
  DEFAULT_MUNICIPAL_SETTINGS,
  MunicipalSettings
} from "@/app/(dashboard)/admin/actions/settings-actions";

export function MunicipalSettingsClient({
  initialSettings
}: {
  initialSettings: MunicipalSettings;
}) {
  const [activeTab, setActiveTab] = useState<"identity" | "contact" | "preview" | "security">("identity");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<MunicipalSettings>(initialSettings || DEFAULT_MUNICIPAL_SETTINGS);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Archivo demasiado grande", {
        description: "Por favor, suba una imagen de hasta 2MB (PNG, JPG o SVG)."
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSettings((prev) => ({ ...prev, customLogoUrl: base64 }));
      toast.success("Logo cargado con éxito", {
        description: "Recuerde hacer clic en 'Guardar Cambios' para aplicarlo en todo el sistema."
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({ ...prev, customLogoUrl: "" }));
    toast.info("Escudo oficial predeterminado restablecido");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await saveSystemSettingsAction(settings);
      if (!res.success) {
        toast.error("Error al persistir en base de datos", { description: res.error });
      }

      const updatedSettings = res.settings || settings;
      localStorage.setItem("muni-system-settings", JSON.stringify(updatedSettings));
      window.dispatchEvent(new Event("muni-settings-updated"));

      toast.success("Configuración e Identidad Municipal guardadas", {
        description: "Los datos de Tres de Febrero se actualizaron en toda la plataforma."
      });
    } catch (error) {
      toast.error("Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const res = await resetSystemSettingsAction();
      if (res.settings) {
        setSettings(res.settings);
        localStorage.setItem("muni-system-settings", JSON.stringify(res.settings));
      } else {
        setSettings(DEFAULT_MUNICIPAL_SETTINGS);
        localStorage.removeItem("muni-system-settings");
      }
      window.dispatchEvent(new Event("muni-settings-updated"));
      toast.success("Configuración restablecida a valores oficiales de Tres de Febrero");
    } catch (e) {
      toast.error("Error al restablecer la configuración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
            Configuración Municipal
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Personalización de identidad institucional, logotipo/escudo, autoridades y contactos oficiales.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={loading}
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
          <span>Identidad y Logotipo</span>
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
          onClick={() => setActiveTab("preview")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === "preview"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Previsualización Membrete</span>
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
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" /> Escudo o Logotipo Municipal
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    Suba el escudo o logotipo oficial de Tres de Febrero (PNG transparente, JPG o SVG).
                  </p>
                </div>
                {settings.customLogoUrl && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                    Logo Personalizado Activo
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
                      <Upload className="mr-2 h-4 w-4" /> Subir Imagen de Logo
                    </Button>

                    {settings.customLogoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRemoveLogo}
                        className="rounded-xl h-10 px-3 text-xs font-bold text-destructive hover:bg-destructive/10 border-border/60"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Quitar Logo
                      </Button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 justify-center sm:justify-start">
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

            <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-6">
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
                      placeholder="Municipalidad de Tres de Febrero"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Provincia / Jurisdicción</Label>
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
                    <Label className="text-xs font-bold text-foreground">Secretaría a Cargo</Label>
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
                      placeholder="Dirección General de Gestión Social y Hábitat"
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
                      placeholder="Lic. Diego Valenzuela (Intendente Municipal)"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Secretario / Autoridad de Firma</Label>
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
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Vista Previa Institucional</h3>
            <Card className="rounded-3xl border-border/60 shadow-sm bg-muted/20 p-6 space-y-4 text-center sticky top-24">
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
        <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-6 max-w-3xl animate-in fade-in duration-300">
          <div>
            <h3 className="text-base font-black text-foreground">Canales Oficiales y Mesa de Entradas</h3>
            <p className="text-xs text-muted-foreground font-medium">
              Teléfonos de contacto y sedes oficiales de la Municipalidad de Tres de Febrero.
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
                  placeholder="0800-888-0333 / Línea 147"
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
                  placeholder="Línea 103 (Defensa Civil) • 107 (SAME) • 911"
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
                  placeholder="desarrollohumano@tresdefebrero.gov.ar"
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
                  placeholder="https://www.tresdefebrero.gov.ar"
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
                  <span>Ver Sede Central en Google Maps</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === "preview" && (
        <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 sm:p-8 space-y-6 max-w-4xl animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
            <div>
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Previsualización de Membrete Oficial
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Simulación en tiempo real de los encabezados e impresiones institucionales A4 de Tres de Febrero.
              </p>
            </div>
            <PrintButton label="Probar Impresión Oficial" />
          </div>

          <div className="p-6 sm:p-8 rounded-3xl border border-border/60 bg-background shadow-inner space-y-6 relative overflow-hidden">
            <MunicipalLetterhead showWatermark={true} />

            <div className="space-y-4 py-4 text-xs leading-relaxed text-foreground/90">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-2">
                <p className="font-bold uppercase tracking-wider text-[11px] text-primary">
                  Documento de Prueba de Identidad Municipal
                </p>
                <p>
                  El presente formato membretado aplica a constancias de subsidios, ordenes de compra, fichas sociales unificadas e informes técnicos emitidos desde la plataforma <b>MuniGestión</b>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Intendente Municipal</span>
                  <p className="font-black text-foreground">{settings.mayorName}</p>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Secretaría General</span>
                  <p className="font-black text-foreground">{settings.secretaryName}</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border/60 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-1">
                <div className="border-t border-foreground/40 w-36 mx-auto mb-1" />
                <p className="font-black uppercase text-[11px]">Firma Autorizada</p>
                <p className="text-[10px] text-muted-foreground">{settings.directionName}</p>
              </div>
              <div className="space-y-1">
                <div className="border-t border-foreground/40 w-36 mx-auto mb-1" />
                <p className="font-black uppercase text-[11px]">Sello de Mesa de Entradas</p>
                <p className="text-[10px] text-muted-foreground">{settings.municipalityName}</p>
              </div>
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
              <Shield className="h-5 w-5 text-primary" /> Políticas de Privacidad y Parámetros
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30">
                <div>
                  <p className="text-xs font-bold text-foreground">Anonimización PII de IA</p>
                  <p className="text-[11px] text-muted-foreground">Enmascara DNI y nombres antes de enviar a la nube</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, aiAnonymization: !prev.aiAnonymization }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    settings.aiAnonymization
                      ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                      : "bg-muted text-muted-foreground border border-border/60"
                  }`}
                >
                  {settings.aiAnonymization ? "Habilitado" : "Deshabilitado"}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30">
                <div>
                  <p className="text-xs font-bold text-foreground">Expiración de Sesión (Horas)</p>
                  <p className="text-[11px] text-muted-foreground">Tiempo de inactividad de agente municipal</p>
                </div>
                <select
                  value={settings.sessionTimeout}
                  onChange={(e) => setSettings((prev) => ({ ...prev, sessionTimeout: e.target.value }))}
                  className="h-8 px-2 rounded-xl bg-card border border-border/60 text-xs font-bold text-foreground"
                >
                  <option value="2">2 hs</option>
                  <option value="4">4 hs</option>
                  <option value="8">8 hs</option>
                  <option value="12">12 hs</option>
                  <option value="24">24 hs</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30">
                <div>
                  <p className="text-xs font-bold text-foreground">Modo Mantenimiento</p>
                  <p className="text-[11px] text-muted-foreground">Bloqueo temporal de operaciones no críticas</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, maintenanceMode: !prev.maintenanceMode }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    settings.maintenanceMode
                      ? "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                      : "bg-muted text-muted-foreground border border-border/60"
                  }`}
                >
                  {settings.maintenanceMode ? "Activo" : "Inactivo"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
