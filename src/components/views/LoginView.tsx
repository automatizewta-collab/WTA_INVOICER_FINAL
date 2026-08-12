"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useEffect } from "react";
import type { UserRole } from "@/lib/types";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  logistica: "Logística",
  comercial: "Comercial",
};

export function LoginPage() {
  const navigate = useAppStore((s) => s.navigate);
  const setAuth = useAppStore((s) => s.setAuth);
  const { data: session, status } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (session?.user) {
      const role = (session.user as unknown as { role?: string }).role as UserRole | undefined;
      const id = (session.user as unknown as { id?: string }).id as string | undefined;
      const name = session.user?.name || null;
      if (role && id) {
        setAuth(role, id, name);
        navigate("dashboard");
      }
    }
  }, [session, setAuth, navigate]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha email e senha");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Email ou senha incorretos");
      }
      // On success, the useEffect above will handle redirect
    } catch {
      toast.error("Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="rounded-xl bg-primary p-3">
              <FileText className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Invoicer</CardTitle>
          <CardDescription>
            Sistema de Gestão de Documentos Comerciais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@invoicer.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Entrar
            </Button>
          </form>
          <div className="mt-6 space-y-2">
            <p className="text-xs text-center text-muted-foreground font-medium">
              Usuários padrão:
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              {(["admin", "logistica", "comercial"] as UserRole[]).map((role) => (
                <div key={role} className="rounded-md bg-muted/50 p-2">
                  <p className="font-medium">{ROLE_LABELS[role]}</p>
                  <p className="text-muted-foreground">{role}@invoicer.com</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Senha padrão: admin123 / logistica123 / comercial123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
