import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Lock, Mail, ShieldCheck, CheckCircle2, ArrowLeft } from "lucide-react";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async () => {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) {
      toast.error("Informe seu e-mail para receber o link de criação de senha.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      setResetSent(true);
      toast.success("Link para criar sua nova senha enviado com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o link.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Verificamos via RPC se email é permitido
      const { data: isAllowed, error: rpcError } = await supabase.rpc("is_email_allowed", {
        check_email: email.toLowerCase().trim(),
      });

      if (!rpcError && isAllowed === false) {
        toast.error("Este e-mail não está autorizado a acessar o sistema.");
        setLoading(false);
        return;
      }

      if (rpcError) {
        console.warn(
          "Aviso RPC is_email_allowed:",
          rpcError.message,
          "— prosseguindo com autenticação direta.",
        );
      }

      // 2. Tenta login com senha ou Magic Link
      if (usePassword) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password: password,
        });
        if (error) throw error;
        toast.success("Login realizado com sucesso!");
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase().trim(),
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setSent(true);
        toast.success("Link de acesso enviado!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao tentar fazer login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Acesso Restrito</CardTitle>
          <CardDescription>
            {resetSent
              ? "Link de criação de senha enviado"
              : usePassword
              ? "Entre com sua senha"
              : "Digite seu e-mail autorizado"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetSent ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs space-y-2 text-left">
                <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  E-mail com link enviado!
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Enviamos um link exclusivo de criação de senha para: <br />
                  <strong className="text-foreground font-mono text-xs">{email}</strong>
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Abra a sua caixa de entrada (ou spam), clique no link para ser direcionado à página de criação de senha.
                </p>
              </div>

              {/* Regras da Senha */}
              <div className="rounded-lg bg-muted/60 border border-border/80 p-3 text-xs text-left space-y-1.5">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Regras para criar a nova senha:
                </div>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-1">
                  <li>Ter no mínimo <b>6 caracteres</b>;</li>
                  <li>Digitar a mesma senha no campo de confirmação.</li>
                </ul>
              </div>

              <Button
                variant="outline"
                onClick={() => setResetSent(false)}
                className="w-full text-xs gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar ao Login
              </Button>
            </div>
          ) : !sent ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {usePassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : usePassword ? (
                  "Entrar"
                ) : (
                  "Enviar Link de Acesso"
                )}
              </Button>

              <div className="text-center space-y-1">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-xs"
                  onClick={() => setUsePassword(!usePassword)}
                >
                  {usePassword ? "Usar Link por E-mail" : "Entrar com Senha"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="block w-full text-xs font-semibold text-primary hover:underline"
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Esqueci minha senha / Criar senha
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="rounded-lg bg-primary/5 p-4 text-sm text-primary">
                Enviamos um link de login para <b>{email}</b>. Verifique sua caixa de entrada (e o
                spam).
              </div>
              <Button variant="ghost" onClick={() => setSent(false)} className="w-full">
                Tentar outro e-mail
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
