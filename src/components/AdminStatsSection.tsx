import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import {
  buildAdminDailyStats,
  type AdminStatsSummary,
  type DailyAdminStatPoint,
} from '../shared/adminStats';

interface AdminStatsSectionProps {
  dailyStats30d?: AdminStatsSummary;
  users: Array<{ createdAt?: string }>;
  generations: Array<{ createdAt: string }>;
}

function GenerationsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: DailyAdminStatPoint }>;
}) {
  if (!active || !payload || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-300 bg-white dark:border-white/15 dark:bg-[#0E0E14] px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-slate-950 dark:text-white">{item.fullDate}</p>
      <p className="mt-1 text-violet-700 dark:text-[#A855F7] font-mono-num">
        {item.generationsCount} {item.generationsCount === 1 ? 'imagem gerada' : 'imagens geradas'}
      </p>
    </div>
  );
}

function UsersTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: DailyAdminStatPoint }>;
}) {
  if (!active || !payload || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-300 bg-white dark:border-white/15 dark:bg-[#0E0E14] px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-slate-950 dark:text-white">{item.fullDate}</p>
      <p className="mt-1 text-slate-950 dark:text-white font-mono-num">
        {item.cumulativeUsers} {item.cumulativeUsers === 1 ? 'usuário total' : 'usuários totais'}
      </p>
      <p className="text-emerald-700 dark:text-emerald-400 font-mono-num">
        +{item.newUsersCount} {item.newUsersCount === 1 ? 'novo cadastro' : 'novos cadastros'} no dia
      </p>
    </div>
  );
}

export function AdminStatsSection({
  dailyStats30d,
  users,
  generations,
}: AdminStatsSectionProps) {
  const { isDark } = useTheme();
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(14);

  const summary = useMemo<AdminStatsSummary>(() => {
    if (dailyStats30d && dailyStats30d.series.length > 0) {
      const sliced = dailyStats30d.series.slice(-windowDays);
      const totalGenerationsInWindow = sliced.reduce((acc, p) => acc + p.generationsCount, 0);
      const newUsersInWindow = sliced.reduce((acc, p) => acc + p.newUsersCount, 0);
      const totalUsersAtEnd = sliced[sliced.length - 1]?.cumulativeUsers ?? 0;
      let peak: DailyAdminStatPoint | null = null;
      for (const p of sliced) {
        if (!peak || p.generationsCount > peak.generationsCount) {
          peak = p;
        }
      }
      if (peak && peak.generationsCount === 0) peak = null;

      return {
        days: windowDays,
        series: sliced,
        totalGenerationsInWindow,
        newUsersInWindow,
        totalUsersAtEnd,
        peakGenerationsDay: peak,
        avgGenerationsPerDay: Number((totalGenerationsInWindow / windowDays).toFixed(1)),
      };
    }

    return buildAdminDailyStats({
      days: windowDays,
      users: users.filter((u): u is { createdAt: string } => typeof u.createdAt === 'string'),
      generations,
    });
  }, [dailyStats30d, users, generations, windowDays]);

  const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.1)';
  const tickColor = isDark ? '#A1A1AA' : '#334155';
  const axisStroke = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.2)';
  const barFill = isDark ? '#8B5CF6' : '#6D28D9';
  const areaStroke = isDark ? '#EC4899' : '#BE185D';

  return (
    <section
      aria-label="Estatísticas de gerações e usuários"
      data-testid="admin-statistics-section"
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
            Estatísticas da plataforma
          </h2>
          <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
            Volume diário de imagens geradas e crescimento de usuários cadastrados
          </p>
        </div>

        <div
          role="group"
          aria-label="Período das estatísticas"
          className="inline-flex items-center gap-1 p-1 rounded-xl border border-slate-300 bg-slate-100 dark:border-white/10 dark:bg-[#17171F]"
        >
          {([7, 14, 30] as const).map((days) => {
            const active = windowDays === days;
            return (
              <button
                key={days}
                type="button"
                onClick={() => setWindowDays(days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#7C3AED] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white'
                }`}
              >
                {days} dias
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Volume de imagens geradas por dia */}
        <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 shadow-sm dark:shadow-none flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-950 dark:text-white">
                Imagens geradas por dia
              </h3>
              <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                Média de{' '}
                <span className="font-mono-num font-medium text-slate-950 dark:text-white">
                  {summary.avgGenerationsPerDay}
                </span>{' '}
                imagens/dia nos últimos {summary.days} dias
              </p>
            </div>
            <div className="text-right text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num">
              Total no período:{' '}
              <strong className="text-slate-950 dark:text-white">
                {summary.totalGenerationsInWindow}
              </strong>
            </div>
          </div>

          <div className="h-60 w-full" data-testid="admin-daily-generations-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.series}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={{ stroke: axisStroke }}
                  tickLine={false}
                  interval={windowDays === 30 ? 4 : windowDays === 14 ? 1 : 0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
                  content={<GenerationsTooltip />}
                />
                <Bar
                  dataKey="generationsCount"
                  name="Imagens geradas"
                  fill={barFill}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Usuários cadastrados */}
        <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 shadow-sm dark:shadow-none flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-950 dark:text-white">
                Usuários cadastrados
              </h3>
              <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                Novos cadastros no período:{' '}
                <span className="font-mono-num font-medium text-emerald-700 dark:text-emerald-400">
                  +{summary.newUsersInWindow}
                </span>
              </p>
            </div>
            <div className="text-right text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num">
              Base acumulada:{' '}
              <strong className="text-slate-950 dark:text-white">
                {summary.totalUsersAtEnd}
              </strong>
            </div>
          </div>

          <div className="h-60 w-full" data-testid="admin-registered-users-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={summary.series}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="pfAdminUsersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={areaStroke} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={areaStroke} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={{ stroke: axisStroke }}
                  tickLine={false}
                  interval={windowDays === 30 ? 4 : windowDays === 14 ? 1 : 0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<UsersTooltip />} />
                <Area
                  type="monotone"
                  dataKey="cumulativeUsers"
                  name="Usuários cadastrados"
                  stroke={areaStroke}
                  strokeWidth={2}
                  fill="url(#pfAdminUsersGradient)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
