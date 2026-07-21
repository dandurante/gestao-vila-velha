import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ClipboardList,
  UserPlus,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Gestão Vila Velha — Início" },
      {
        name: "description",
        content:
          "Portal de Gestão Vila Velha: acesse Lançamentos, Cadastro de Prestadores e Indicadores.",
      },
    ],
  }),
});

const items = [
  {
    to: "/lancamento",
    label: "Lançamentos",
    description: "Lançamento diário e controle de prestadores de serviço",
    Icon: ClipboardList,
    accentColor: "from-[#006491] to-[#004b6e]",
    badge: "Diário",
  },
  {
    to: "/cadastro",
    label: "Cadastro",
    description: "Cadastro e gestão de prestadores de serviço",
    Icon: UserPlus,
    accentColor: "from-[#E31837] to-[#b81028]",
    badge: "Equipe",
  },
  {
    to: "/indicadores",
    label: "Indicadores",
    description: "Performance diária e faturamento das lojas",
    Icon: TrendingUp,
    accentColor: "from-[#006491] to-[#E31837]",
    badge: "Métricas",
  },
] as const;

function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Header section with Domino's brand styling */}
      <div className="text-center mb-12 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#006491]/10 text-[#006491] dark:bg-[#006491]/20 dark:text-sky-300 font-semibold text-xs tracking-wide uppercase border border-[#006491]/20">
          <span className="h-2 w-2 rounded-full bg-[#E31837] animate-pulse" />
          Gestão Vila Velha
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
          Portal de Gestão de Operações
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Selecione o módulo desejado para realizar lançamentos, cadastros ou acompanhar indicadores.
        </p>
      </div>

      {/* Modules Cards Grid */}
      <div className="grid w-full max-w-5xl gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ to, label, description, Icon, accentColor, badge }) => (
          <Link
            key={to}
            to={to}
            className="group relative flex h-64 flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm transition-all duration-300 hover:border-[#006491] hover:shadow-xl hover:-translate-y-1.5 overflow-hidden"
          >
            {/* Top decorative gradient bar */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${accentColor}`} />

            <div className="flex items-center justify-between">
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#006491] dark:text-sky-400 group-hover:bg-[#006491] group-hover:text-white transition-colors duration-300 shadow-inner">
                <Icon className="h-8 w-8 transition-transform group-hover:scale-110" />
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-[#E31837] group-hover:text-white transition-colors duration-300">
                {badge}
              </span>
            </div>

            <div className="space-y-2 mt-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#006491] dark:group-hover:text-sky-400 transition-colors">
                {label}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {description}
              </p>
            </div>

            <div className="flex items-center text-xs font-bold text-[#006491] dark:text-sky-400 pt-2 group-hover:translate-x-1 transition-transform">
              Acessar módulo &rarr;
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
