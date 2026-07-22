import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

type PasswordSetupProps = {
  userId: string;
  onComplete: () => void;
};

export function PasswordSetup({ userId, onComplete }: PasswordSetupProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length !== 6) {
      toast.error("A senha deve ter exatamente 6 caracteres.");
      return;
    }
    if (password !== confirmation) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;

      try {
        await supabase
          .from("password_setup_status")
          .upsert(
            { user_id: userId, completed: true, completed_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
      } catch (err) {
        console.warn("Status table update warning:", err);
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(`password_setup_completed_${userId}`, "true");
      }

      toast.success("Senha criada com sucesso.");
      onComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LockKeyhole className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Crie sua senha de acesso</CardTitle>
          <CardDescription>
            Para continuar, escolha uma senha com exatamente 6 caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-access-password">Nova senha</Label>
              <Input
                id="new-access-password"
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
              <Label htmlFor="confirm-access-password">Confirmar senha</Label>
              <Input
                id="confirm-access-password"
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar senha e continuar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
