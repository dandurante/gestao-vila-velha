import { useState, useEffect } from "react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Login } from "@/components/Login";
import { LogOut, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordSetup } from "@/components/PasswordSetup";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Controle Freelancers" },
      {
        name: "description",
        content: "Controle diário de caixa por unidade — entradas, depósitos e despesas.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Controle Freelancers" },
      {
        property: "og:description",
        content: "Controle diário de caixa por unidade — entradas, depósitos e despesas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Controle Freelancers" },
      {
        name: "description",
        content: "Web application for managing freelancer payments and daily cash control.",
      },
      {
        property: "og:description",
        content: "Web application for managing freelancer payments and daily cash control.",
      },
      {
        name: "twitter:description",
        content: "Web application for managing freelancer payments and daily cash control.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ee7c6bad-4227-412f-9200-e640f9cad942/id-preview-8161fd6a--ba94df6b-5922-4af4-a2cb-6fb010b88422.lovable.app-1776508929632.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ee7c6bad-4227-412f-9200-e640f9cad942/id-preview-8161fd6a--ba94df6b-5922-4af4-a2cb-6fb010b88422.lovable.app-1776508929632.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordSetupRequired, setPasswordSetupRequired] = useState(false);

  const loadPasswordSetupStatus = async (userId: string) => {
    const { data, error } = await supabase
      .from("password_setup_status")
      .select("completed")
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    setPasswordSetupRequired(!data.completed);
  };

  useEffect(() => {
    // Busca a sessão inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      try {
        if (session?.user && pathname !== "/reset-password") {
          await loadPasswordSetupStatus(session.user.id);
        }
      } catch {
        setPasswordSetupRequired(true);
      } finally {
        setLoading(false);
      }
    });

    // Escuta mudanças na autenticação (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setPasswordSetupRequired(false);
        setLoading(false);
        return;
      }
      if (pathname === "/reset-password") return;

      setLoading(true);
      queueMicrotask(() => {
        loadPasswordSetupStatus(session.user.id)
          .catch(() => setPasswordSetupRequired(true))
          .finally(() => setLoading(false));
      });
    });

    return () => subscription.unsubscribe();
  }, [pathname]);

  if (pathname === "/reset-password") {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isPublicRoute =
    typeof window !== "undefined" &&
    (window.location.pathname === "/vagas" || window.location.pathname === "/checkin");

  // Se não estiver logado e não for rota pública, mostra a tela de Login
  if (!session && !isPublicRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <Login />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    );
  }

  if (passwordSetupRequired && session) {
    return (
      <QueryClientProvider client={queryClient}>
        <PasswordSetup
          userId={session.user.id}
          onComplete={() => setPasswordSetupRequired(false)}
        />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="relative min-h-screen">
        {/* Botão de Logout Flutuante ou no topo */}
        <div className="fixed bottom-4 right-4 z-50 flex gap-2">
          <Link to="/">
            <Button variant="default" size="sm" className="shadow-lg">
              <Home className="mr-2 h-4 w-4" />
              Início
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            className="shadow-lg"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>

        <Outlet />
      </div>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
