export interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  estimatedReturn: string;
  updatedAt?: string;
}

export const DEFAULT_MAINTENANCE_CONFIG: MaintenanceConfig = {
  enabled: false,
  title: 'Estamos realizando melhorias no sistema',
  message:
    'O PromptFace está passando por uma atualização programada para deixar suas gerações ainda mais rápidas e estáveis. Suas fotos e créditos continuam totalmente seguros.',
  estimatedReturn: 'Previsão de retorno em breve',
};

export function normalizeMaintenanceConfig(
  input?: Partial<MaintenanceConfig> | null
): MaintenanceConfig {
  const titleRaw = typeof input?.title === 'string' ? input.title.trim() : '';
  const messageRaw = typeof input?.message === 'string' ? input.message.trim() : '';
  const returnRaw = typeof input?.estimatedReturn === 'string' ? input.estimatedReturn.trim() : '';

  return {
    enabled: Boolean(input?.enabled),
    title: (titleRaw || DEFAULT_MAINTENANCE_CONFIG.title).slice(0, 120),
    message: (messageRaw || DEFAULT_MAINTENANCE_CONFIG.message).slice(0, 500),
    estimatedReturn: returnRaw.slice(0, 100),
    updatedAt: typeof input?.updatedAt === 'string' ? input.updatedAt : undefined,
  };
}

export interface AdminUserTimestampInput {
  createdAt: string;
}

export interface AdminGenerationTimestampInput {
  createdAt: string;
}

export interface DailyAdminStatPoint {
  dateKey: string;
  label: string;
  fullDate: string;
  generationsCount: number;
  newUsersCount: number;
  cumulativeUsers: number;
}

export interface AdminStatsSummary {
  days: number;
  series: DailyAdminStatPoint[];
  totalGenerationsInWindow: number;
  newUsersInWindow: number;
  totalUsersAtEnd: number;
  peakGenerationsDay: DailyAdminStatPoint | null;
  avgGenerationsPerDay: number;
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatShortDayLabel(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${day}/${month}`;
}

function formatFullPtDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const d = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildAdminDailyStats(params: {
  users: AdminUserTimestampInput[];
  generations: AdminGenerationTimestampInput[];
  days?: number;
  referenceDate?: Date;
}): AdminStatsSummary {
  const safeDays = Math.min(90, Math.max(1, Math.floor(params.days ?? 14)));
  const ref = params.referenceDate ? new Date(params.referenceDate.getTime()) : new Date();
  const refUtcMidnight = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));

  const dayKeys: string[] = [];
  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const d = new Date(refUtcMidnight.getTime() - i * 86_400_000);
    dayKeys.push(toUtcDateKey(d));
  }

  const firstKey = dayKeys[0];
  const lastKey = dayKeys[dayKeys.length - 1];

  const genCountByDay = new Map<string, number>();
  for (const gen of params.generations) {
    const parsed = new Date(gen.createdAt);
    if (Number.isNaN(parsed.getTime())) continue;
    const key = toUtcDateKey(parsed);
    if (key >= firstKey && key <= lastKey) {
      genCountByDay.set(key, (genCountByDay.get(key) ?? 0) + 1);
    }
  }

  let usersBeforeWindow = 0;
  const newUsersByDay = new Map<string, number>();
  for (const user of params.users) {
    const parsed = new Date(user.createdAt);
    if (Number.isNaN(parsed.getTime())) continue;
    const key = toUtcDateKey(parsed);
    if (key < firstKey) {
      usersBeforeWindow += 1;
    } else if (key <= lastKey) {
      newUsersByDay.set(key, (newUsersByDay.get(key) ?? 0) + 1);
    }
  }

  let runningUsers = usersBeforeWindow;
  let totalGenerationsInWindow = 0;
  let newUsersInWindow = 0;

  const series: DailyAdminStatPoint[] = dayKeys.map((dateKey) => {
    const generationsCount = genCountByDay.get(dateKey) ?? 0;
    const newUsersCount = newUsersByDay.get(dateKey) ?? 0;
    runningUsers += newUsersCount;
    totalGenerationsInWindow += generationsCount;
    newUsersInWindow += newUsersCount;

    return {
      dateKey,
      label: formatShortDayLabel(dateKey),
      fullDate: formatFullPtDate(dateKey),
      generationsCount,
      newUsersCount,
      cumulativeUsers: runningUsers,
    };
  });

  let peakGenerationsDay: DailyAdminStatPoint | null = null;
  for (const point of series) {
    if (
      point.generationsCount > 0 &&
      (!peakGenerationsDay || point.generationsCount > peakGenerationsDay.generationsCount)
    ) {
      peakGenerationsDay = point;
    }
  }

  return {
    days: safeDays,
    series,
    totalGenerationsInWindow,
    newUsersInWindow,
    totalUsersAtEnd: runningUsers,
    peakGenerationsDay,
    avgGenerationsPerDay:
      safeDays > 0 ? Number((totalGenerationsInWindow / safeDays).toFixed(1)) : 0,
  };
}
