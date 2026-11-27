import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Coins, ImagePlus } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  computeMySpaceDashboardSummary,
  type GenerationAnalyticsInput,
  type LedgerAnalyticsInput,
} from '../shared/mySpaceAnalytics';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

/** Formato mínimo que a faixa de recentes usa (MySpacePage tem seu próprio GenerationItem local). */
export interface RecentGenerationItem {
  id: string;
  scenarioTitle: string;
  createdAt: string;
  costCredits: number;
  url: string;
}

interface MySpaceDashboardProps {
  generations: GenerationAnalyticsInput[];
  remainingCredits: number;
  planId?: string;
  ledger?: LedgerAnalyticsInput[];
  /** Gerações completas (com miniatura) para a faixa de recentes. */
  recentGenerations?: RecentGenerationItem[];
  /** Abre a geração no visualizador da galeria. */
  onOpenGeneration?: (item: RecentGenerationItem) => void;
}

interface MonthlyTooltipPayloadItem {
  value?: number;
  payload?: {
    fullLabel: string;
    generations: number;
    creditsSpent: number;
  };
}

function MonthlyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: MonthlyTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) {
    return null;
  }
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-300 bg-white dark:border-white/15 dark:bg-[#0E0E14] px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-slate-950 dark:text-white">{item.fullLabel}</p>
      <p className="mt-1 text-slate-700 dark:text-[#A1A1AA] font-mono-num">
        {item.generations} {item.generations === 1 ? 'fotografia' : 'fotografias'}
      </p>
      <p className="text-violet-700 dark:text-[#A855F7] font-mono-num">{item.creditsSpent} créditos</p>
    </div>
  );
}

interface CreditsTooltipPayloadItem {
  name?: string;
  value?: number;
}

function CreditsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: CreditsTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div className="rounded-xl border border-slate-300 bg-white dark:border-white/15 dark:bg-[#0E0E14] px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-950 dark:text-white font-medium">{entry.name}</p>
      <p className="mt-0.5 text-violet-700 dark:text-[#A855F7] font-mono-num">
        {entry.name === 'Sem saldo disponível' ? '0 créditos' : `${entry.value ?? 0} créditos`}
      </p>
    </div>
  );
}

export function MySpaceDashboard({
  generations,
  remainingCredits,
  planId,
  ledger,
  recentGenerations,
  onOpenGeneration,
}: MySpaceDashboardProps) {
  const { isDark } = useTheme();
  const { getMediaUrl } = useAuth();
  const summary = useMemo(
    () =>
      computeMySpaceDashboardSummary({
        generations,
        remainingCredits,
        planId,
        ledger,
        monthsCount: 6,
      }),
    [generations, remainingCredits, planId, ledger]
  );

  const { creditsOverview } = summary;
  const monthDelta = summary.currentMonthGenerations - summary.previousMonthGenerations;
  const latestGenerations = useMemo(
    () =>
      (recentGenerations ?? [])
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4),
    [recentGenerations]
  );
  const isFreeTrial = (planId ?? 'free_trial') === 'free_trial';

  const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.1)';
  const tickColor = isDark ? '#A1A1AA' : '#334155';
  const axisStroke = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.2)';
  const barFill = isDark ? '#8B5CF6' : '#6D28D9';

  return (
    <section
      aria-label="Resumo de gerações e créditos"
      data-testid="myspace-dashboard"
      className="space-y-4"
    >
      {/* Linha compacta de métricas-chave */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface px-4 py-3.5">
          <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">Gerações neste mês</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white font-mono-num">
            {summary.currentMonthGenerations}
          </p>
          <p className="mt-1 text-[11px] text-slate-700 dark:text-[#A1A1AA] font-mono-num">
            {monthDelta === 0
              ? 'Igual ao mês anterior'
              : monthDelta > 0
              ? `+${monthDelta} vs. mês anterior`
              : `${monthDelta} vs. mês anterior`}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface px-4 py-3.5">
          <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">Créditos restantes</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white font-mono-num">
            {creditsOverview.remainingCredits}
          </p>
          <p className="mt-1 text-[11px] text-slate-700 dark:text-[#A1A1AA] font-mono-num">
            ~{creditsOverview.remainingPhotosEstimate}{' '}
            {creditsOverview.remainingPhotosEstimate === 1 ? 'foto disponível' : 'fotos disponíveis'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface px-4 py-3.5">
          <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">Total na galeria</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white font-mono-num">
            {summary.totalGenerations}
          </p>
          <p className="mt-1 text-[11px] text-slate-700 dark:text-[#A1A1AA] font-mono-num">
            {summary.favoriteCount}{' '}
            {summary.favoriteCount === 1 ? 'favorita' : 'favoritas'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface px-4 py-3.5">
          <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">Plano ativo</p>
          <p className="mt-1 font-display text-lg font-semibold text-slate-950 dark:text-white truncate">
            {creditsOverview.planLabel}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-700 dark:text-[#A1A1AA] font-mono-num">
            {creditsOverview.usedCreditsThisMonth} créditos usados no mês
          </p>
        </div>
      </div>

      {/* Gráficos Recharts: Gerações mensais + Créditos restantes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">
                Contagem mensal de gerações
              </h2>
              <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                Fotografias criadas nos últimos 6 meses
              </p>
            </div>
            <span className="text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num">
              Total no período:{' '}
              <strong className="text-slate-950 dark:text-white">
                {summary.monthlySeries.reduce((acc, b) => acc + b.generations, 0)}
              </strong>
            </span>
          </div>

          <div className="h-52 w-full" data-testid="monthly-generations-chart">
            {summary.totalGenerations === 0 ? (
              <div className="h-full rounded-xl border border-dashed border-slate-300 bg-slate-100/80 dark:border-white/10 dark:bg-[#08080C]/60 flex flex-col items-center justify-center text-center px-4 gap-3">
                <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
                  Ainda não há gerações registradas nos últimos 6 meses.
                </p>
                <Link
                  to="/criar"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110"
                >
                  Gerar primeira foto
                </Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.monthlySeries}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke={gridStroke}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: tickColor, fontSize: 11 }}
                    axisLine={{ stroke: axisStroke }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: tickColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
                    content={<MonthlyTooltip />}
                  />
                  <Bar
                    dataKey="generations"
                    name="Gerações"
                    fill={barFill}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-5 flex flex-col justify-between">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">
                Saldo de créditos
              </h2>
              <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                Disponíveis vs. consumidos no mês
              </p>
            </div>
            <Link
              to="/planos"
              className="text-xs font-medium text-violet-700 hover:text-violet-900 dark:text-[#8B5CF6] dark:hover:text-[#A855F7] whitespace-nowrap"
            >
              Ver planos
            </Link>
          </div>

          <div
            className="relative h-44 w-full flex items-center justify-center"
            data-testid="remaining-credits-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={creditsOverview.chartSlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={creditsOverview.chartSlices.length > 1 ? 3 : 0}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {creditsOverview.chartSlices.map((slice) => {
                    const fill =
                      !isDark && slice.color === '#2E2E3A'
                        ? '#CBD5E1'
                        : !isDark && slice.color === '#8B5CF6'
                        ? '#6D28D9'
                        : slice.color;
                    return <Cell key={slice.name} fill={fill} />;
                  })}
                </Pie>
                <Tooltip content={<CreditsTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-display text-2xl font-bold text-slate-950 dark:text-white font-mono-num leading-none">
                {creditsOverview.remainingCredits}
              </span>
              <span className="mt-1 text-[11px] text-slate-700 dark:text-[#A1A1AA]">restantes</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-300 dark:border-white/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-[#A1A1AA]">
              <span
                aria-hidden="true"
                className="inline-block w-2.5 h-2.5 rounded-sm bg-violet-700 dark:bg-[#8B5CF6]"
              />
              <span>Disponível:</span>
              <span className="text-slate-950 dark:text-white font-mono-num">{creditsOverview.remainingCredits}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-[#A1A1AA]">
              <span
                aria-hidden="true"
                className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-[#2E2E3A]"
              />
              <span>Usado:</span>
              <span className="text-slate-950 dark:text-white font-mono-num">{creditsOverview.usedCreditsThisMonth}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gerações recentes */}
      <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">
              Gerações recentes
            </h2>
            <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
              Suas últimas fotografias geradas — toque para abrir
            </p>
          </div>
          <Link
            to="/criar"
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900 dark:text-[#8B5CF6] dark:hover:text-[#A855F7] whitespace-nowrap"
          >
            <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
            Criar nova foto
          </Link>
        </div>

        {latestGenerations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-100/80 dark:border-white/10 dark:bg-[#08080C]/60 flex flex-col items-center justify-center text-center px-4 py-8 gap-3">
            <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
              Você ainda não gerou nenhuma foto.
            </p>
            <Link
              to="/criar"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110"
            >
              Gerar primeira foto
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {latestGenerations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenGeneration?.(item)}
                aria-label={`Abrir ${item.scenarioTitle}`}
                className="group text-left rounded-xl overflow-hidden border border-slate-300 dark:border-white/10 bg-white dark:bg-[#08080C] hover:border-violet-500 dark:hover:border-[#8B5CF6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 dark:focus-visible:ring-[#8B5CF6]"
              >
                <span className="block aspect-[3/4] overflow-hidden bg-slate-100 dark:bg-[#17171F]">
                  <img
                    src={getMediaUrl(item.url)}
                    alt={item.scenarioTitle}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                  />
                </span>
                <span className="block px-3 py-2.5">
                  <span className="block text-xs font-semibold text-slate-950 dark:text-white truncate">
                    {item.scenarioTitle}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-700 dark:text-[#A1A1AA] font-mono-num">
                    {new Date(item.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}{' '}
                    · {item.costCredits} créditos
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Upgrade da assinatura */}
      <div className="rounded-2xl border border-violet-600/40 bg-gradient-to-r from-violet-600/10 via-fuchsia-500/10 to-violet-600/10 dark:border-[#8B5CF6]/40 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white">
            <Coins className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">
              {isFreeTrial
                ? 'Precisa de mais fotos?'
                : `Plano ${creditsOverview.planLabel} — quer mais volume?`}
            </h2>
            <p className="mt-0.5 text-xs text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
              {isFreeTrial
                ? 'Você está no teste grátis. Assine um plano e gere fotos todos os meses, sem ficar sem créditos.'
                : 'Faça upgrade para gerar mais fotos por mês e liberar o Nano Banana Pro com mais frequência.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/planos"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 whitespace-nowrap"
          >
            Fazer upgrade
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            to="/planos"
            className="text-xs font-medium text-violet-700 hover:text-violet-900 dark:text-[#8B5CF6] dark:hover:text-[#A855F7] whitespace-nowrap"
          >
            Comparar planos
          </Link>
        </div>
      </div>
    </section>
  );
}
