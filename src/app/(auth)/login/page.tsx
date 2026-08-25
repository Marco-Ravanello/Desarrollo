"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import { MunicipalCrest } from "@/components/ui/municipal-crest";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
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
    <div className="flex min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-4 bg-white/10 dark:bg-card/60 backdrop-blur-xl rounded-3xl border border-white/15 shadow-2xl">
            <MunicipalCrest className="h-16 w-16" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-400">
              MUNICIPALIDAD • REPÚBLICA ARGENTINA
            </p>
            <h1 className="text-3xl font-black text-white tracking-tight mt-1">MuniGestión</h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Secretaría de Desarrollo Humano y Hábitat
            </p>
          </div>
        </div>

        <Card className="border border-white/10 shadow-2xl bg-card/90 backdrop-blur-xl rounded-[2rem] text-card-foreground">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-black tracking-tight">Acceso Institucional</CardTitle>
            <CardDescription className="text-xs">
              Ingrese con sus credenciales de agente o funcionario municipal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Correo Electrónico Oficial
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@municipio.gob.ar"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl text-xs bg-muted/40 border-border/60 focus:bg-background"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 rounded-xl text-xs bg-muted/40 border-border/60 focus:bg-background"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all mt-2"
                disabled={loading}
              >
                {loading ? "Validando credenciales..." : "Ingresar a la Plataforma"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-400/90 text-center">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Servidor Seguro • Cifrado de Datos de Extremo a Extremo</span>
        </div>
      </div>
    </div>
  );
}
