import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wrench, Power } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  adminAdjustCredits,
  adminCreateNotice,
  adminDeleteNotice,
  adminSetFalQuota,
  adminSetMaintenance,
  getAdminOverview,
  type AdminOverview,
} from '../lib/db';
import { useToast } from '../context/ToastContext';
import type { PlanDefinition, ScenarioItem } from '../shared/catalog';
import { DEFAULT_MAINTENANCE_CONFIG } from '../shared/adminStats';
import { DEFAULT_FAL_FREE_LIMIT } from '../shared/providerQuota';
import { ButtonSpinner } from '../components/ButtonSpinner';
import { AdminStatsSection } from '../components/AdminStatsSection';

type AdminTab =
  | 'metricas'
  | 'usuarios'
  | 'cenarios'
  | 'planos'
  | 'geracoes'
  | 'avisos'
  | 'moderacao'
  | 'manutencao';

export function AdminPage() {
  const { refreshConfig } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTabParam = searchParams.get('tab');
  const [tab, setTab] = useState<AdminTab>(
    initialTabParam === 'manutencao' ? 'manutencao' : 'metricas'
  );
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Forms & action pending states
  const [newScenarioTitle, setNewScenarioTitle] = useState('');
  const [newScenarioCategory, setNewScenarioCategory] = useState('luxo');
  const [newScenarioDesc, setNewScenarioDesc] = useState('');
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeMsg, setNewNoticeMsg] = useState('');
  const [pendingCreditKey, setPendingCreditKey] = useState<string | null>(null);
  const [creatingScenario, setCreatingScenario] = useState(false);
  const [togglingScenarioId, setTogglingScenarioId] = useState<string | null>(null);
  const [updatingPlanKey, setUpdatingPlanKey] = useState<string | null>(null);
  const [creatingNotice, setCreatingNotice] = useState(false);
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null);

  // Maintenance mode form states
  const [maintEnabled, setMaintEnabled] = useState(false);
  const [maintTitle, setMaintTitle] = useState(DEFAULT_MAINTENANCE_CONFIG.title);
  const [maintMessage, setMaintMessage] = useState(DEFAULT_MAINTENANCE_CONFIG.message);
  const [maintEstimatedReturn, setMaintEstimatedReturn] = useState(
    DEFAULT_MAINTENANCE_CONFIG.estimatedReturn
  );
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  // fal.ai quota guard state
  const [falLimitInput, setFalLimitInput] = useState(String(DEFAULT_FAL_FREE_LIMIT));
  const [savingFalQuota, setSavingFalQuota] = useState(false);

  const loadAdmin = async () => {
    setLoading(true);
    try {
      const overview = await getAdminOverview();
      setData(overview);
      if (overview.maintenance) {
        setMaintEnabled(overview.maintenance.enabled);
        setMaintTitle(overview.maintenance.title);
        setMaintMessage(overview.maintenance.message);
        setMaintEstimatedReturn(overview.maintenance.estimatedReturn);
      }
      if (overview.falQuota) {
        setFalLimitInput(String(overview.falQuota.limit));
      }
    } catch (err) {
      addToast({
        title: 'Erro ao carregar o painel',
        description:
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar o painel de administração.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const param = searchParams.get('tab');
    if (param === 'manutencao') {
      setTab('manutencao');
    }
  }, [searchParams]);

  const adjustCredits = async (userId: string, delta: number) => {
    const key = `${userId}:${delta}`;
    setPendingCreditKey(key);
    try {
      await adminAdjustCredits(userId, delta, 'Ajuste manual pelo painel admin');
      setFeedback('Créditos atualizados.');
      await loadAdmin();
    } catch (err) {
      addToast({
        title: 'Erro ao ajustar créditos',
        description:
          err instanceof Error ? err.message : 'Não foi possível ajustar os créditos.',
        variant: 'error',
      });
    } finally {
      setPendingCreditKey(null);
    }
  };

  const toggleScenarioActive = async (scenario: ScenarioItem) => {
    // Fase 1: edição de cenários e planos pelo painel está pausada — o
    // catálogo agora vem do código do site (src/shared/catalog.ts).
    setFeedback(
      'A edição de cenários e planos pelo painel está pausada nesta fase — o catálogo agora vem do código do site.'
    );
  };

  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    // Fase 1: edição de cenários e planos pelo painel está pausada — o
    // catálogo agora vem do código do site (src/shared/catalog.ts).
    setFeedback(
      'A edição de cenários e planos pelo painel está pausada nesta fase — o catálogo agora vem do código do site.'
    );
  };

  const updatePlan = async (plan: PlanDefinition, priceBrl: number, creditsMonthly: number, deltaTag: number) => {
    // Fase 1: edição de cenários e planos pelo painel está pausada — o
    // catálogo agora vem do código do site (src/shared/catalog.ts).
    setFeedback(
      'A edição de cenários e planos pelo painel está pausada nesta fase — o catálogo agora vem do código do site.'
    );
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingNotice(true);
    try {
      await adminCreateNotice(newNoticeTitle, newNoticeMsg);
      setNewNoticeTitle('');
      setNewNoticeMsg('');
      await loadAdmin();
    } catch (err) {
      addToast({
        title: 'Erro ao publicar aviso',
        description:
          err instanceof Error ? err.message : 'Não foi possível criar o aviso.',
        variant: 'error',
      });
    } finally {
      setCreatingNotice(false);
    }
  };

  const deleteNotice = async (id: string) => {
    setDeletingNoticeId(id);
    try {
      await adminDeleteNotice(id);
      await loadAdmin();
    } catch (err) {
      addToast({
        title: 'Erro ao remover aviso',
        description:
          err instanceof Error ? err.message : 'Não foi possível excluir o aviso.',
        variant: 'error',
      });
    } finally {
      setDeletingNoticeId(null);
    }
  };

  const saveMaintenanceSettings = async (nextEnabled: boolean) => {
    setSavingMaintenance(true);
    setFeedback(null);
    try {
      const maintenance = await adminSetMaintenance({
        enabled: nextEnabled,
        title: maintTitle,
        message: maintMessage,
        estimatedReturn: maintEstimatedReturn,
      });
      setMaintEnabled(maintenance.enabled);
      setMaintTitle(maintenance.title);
      setMaintMessage(maintenance.message);
      setMaintEstimatedReturn(maintenance.estimatedReturn);
      setData((prev) => (prev ? { ...prev, maintenance } : prev));
      await refreshConfig();
      const statusMsg = maintenance.enabled
        ? 'Modo de manutenção ativado para os usuários.'
        : 'Modo de manutenção desativado. Plataforma online para todos.';
      setFeedback(statusMsg);
      addToast({
        title: maintenance.enabled ? 'Manutenção ativada' : 'Manutenção desativada',
        description: statusMsg,
        variant: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Erro ao atualizar manutenção',
        description:
          err instanceof Error ? err.message : 'Tente novamente em alguns segundos.',
        variant: 'error',
      });
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleMaintenanceFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveMaintenanceSettings(maintEnabled);
  };

  const handleSaveFalQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLimit = Math.max(0, Math.floor(Number(falLimitInput) || 0));
    setSavingFalQuota(true);
    try {
      const falQuota = await adminSetFalQuota(parsedLimit, data?.falQuota?.used ?? 0);
      setData((prev) => (prev ? { ...prev, falQuota } : prev));
      setFalLimitInput(String(falQuota.limit));
      await refreshConfig();
      addToast({
        title: 'Limite atualizado',
        description: `Limite de proteção da fal.ai definido para ${falQuota.limit} imagens.`,
        variant: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Erro ao atualizar limite',
        description:
          err instanceof Error ? err.message : 'Não foi possível salvar a cota Fal.',
        variant: 'error',
      });
    } finally {
      setSavingFalQuota(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="h-72 rounded-2xl skeleton-violet border border-slate-300 dark:border-white/10" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
          Administração restrita
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-slate-950 dark:text-white">
          Painel Administrativo PromptFace
        </h1>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-600/45 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/30 px-4 py-3 text-xs dark:text-emerald-200">
          {feedback}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-white/10 pb-4">
        {(
          [
            ['metricas', 'Estatísticas e Receita'],
            ['usuarios', `Usuários (${data.users.length})`],
            ['cenarios', `Cenários (${data.scenarios.length})`],
            ['planos', 'Planos e Preços'],
            ['geracoes', 'Consumo de API'],
            ['avisos', 'Novidades e Avisos'],
            ['moderacao', `Moderação (${data.moderationLogs.length})`],
            [
              'manutencao',
              data.maintenance?.enabled ? 'Modo de Manutenção (Ativo)' : 'Modo de Manutenção',
            ],
          ] as [AdminTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              if (id === 'manutencao') {
                setSearchParams({ tab: 'manutencao' }, { replace: true });
              } else if (searchParams.has('tab')) {
                setSearchParams({}, { replace: true });
              }
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              tab === id
                ? 'bg-[#7C3AED] text-white'
                : id === 'manutencao' && data.maintenance?.enabled
                ? 'bg-amber-100 text-amber-950 border border-amber-400 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500/40'
                : 'bg-white text-slate-700 border border-slate-300 hover:text-slate-950 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:border-white/10 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'metricas' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'MRR (Receita mensal)',
                val: `R$ ${data.metrics.mrrBrl.toFixed(2).replace('.', ',')}`,
              },
              { label: 'Assinaturas ativas', val: String(data.metrics.activeSubscriptions) },
              { label: 'Cancelamentos', val: String(data.metrics.canceledSubscriptions) },
              { label: 'Usuários cadastrados', val: String(data.metrics.totalUsers) },
              { label: 'Gerações hoje', val: String(data.metrics.generationsToday) },
              { label: 'Total de gerações', val: String(data.metrics.totalGenerations) },
              { label: 'Custo médio / imagem', val: `US$ ${data.metrics.avgCostUsd.toFixed(3)}` },
              { label: 'Lista de espera', val: String(data.waitlistCount) },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 shadow-sm dark:shadow-none"
              >
                <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">{kpi.label}</p>
                <p className="mt-2 font-display text-2xl font-bold text-slate-950 dark:text-white font-mono-num">
                  {kpi.val}
                </p>
              </div>
            ))}
          </div>

          <AdminStatsSection
            dailyStats30d={data.dailyStats30d}
            users={data.users}
            generations={data.generations}
          />
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] overflow-x-auto shadow-sm dark:shadow-none">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-[#A1A1AA]">
              <tr>
                <th className="py-3.5 px-4">Nome</th>
                <th className="py-3.5 px-4">E-mail</th>
                <th className="py-3.5 px-4">Plano</th>
                <th className="py-3.5 px-4 text-right">Créditos</th>
                <th className="py-3.5 px-4 text-right">Ajustar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4 text-slate-950 dark:text-white">{u.name}</td>
                  <td className="py-3 px-4 text-slate-700 dark:text-[#A1A1AA]">{u.email}</td>
                  <td className="py-3 px-4 text-xs uppercase text-slate-700 dark:text-[#A1A1AA]">{u.planId}</td>
                  <td className="py-3 px-4 text-right font-mono-num text-slate-950 dark:text-white">{u.credits}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      type="button"
                      disabled={pendingCreditKey === `${u.id}:10`}
                      onClick={() => adjustCredits(u.id, 10)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#7C3AED] text-xs text-white disabled:opacity-60"
                    >
                      {pendingCreditKey === `${u.id}:10` && <ButtonSpinner size="xs" />}
                      <span>+10</span>
                    </button>
                    <button
                      type="button"
                      disabled={pendingCreditKey === `${u.id}:-10`}
                      onClick={() => adjustCredits(u.id, -10)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 text-xs text-slate-700 hover:text-slate-950 dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white disabled:opacity-60"
                    >
                      {pendingCreditKey === `${u.id}:-10` && <ButtonSpinner size="xs" />}
                      <span>-10</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cenarios' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateScenario}
            className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end shadow-sm dark:shadow-none"
          >
            <div>
              <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Título</label>
              <input
                type="text"
                required
                value={newScenarioTitle}
                onChange={(e) => setNewScenarioTitle(e.target.value)}
                placeholder="Ex.: Pôr do sol em Tóquio"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Categoria</label>
              <select
                value={newScenarioCategory}
                onChange={(e) => setNewScenarioCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
              >
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Descrição</label>
              <input
                type="text"
                required
                value={newScenarioDesc}
                onChange={(e) => setNewScenarioDesc(e.target.value)}
                placeholder="Breve descrição do cenário"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={creatingScenario}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60"
            >
              {creatingScenario && <ButtonSpinner size="sm" />}
              <span>{creatingScenario ? 'Adicionando...' : 'Adicionar cenário'}</span>
            </button>
          </form>

          <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] overflow-x-auto shadow-sm dark:shadow-none">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-[#A1A1AA]">
                <tr>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Título</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {data.scenarios.slice(0, 30).map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-4 text-xs text-slate-700 dark:text-[#A1A1AA]">{s.categoryName}</td>
                    <td className="py-2.5 px-4 text-slate-950 dark:text-white">{s.title}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-950 dark:text-white">
                      {s.active ? 'Ativo' : 'Desativado'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        disabled={togglingScenarioId === s.id}
                        onClick={() => toggleScenarioActive(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-slate-300 text-xs text-slate-900 hover:bg-slate-100 dark:border-white/15 dark:text-white dark:hover:bg-white/5 disabled:opacity-60"
                      >
                        {togglingScenarioId === s.id && <ButtonSpinner size="xs" />}
                        <span>{s.active ? 'Desativar' : 'Ativar'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'planos' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.plans.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-4 shadow-sm dark:shadow-none">
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">{p.name}</h2>
              <div className="space-y-1 text-sm text-slate-700 dark:text-[#A1A1AA] font-mono-num">
                <p>Mensal: {p.priceFormatted}</p>
                <p>Trimestral: R$ {p.quarterlyPriceBrl.toFixed(2).replace('.', ',')}</p>
                <p>Anual: R$ {p.yearlyPriceBrl.toFixed(2).replace('.', ',')}</p>
                <p className="pt-1 text-slate-950 dark:text-white">
                  Créditos: {p.creditsMonthly}/mês ({p.maxPhotosMonthly} fotos)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={updatingPlanKey === `${p.id}:50`}
                  onClick={() => updatePlan(p, p.priceBrl, p.creditsMonthly + 50, 50)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-700 text-xs font-medium text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15 disabled:opacity-60"
                >
                  {updatingPlanKey === `${p.id}:50` && <ButtonSpinner size="xs" />}
                  <span>+50 créditos mensais</span>
                </button>
                <button
                  type="button"
                  disabled={updatingPlanKey === `${p.id}:-50`}
                  onClick={() => updatePlan(p, p.priceBrl, Math.max(50, p.creditsMonthly - 50), -50)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 hover:text-slate-950 dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white disabled:opacity-60"
                >
                  {updatingPlanKey === `${p.id}:-50` && <ButtonSpinner size="xs" />}
                  <span>-50 créditos mensais</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'geracoes' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveFalQuota}
            data-testid="admin-fal-quota-card"
            className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 flex flex-col md:flex-row md:items-end justify-between gap-4 shadow-sm dark:shadow-none"
          >
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
                Proteção contra cobrança · fal.ai
              </p>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                Cota gratuita controlada: {data.falQuota?.used ?? 0} / {data.falQuota?.limit ?? DEFAULT_FAL_FREE_LIMIT} imagens usadas
              </h2>
              <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                {data.falQuota?.active
                  ? `Chave FAL_API_KEY conectada. Restam ${data.falQuota.remaining} imagens antes do bloqueio automático.`
                  : `Chave FAL_API_KEY ainda não detectada no servidor. Quando ativada, o sistema bloqueia automaticamente ao atingir ${data.falQuota?.limit ?? DEFAULT_FAL_FREE_LIMIT} imagens.`}
              </p>
            </div>

            <div className="flex items-end gap-3 shrink-0">
              <div>
                <label
                  htmlFor="fal-limit-input"
                  className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1"
                >
                  Limite máximo
                </label>
                <input
                  id="fal-limit-input"
                  type="number"
                  min={0}
                  max={1000}
                  value={falLimitInput}
                  onChange={(e) => setFalLimitInput(e.target.value)}
                  className="w-28 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm font-mono-num text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={savingFalQuota}
                data-testid="save-fal-quota-button"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7C3AED] text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#6D28D9] disabled:opacity-60"
              >
                {savingFalQuota && <ButtonSpinner size="xs" />}
                <span>{savingFalQuota ? 'Salvando...' : 'Salvar limite'}</span>
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] overflow-x-auto shadow-sm dark:shadow-none">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-[#A1A1AA]">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Cenário</th>
                  <th className="py-3 px-4">Provedor / Modelo</th>
                  <th className="py-3 px-4 text-right">Custo API</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {data.generations.map((g) => (
                  <tr key={g.id}>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num">
                      {new Date(g.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-slate-950 dark:text-white">{g.scenarioTitle}</td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-[#A1A1AA]">
                      {g.provider} · {g.model}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-slate-950 dark:text-white">
                      US$ {(g.estimatedCostUsd || 0).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'avisos' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateNotice}
            className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-4 shadow-sm dark:shadow-none"
          >
            <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">Publicar novidade</h2>
            <input
              type="text"
              required
              value={newNoticeTitle}
              onChange={(e) => setNewNoticeTitle(e.target.value)}
              placeholder="Título do aviso"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
            />
            <textarea
              required
              rows={2}
              value={newNoticeMsg}
              onChange={(e) => setNewNoticeMsg(e.target.value)}
              placeholder="Mensagem para os usuários"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
            />
            <button
              type="submit"
              disabled={creatingNotice}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60"
            >
              {creatingNotice && <ButtonSpinner size="sm" />}
              <span>{creatingNotice ? 'Publicando...' : 'Publicar aviso'}</span>
            </button>
          </form>

          <div className="space-y-3">
            {data.notices.map((n) => (
              <div
                key={n.id}
                className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 flex items-start justify-between gap-4 shadow-sm dark:shadow-none"
              >
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-950 dark:text-white">{n.title}</h3>
                  <p className="mt-1 text-xs text-slate-700 dark:text-[#A1A1AA]">{n.message}</p>
                </div>
                <button
                  type="button"
                  disabled={deletingNoticeId === n.id}
                  onClick={() => deleteNotice(n.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:underline disabled:opacity-60 shrink-0"
                >
                  {deletingNoticeId === n.id && <ButtonSpinner size="xs" />}
                  <span>{deletingNoticeId === n.id ? 'Removendo...' : 'Remover'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'moderacao' && (
        <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] overflow-x-auto shadow-sm dark:shadow-none">
          {data.moderationLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-700 dark:text-[#A1A1AA]">
              Nenhum bloqueio de moderação registrado.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-[#A1A1AA]">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Usuário</th>
                  <th className="py-3 px-4">Trecho</th>
                  <th className="py-3 px-4">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {data.moderationLogs.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num">
                      {new Date(m.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-950 dark:text-white">{m.userEmail || '—'}</td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-[#A1A1AA]">{m.inputSnippet}</td>
                    <td className="py-3 px-4 text-xs text-red-700 dark:text-red-300">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'manutencao' && (
        <div className="space-y-6" data-testid="admin-maintenance-panel">
          <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm dark:shadow-none">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                  maintEnabled
                    ? 'border-amber-500/40 bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-emerald-500/40 bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                }`}
              >
                <Wrench className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  {maintEnabled
                    ? 'Modo de Manutenção Ativo'
                    : 'Plataforma Online (Manutenção Desativada)'}
                </h2>
                <p className="mt-1 text-xs text-slate-700 dark:text-[#A1A1AA] max-w-xl">
                  {maintEnabled
                    ? 'Visitantes e usuários comuns visualizam a tela amigável de manutenção. Administradores permanecem com acesso livre para validar atualizações.'
                    : 'Todos os usuários acessam normalmente o catálogo, estúdio e gerações. Ative o modo de manutenção durante atualizações do sistema.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={savingMaintenance}
              data-testid="toggle-maintenance-button"
              onClick={() => saveMaintenanceSettings(!maintEnabled)}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider whitespace-nowrap shrink-0 transition-all disabled:opacity-60 ${
                maintEnabled
                  ? 'border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-lg shadow-[#7C3AED]/20 hover:brightness-110'
              }`}
            >
              {savingMaintenance ? (
                <ButtonSpinner size="sm" />
              ) : (
                <Power className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                {savingMaintenance
                  ? 'Atualizando...'
                  : maintEnabled
                  ? 'Desativar modo de manutenção'
                  : 'Ativar modo de manutenção'}
              </span>
            </button>
          </div>

          <form
            onSubmit={handleMaintenanceFormSubmit}
            className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-4 shadow-sm dark:shadow-none"
          >
            <div>
              <h3 className="font-display text-base font-semibold text-slate-950 dark:text-white">
                Mensagem exibida aos usuários
              </h3>
              <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                Personalize o comunicado exibido enquanto o modo de manutenção estiver ligado.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="maintenance-title-input"
                  className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA] mb-1.5"
                >
                  Título do aviso
                </label>
                <input
                  id="maintenance-title-input"
                  type="text"
                  required
                  maxLength={120}
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="maintenance-return-input"
                  className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA] mb-1.5"
                >
                  Previsão de retorno (opcional)
                </label>
                <input
                  id="maintenance-return-input"
                  type="text"
                  maxLength={100}
                  value={maintEstimatedReturn}
                  onChange={(e) => setMaintEstimatedReturn(e.target.value)}
                  placeholder="Ex.: Retorno previsto às 15h30"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="maintenance-message-input"
                className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA] mb-1.5"
              >
                Mensagem amigável
              </label>
              <textarea
                id="maintenance-message-input"
                rows={3}
                required
                maxLength={500}
                value={maintMessage}
                onChange={(e) => setMaintMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
              />
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-600 dark:text-[#71717A]">
                Ao salvar, a mensagem é atualizada imediatamente no servidor.
              </p>
              <button
                type="submit"
                disabled={savingMaintenance}
                data-testid="save-maintenance-button"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-violet-700 bg-violet-700 text-xs font-semibold uppercase tracking-wider text-white hover:bg-violet-800 dark:border-[#7C3AED] dark:bg-[#7C3AED] dark:hover:bg-[#6D28D9] whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                {savingMaintenance && <ButtonSpinner size="sm" />}
                <span>{savingMaintenance ? 'Salvando...' : 'Salvar configurações'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
