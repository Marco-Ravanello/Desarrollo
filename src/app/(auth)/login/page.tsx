"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import { MunicipalCrest } from "@/components/ui/municipal-crest";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [closedByInactivity, setClosedByInactivity] = useState(false);

  useEffect(() => {
    setClosedByInactivity(new URLSearchParams(window.location.search).get("motivo") === "inactividad");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.code === "bloqueada") {
        toast.error("Cuenta bloqueada temporalmente", {
          description: "Hubo demasiados intentos fallidos. Espere 15 minutos e intente de nuevo."
        });
      } else if (result?.error) {
        toast.error("Credenciales incorrectas", {
          description: "Por favor, verifique su email y contraseña oficial."
        });
      } else {
        toast.success("¡Bienvenido al sistema!", {
          description: "Ingresando a la plataforma institucional..."
        });
        router.push("/dashboard");
      }
    } catch (err) {
      toast.error("Error de autenticación", {
        description: "Ocurrió un problema al intentar conectar con el servidor."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Panel institucional */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#163C68] via-[#1d4a7e] to-[#0E2A49] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#F69321]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-3">
          <MunicipalCrest className="h-12 w-12 shadow-lg ring-1 ring-white/20" forceDefault />
          <div className="leading-tight">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#B8D0EB]">Municipalidad de</p>
            <p className="font-heading text-lg font-bold">Tres de Febrero</p>
          </div>
        </div>

        <div className="relative max-w-md space-y-5">
          <MunicipalCrest className="h-28 w-28 shadow-2xl ring-1 ring-white/20" forceDefault />
          <h1 className="font-heading text-4xl font-bold tracking-tight">
            MuniGestión <span className="text-[#F69321]">3F</span>
          </h1>
          <p className="text-base leading-relaxed text-[#B8D0EB]">
            Plataforma de gestión de la Secretaría de Desarrollo Humano y Hábitat: personas, expedientes, compras, flota y emergencias en un solo lugar.
          </p>
        </div>

        <p className="relative text-xs text-[#B8D0EB]/80">© 2026 Municipalidad de Tres de Febrero</p>
      </div>

      {/* Formulario */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#163C68] to-[#F69321] lg:hidden" />
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-3 text-center lg:hidden">
            <MunicipalCrest className="h-20 w-20 shadow-lg" forceDefault />
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-[#163C68] dark:text-blue-200">
                MuniGestión <span className="text-[#F69321]">3F</span>
              </h1>
              <p className="text-sm text-muted-foreground">Desarrollo Humano y Hábitat · Tres de Febrero</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">Ingresar</h2>
            <p className="text-sm text-muted-foreground">Usá tu correo y contraseña de la plataforma.</p>
          </div>

          {closedByInactivity && (
            <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
              Cerramos tu sesión porque no se usó la app por un rato. Volvé a ingresar para seguir.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@tresdefebrero.gob.ar"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl pl-10 text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl pl-10 text-sm"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
              disabled={loading}
            >
              {loading ? "Verificando..." : "Ingresar"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Acceso exclusivo para personal municipal autorizado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
