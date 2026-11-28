import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wrench, Power } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  adminAdjustCredits,
  adminCreateCategory,
  adminCreateNotice,
  adminCreateScenario,
  adminDeleteCategory,
  adminDeleteNotice,
  adminDeleteScenario,
  adminSetFalQuota,
  adminSetMaintenance,
  adminUpdateCategory,
  adminUpdateScenario,
  getAdminOverview,
  uploadSiteImage,
  type AdminOverview,
} from '../lib/db';
import { useToast } from '../context/ToastContext';
import { notifyCreditsChanged } from '../shared/creditsEvents';
import type { CategoryItem, PlanDefinition, ScenarioItem } from '../shared/catalog';
import { DEFAULT_MAINTENANCE_CONFIG } from '../shared/adminStats';
import { DEFAULT_FAL_FREE_LIMIT } from '../shared/providerQuota';
import { ButtonSpinner } from '../components/ButtonSpinner';
import { AdminStatsSection } from '../components/AdminStatsSection';
import { AdminHealthPanel } from '../components/AdminHealthPanel';

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
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeMsg, setNewNoticeMsg] = useState('');
  const [pendingCreditKey, setPendingCreditKey] = useState<string | null>(null);
  const [updatingPlanKey, setUpdatingPlanKey] = useState<string | null>(null);
  const [creatingNotice, setCreatingNotice] = useState(false);
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null);

  // Cenários — formulário criar/editar
  interface ScenarioFormState {
    title: string;
    categoryId: string;
    description: string;
    image: string;
    outfit: string;
    environment: string;
    pose: string;
    lighting: string;
    style: string;
    popular: boolean;
    active: boolean;
  }
  const EMPTY_SCENARIO_FORM: ScenarioFormState = {
    title: '',
    categoryId: 'luxo',
    description: '',
    image: '',
    outfit: '',
    environment: '',
    pose: '',
    lighting: '',
    style: '',
    popular: false,
    active: true,
  };
  const [scenarioForm, setScenarioForm] = useState<ScenarioFormState>(EMPTY_SCENARIO_FORM);
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [savingScenario, setSavingScenario] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [togglingScenarioId, setTogglingScenarioId] = useState<string | null>(null);
  const [deletingScenarioId, setDeletingScenarioId] = useState<string | null>(null);
  const [scenarioFilterCategory, setScenarioFilterCategory] = useState('all');
  const [scenarioSearch, setScenarioSearch] = useState('');

  // Categorias — formulário criar/editar
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', image: '' });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [uploadingCategoryCover, setUploadingCategoryCover] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  const filteredScenarios = useMemo(() => {
    const q = scenarioSearch.trim().toLowerCase();
    return (data?.scenarios ?? []).filter((s) => {
      if (scenarioFilterCategory !== 'all' && s.categoryId !== scenarioFilterCategory) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.categoryName.toLowerCase().includes(q)
      );
    });
  }, [data, scenarioFilterCategory, scenarioSearch]);

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
      notifyCreditsChanged();
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

  const resetScenarioForm = () => {
    setScenarioForm(EMPTY_SCENARIO_FORM);
    setEditingScenarioId(null);
  };

  const startEditScenario = (scenario: ScenarioItem) => {
    setScenarioForm({
      title: scenario.title,
      categoryId: scenario.categoryId,
      description: scenario.description,
      image: scenario.image,
      outfit: scenario.defaultOutfit,
      environment: scenario.defaultEnvironment,
      pose: scenario.defaultPose,
      lighting: scenario.defaultLighting,
      style: scenario.defaultStyle,
      popular: scenario.popular ?? false,
      active: scenario.active !== false,
    });
    setEditingScenarioId(scenario.id);
    document.getElementById('scenario-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingScenario(true);
    try {
      const input = {
        categoryId: scenarioForm.categoryId,
        title: scenarioForm.title,
        description: scenarioForm.description,
        image: scenarioForm.image,
        defaultOutfit: scenarioForm.outfit,
        defaultEnvironment: scenarioForm.environment,
        defaultPose: scenarioForm.pose,
        defaultLighting: scenarioForm.lighting,
        defaultStyle: scenarioForm.style,
        popular: scenarioForm.popular,
        active: scenarioForm.active,
      };
      if (editingScenarioId) {
        await adminUpdateScenario(editingScenarioId, input);
        setFeedback('Cenário atualizado.');
      } else {
        await adminCreateScenario(input);
        setFeedback('Cenário criado.');
      }
      resetScenarioForm();
      await loadAdmin();
    } catch (err) {
      addToast({
        title: 'Erro ao salvar cenário',
        description:
          err instanceof Error ? err.message : 'Não foi possível salvar o cenário.',
        variant: 'error',
      });
    } finally {
      setSavingScenario(false);
    }
  };

  const handleScenarioCoverUpload = async (file: File) => {
    setUploadingCover(true);
    try {
      const url = await uploadSiteImage(file, scenarioForm.title || 'cenario');
      setScenarioForm((f) => ({ ...f, image: url }));
      setFeedback('Imagem de capa enviada.');
    } catch (err) {
      addToast({
        title: 'Erro ao enviar imagem',
        description: err instanceof Error ? err.message : 'Não foi possível enviar a imagem.',
        variant: 'error',
      });
    } finally {
      setUploadingCover(false);
    }
  };

  const toggleScenarioActive = async (scenario: ScenarioItem) => {
    setTogglingScenarioId(scenario.id);
    try {
      await adminUpdateScenario(scenario.id, { active: !scenario.active });
      setFeedback(scenario.active ? 'Cenário desativado.' : 'Cenário ativado.');
      await loadAdmin();
    } catch (err) {
      addToast({
        title: 'Erro ao alterar cenário',
        description:
          err instanceof Error ? err.message : 'Não foi possível alterar o cenário.',
        variant: 'error',
      });
    } finally {
      setTogglingScenarioId(null);
    }
  };

  const deleteScenario = async (scenario: ScenarioItem) => {
    setDeletingScenarioId(scenario.id);
    try {
      await adminDeleteScenario(scenario.id);
      setFeedback(`Cenário "${scenario.title}" excluído.`);
      if (editingScenarioId === scenario.id) resetScenarioForm();
      await loadAdmin();
    } catch (err) {
      addToast({
        title: 'Erro ao excluir cenário',
        description:
          err instanceof Error ? err.message : 'Não foi possível excluir o cenário.',
        variant: 'error',
      });
    } finally {
      setDeletingScenarioId(null);
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: '', image: '' });
    setEditingCategoryId(null);
  };

  const startEditCategory = (category: CategoryItem) => {
    setCategoryForm({ name: category.name, description: category.description, image: category.image });
    setEditingCategoryId(category.id);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCategory(true);
    try {
      if (editingCategoryId) {
        await adminUpdateCategory(editingCategoryId, categoryForm);
        setFeedback('Categoria atualizada.');
      } else {
        await adminCreateCategory(categoryForm);
        setFeedback('Categoria criada.');
      }
      resetCategoryForm();
      await loadAdmin();
    } catch (err) {
      addToast({
        title: 'Erro ao salvar categoria',
        description:
          err instanceof Error ? err.message : 'Não foi possível salvar a categoria.',
        variant: 'error',
      });
    } finally {
      setSavingCategory(false);
    }
  };

  const handleCategoryCoverUpload = async (file: File) => {
    setUploadingCategoryCover(true);
    try {
      const url = await uploadSiteImage(file, categoryForm.name || 'categoria');
      setCategoryForm((f) => ({ ...f, image: url }));
      setFeedback('Imagem de capa enviada.');
    } catch (err) {
      addToast({
        title: 'Erro ao enviar imagem',
        description: err instanceof Error ? err.message : 'Não foi possível enviar a imagem.',
        variant: 'error',
      });
    } finally {
      setUploadingCategoryCover(false);
    }
  };

  const deleteCategory = async (category: CategoryItem) => {
    setDeletingCategoryId(category.id);
    try {
      await adminDeleteCategory(category.id);
      setFeedback(`Categoria "${category.name}" excluída.`);
      if (editingCategoryId === category.id) resetCategoryForm();
      await loadAdmin();
    } catch (err) {
      addToast({
        title: 'Erro ao excluir categoria',
        description:
          err instanceof Error ? err.message : 'Não foi possível excluir a categoria.',
        variant: 'error',
      });
    } finally {
      setDeletingCategoryId(null);
    }
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

          <AdminHealthPanel
            users={data.users}
            generations={data.generations}
            plans={data.plans}
          />

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
            id="scenario-form"
            onSubmit={handleSaveScenario}
            className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-4 shadow-sm dark:shadow-none"
          >
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              {editingScenarioId ? 'Editar cenário' : 'Novo cenário'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={scenarioForm.title}
                  onChange={(e) => setScenarioForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ex.: Pôr do sol em Tóquio"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Categoria</label>
                <select
                  value={scenarioForm.categoryId}
                  onChange={(e) => setScenarioForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                >
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  value={scenarioForm.description}
                  onChange={(e) => setScenarioForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Breve descrição do cenário"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">
                  Imagem de capa (URL ou envio)
                </label>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <input
                    type="text"
                    required
                    value={scenarioForm.image}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, image: e.target.value }))}
                    placeholder="https://... ou envie um arquivo"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                  />
                  <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-violet-700 text-xs font-medium text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15 cursor-pointer whitespace-nowrap">
                    {uploadingCover ? <ButtonSpinner size="xs" /> : null}
                    <span>{uploadingCover ? 'Enviando...' : 'Enviar imagem'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingCover}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void handleScenarioCoverUpload(file);
                      }}
                    />
                  </label>
                  {scenarioForm.image && (
                    <img
                      src={scenarioForm.image}
                      alt="Prévia da capa do cenário"
                      className="w-16 h-20 object-cover rounded-xl border border-slate-300 dark:border-white/15"
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-700 dark:text-[#A1A1AA]">
                  A imagem enviada é comprimida e vai para o Storage do site. Em breve será
                  possível gerar os campos do cenário direto da foto.
                </p>
              </div>
              <div>
                <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Roupa padrão</label>
                <input
                  type="text"
                  value={scenarioForm.outfit}
                  onChange={(e) => setScenarioForm((f) => ({ ...f, outfit: e.target.value }))}
                  placeholder="Ex.: Terno grafite sob medida"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Ambiente padrão</label>
                <input
                  type="text"
                  value={scenarioForm.environment}
                  onChange={(e) => setScenarioForm((f) => ({ ...f, environment: e.target.value }))}
                  placeholder="Ex.: Terraço panorâmico em Dubai"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Pose padrão</label>
                <input
                  type="text"
                  value={scenarioForm.pose}
                  onChange={(e) => setScenarioForm((f) => ({ ...f, pose: e.target.value }))}
                  placeholder="Ex.: Apoiado no carro olhando para a câmera"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Iluminação padrão</label>
                <input
                  type="text"
                  value={scenarioForm.lighting}
                  onChange={(e) => setScenarioForm((f) => ({ ...f, lighting: e.target.value }))}
                  placeholder="Ex.: Golden hour quente com contraluz"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Estilo fotográfico padrão</label>
                <input
                  type="text"
                  value={scenarioForm.style}
                  onChange={(e) => setScenarioForm((f) => ({ ...f, style: e.target.value }))}
                  placeholder="Ex.: Editorial Leica 50mm f/1.4"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2 text-xs text-slate-900 dark:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scenarioForm.popular}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, popular: e.target.checked }))}
                    className="h-4 w-4 accent-[#7C3AED]"
                  />
                  Popular
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-900 dark:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scenarioForm.active}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, active: e.target.checked }))}
                    className="h-4 w-4 accent-[#7C3AED]"
                  />
                  Ativo no site
                </label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={savingScenario}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60"
              >
                {savingScenario && <ButtonSpinner size="sm" />}
                <span>
                  {savingScenario ? 'Salvando...' : editingScenarioId ? 'Salvar alterações' : 'Adicionar cenário'}
                </span>
              </button>
              {editingScenarioId && (
                <button
                  type="button"
                  onClick={resetScenarioForm}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 hover:text-slate-950 dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white"
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <select
              value={scenarioFilterCategory}
              onChange={(e) => setScenarioFilterCategory(e.target.value)}
              aria-label="Filtrar cenários por categoria"
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
            >
              <option value="all">Todas as categorias ({data.scenarios.length})</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={scenarioSearch}
              onChange={(e) => setScenarioSearch(e.target.value)}
              placeholder="Buscar cenário..."
              aria-label="Buscar cenário"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
            />
            <span className="text-xs text-slate-700 dark:text-[#A1A1AA]">
              {filteredScenarios.length} {filteredScenarios.length === 1 ? 'cenário' : 'cenários'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] overflow-x-auto shadow-sm dark:shadow-none">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-[#A1A1AA]">
                <tr>
                  <th className="py-3 px-4">Capa</th>
                  <th className="py-3 px-4">Título</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Popular</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {filteredScenarios.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-4">
                      <img
                        src={s.image}
                        alt=""
                        className="w-10 h-12 object-cover rounded-lg border border-slate-300 dark:border-white/15"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-slate-950 dark:text-white">{s.title}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-700 dark:text-[#A1A1AA]">{s.categoryName}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-950 dark:text-white">
                      {s.active ? 'Ativo' : 'Desativado'}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-950 dark:text-white">
                      {s.popular ? 'Sim' : 'Não'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEditScenario(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-violet-700 text-xs text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={togglingScenarioId === s.id}
                          onClick={() => void toggleScenarioActive(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-slate-300 text-xs text-slate-900 hover:bg-slate-100 dark:border-white/15 dark:text-white dark:hover:bg-white/5 disabled:opacity-60"
                        >
                          {togglingScenarioId === s.id && <ButtonSpinner size="xs" />}
                          <span>{s.active ? 'Desativar' : 'Ativar'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={deletingScenarioId === s.id}
                          onClick={() => void deleteScenario(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-red-600/50 text-xs text-red-800 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-950/30 disabled:opacity-60"
                        >
                          {deletingScenarioId === s.id && <ButtonSpinner size="xs" />}
                          <span>Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredScenarios.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 px-4 text-center text-xs text-slate-700 dark:text-[#A1A1AA]">
                      Nenhum cenário encontrado para esse filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-4 shadow-sm dark:shadow-none">
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">Categorias</h2>
            <form onSubmit={handleSaveCategory} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex.: Viagens pelo mundo"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-700 dark:text-[#A1A1AA] mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Breve descrição da categoria"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={categoryForm.image}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, image: e.target.value }))}
                  placeholder="URL da imagem de capa"
                  aria-label="URL da imagem de capa da categoria"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                />
                <label className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-violet-700 text-xs font-medium text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15 cursor-pointer whitespace-nowrap">
                  {uploadingCategoryCover ? <ButtonSpinner size="xs" /> : null}
                  <span>{uploadingCategoryCover ? 'Enviando...' : 'Enviar'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingCategoryCover}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void handleCategoryCoverUpload(file);
                    }}
                  />
                </label>
              </div>
              <div className="md:col-span-3 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60"
                >
                  {savingCategory && <ButtonSpinner size="sm" />}
                  <span>
                    {savingCategory ? 'Salvando...' : editingCategoryId ? 'Salvar alterações' : 'Adicionar categoria'}
                  </span>
                </button>
                {editingCategoryId && (
                  <button
                    type="button"
                    onClick={resetCategoryForm}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 hover:text-slate-950 dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white"
                  >
                    Cancelar edição
                  </button>
                )}
              </div>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-[#A1A1AA]">
                  <tr>
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">Cenários</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {data.categories.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2.5 px-4 text-slate-950 dark:text-white">
                        {c.name}
                        <span className="block text-xs text-slate-700 dark:text-[#A1A1AA]">{c.slug}</span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-950 dark:text-white font-mono-num">
                        {data.scenarios.filter((s) => s.categoryId === c.id).length}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEditCategory(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-violet-700 text-xs text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={deletingCategoryId === c.id}
                            onClick={() => void deleteCategory(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-red-600/50 text-xs text-red-800 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-950/30 disabled:opacity-60"
                          >
                            {deletingCategoryId === c.id && <ButtonSpinner size="xs" />}
                            <span>Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
