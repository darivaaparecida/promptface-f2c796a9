import { useMemo } from 'react';
import { Link } from 'react-router-dom';
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
import { useTheme } from '../context/ThemeContext';

interface MySpaceDashboardProps {
  generations: GenerationAnalyticsInput[];
  remainingCredits: number;
  planId?: string;
  ledger?: LedgerAnalyticsInput[];
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
}: MySpaceDashboardProps) {
  const { isDark } = useTheme();
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
    </section>
  );
}
