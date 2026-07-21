import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Redefinir senha" }] }),
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length !== 6) return toast.error("A senha deve ter exatamente 6 caracteres.");
    if (password !== confirmation) return toast.error("As senhas não coincidem.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    setDone(true);
    toast.success("Senha alterada com sucesso.");
  };

  if (checking)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LockKeyhole className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{done ? "Senha atualizada" : "Criar nova senha"}</CardTitle>
          <CardDescription>
            {done
              ? "Sua nova senha já pode ser usada no acesso ao sistema."
              : "Defina uma nova senha com exatamente 6 caracteres."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!valid ? (
            <div className="space-y-4 text-center text-sm text-muted-foreground">
              <p>Este link é inválido ou expirou. Solicite um novo link na tela de acesso.</p>
              <Button asChild className="w-full">
                <Link to="/">Voltar ao acesso</Link>
              </Button>
            </div>
          ) : done ? (
            <Button asChild className="w-full">
              <Link to="/">Entrar no sistema</Link>
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-password">Nova senha</Label>
                <Input
                  id="recovery-password"
                  type="password"
                  minLength={6}
                  maxLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recovery-confirmation">Confirmar senha</Label>
                <Input
                  id="recovery-confirmation"
                  type="password"
                  minLength={6}
                  maxLength={6}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
