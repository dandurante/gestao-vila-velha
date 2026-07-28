import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LockKeyhole, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Redefinir Senha — Gestão Vila Velha" }] }),
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      setValid(!error && Boolean(data.user));
      setChecking(false);
    });
  }, []);

  const isMinLength = password.length >= 6;
  const isMatch = password.length > 0 && password === confirmation;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      return toast.error("A senha deve ter no mínimo 6 caracteres.");
    }
    if (password !== confirmation) {
      return toast.error("A confirmação de senha não coincide com a nova senha.");
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) return toast.error(error.message || "Não foi possível atualizar a senha.");
    setDone(true);
    toast.success("Sua senha de acesso foi criada com sucesso!");
  };

  if (checking)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LockKeyhole className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold">
            {done ? "Senha Atualizada com Sucesso!" : "Criar Nova Senha de Acesso"}
          </CardTitle>
          <CardDescription>
            {done
              ? "Sua nova senha de acesso está pronta e já pode ser utilizada."
              : "Defina sua senha de acesso ao sistema preenchendo os campos abaixo."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!valid ? (
            <div className="space-y-4 text-center text-sm text-muted-foreground">
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-amber-600 dark:text-amber-400 text-xs">
                Este link de redefinição é inválido ou já foi utilizado/expirou. Solicite um novo link clicando em "Esqueci minha senha" na tela de acesso.
              </div>
              <Button asChild className="w-full">
                <Link to="/">Voltar à Tela de Acesso</Link>
              </Button>
            </div>
          ) : done ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                <span>Senha cadastrada! Você já pode entrar com seu e-mail e nova senha.</span>
              </div>
              <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold">
                <Link to="/">Ir para Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Caixa explicativa com as regras da senha */}
              <div className="rounded-lg bg-muted/60 border border-border/80 p-3 text-xs space-y-2">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Regras para criação da senha:
                </div>
                <ul className="space-y-1 text-muted-foreground pl-1">
                  <li className="flex items-center gap-1.5">
                    {isMinLength ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className={isMinLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                      Ter no mínimo 6 caracteres
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    {isMatch ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className={isMatch ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                      Confirmação idêntica à nova senha
                    </span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recovery-password">Nova Senha</Label>
                <Input
                  id="recovery-password"
                  type="password"
                  minLength={6}
                  placeholder="Digite sua nova senha (mínimo 6 caracteres)"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recovery-confirmation">Confirmar Nova Senha</Label>
                <Input
                  id="recovery-confirmation"
                  type="password"
                  minLength={6}
                  placeholder="Repita a nova senha para confirmar"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar Nova Senha
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
