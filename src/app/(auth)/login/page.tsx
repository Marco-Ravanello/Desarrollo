"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) toast.error("Error al ingresar");
    else router.push("/dashboard");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="text-center font-bold">MuniGestión Login</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Contraseña</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            <Button className="w-full" type="submit">Ingresar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
