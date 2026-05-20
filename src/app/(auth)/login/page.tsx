"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Lock, Mail } from "lucide-react";

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
          description: "Por favor, verifique su email y contraseña."
        });
      } else {
        toast.success("¡Bienvenido!", {
          description: "Ingresando al sistema..."
        });
        router.push("/dashboard");
      }
    } catch (err) {
      toast.error("Error", {
        description: "Ocurrió un problema al intentar iniciar sesión."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-xl mb-4 text-white">
            <Building2 size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">MuniGestión</h1>
          <p className="text-slate-500 mt-2">Plataforma Social y Administrativa</p>
        </div>

        <Card className="border-none shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <CardDescription>
              Ingrese sus credenciales municipales para acceder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email Institucional</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@municipio.gob.ar"
                    className="pl-10"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-10"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base shadow-lg transition-all"
                type="submit"
                disabled={loading}
              >
                {loading ? "Iniciando..." : "Ingresar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-500 mt-8">
          &copy; {new Date().getFullYear()} Dirección General de Desarrollo Humano y Hábitat
        </p>
      </div>
    </div>
  );
}
