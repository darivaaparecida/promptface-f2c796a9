import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { CategoryItem, PlanDefinition, ScenarioItem } from '../shared/catalog';

type AdminTab = 'metricas' | 'usuarios' | 'cenarios' | 'planos' | 'geracoes' | 'avisos' | 'moderacao';

interface AdminOverview {
  metrics: {
    totalUsers: number;
    activeSubscriptions: number;
    canceledSubscriptions: number;
    mrrBrl: number;
    totalRevenueBrl: number;
    totalGenerations: number;
    generationsToday: number;
    avgCostUsd: number;
    estimatedMarginPct: number;
  };
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    credits: number;
    planId: string;
    subscriptionStatus: string;
  }>;
  generations: Array<{
    id: string;
    scenarioTitle: string;
    provider: string;
    model: string;
    costCredits: number;
    estimatedCostUsd: number;
    createdAt: string;
  }>;
  categories: CategoryItem[];
  scenarios: ScenarioItem[];
  plans: PlanDefinition[];
  notices: Array<{ id: string; title: string; message: string; active: boolean; createdAt: string }>;
  moderationLogs: Array<{
    id: string;
    userEmail?: string;
    inputSnippet: string;
    reason: string;
    action: string;
    createdAt: string;
  }>;
  waitlistCount: number;
}

export function AdminPage() {
  const { apiFetch } = useAuth();
  const [tab, setTab] = useState<AdminTab>('metricas');
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Forms
  const [newScenarioTitle, setNewScenarioTitle] = useState('');
  const [newScenarioCategory, setNewScenarioCategory] = useState('luxo');
  const [newScenarioDesc, setNewScenarioDesc] = useState('');
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeMsg, setNewNoticeMsg] = useState('');

  const loadAdmin = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/overview');
      if (res.ok) {
        setData((await res.json()) as AdminOverview);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adjustCredits = async (userId: string, delta: number) => {
    const res = await apiFetch(`/api/admin/users/${userId}/credits`, {
      method: 'POST',
      body: JSON.stringify({ delta, reason: 'Ajuste manual pelo painel admin' }),
    });
    if (res.ok) {
      setFeedback('Créditos atualizados.');
      await loadAdmin();
    }
  };

  const toggleScenarioActive = async (scenario: ScenarioItem) => {
    const res = await apiFetch(`/api/admin/scenarios/${scenario.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !scenario.active }),
    });
    if (res.ok) {
      await loadAdmin();
    }
  };

  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch('/api/admin/scenarios', {
      method: 'POST',
      body: JSON.stringify({
        title: newScenarioTitle,
        categoryId: newScenarioCategory,
        description: newScenarioDesc,
      }),
    });
    if (res.ok) {
      setNewScenarioTitle('');
      setNewScenarioDesc('');
      setFeedback('Novo cenário criado e publicado.');
      await loadAdmin();
    }
  };

  const updatePlan = async (plan: PlanDefinition, priceBrl: number, creditsMonthly: number) => {
    const res = await apiFetch(`/api/admin/plans/${plan.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ priceBrl, creditsMonthly }),
    });
    if (res.ok) {
      setFeedback(`Plano ${plan.name} atualizado.`);
      await loadAdmin();
    }
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch('/api/admin/notices', {
      method: 'POST',
      body: JSON.stringify({ title: newNoticeTitle, message: newNoticeMsg }),
    });
    if (res.ok) {
      setNewNoticeTitle('');
      setNewNoticeMsg('');
      await loadAdmin();
    }
  };

  const deleteNotice = async (id: string) => {
    await apiFetch(`/api/admin/notices/${id}`, { method: 'DELETE' });
    await loadAdmin();
  };

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="h-72 rounded-2xl skeleton-violet border border-white/10" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-[#8B5CF6]">
          Administração restrita
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-white">
          Painel Administrativo PromptFace
        </h1>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-200">
          {feedback}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
        {(
          [
            ['metricas', 'Indicadores e Receita'],
            ['usuarios', `Usuários (${data.users.length})`],
            ['cenarios', `Cenários (${data.scenarios.length})`],
            ['planos', 'Planos e Preços'],
            ['geracoes', 'Consumo de API'],
            ['avisos', 'Novidades e Avisos'],
            ['moderacao', `Moderação (${data.moderationLogs.length})`],
          ] as [AdminTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 ${
              tab === id
                ? 'bg-[#7C3AED] text-white'
                : 'bg-[#17171F] text-[#A1A1AA] border border-white/10 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'metricas' && (
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
            <div key={kpi.label} className="rounded-2xl border border-white/10 bg-[#17171F] p-5">
              <p className="text-xs text-[#A1A1AA]">{kpi.label}</p>
              <p className="mt-2 font-display text-2xl font-bold text-white font-mono-num">
                {kpi.val}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="rounded-2xl border border-white/10 bg-[#17171F] overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs text-[#A1A1AA]">
              <tr>
                <th className="py-3.5 px-4">Nome</th>
                <th className="py-3.5 px-4">E-mail</th>
                <th className="py-3.5 px-4">Plano</th>
                <th className="py-3.5 px-4 text-right">Créditos</th>
                <th className="py-3.5 px-4 text-right">Ajustar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4 text-white">{u.name}</td>
                  <td className="py-3 px-4 text-[#A1A1AA]">{u.email}</td>
                  <td className="py-3 px-4 text-xs uppercase text-[#A1A1AA]">{u.planId}</td>
                  <td className="py-3 px-4 text-right font-mono-num text-white">{u.credits}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => adjustCredits(u.id, 10)}
                      className="px-2.5 py-1 rounded bg-[#7C3AED] text-xs text-white"
                    >
                      +10
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustCredits(u.id, -10)}
                      className="px-2.5 py-1 rounded border border-white/15 text-xs text-[#A1A1AA]"
                    >
                      -10
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
            className="rounded-2xl border border-white/10 bg-[#17171F] p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
          >
            <div>
              <label className="block text-xs text-[#A1A1AA] mb-1">Título</label>
              <input
                type="text"
                required
                value={newScenarioTitle}
                onChange={(e) => setNewScenarioTitle(e.target.value)}
                placeholder="Ex.: Pôr do sol em Tóquio"
                className="w-full px-3 py-2 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#A1A1AA] mb-1">Categoria</label>
              <select
                value={newScenarioCategory}
                onChange={(e) => setNewScenarioCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
              >
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#A1A1AA] mb-1">Descrição</label>
              <input
                type="text"
                required
                value={newScenarioDesc}
                onChange={(e) => setNewScenarioDesc(e.target.value)}
                placeholder="Breve descrição do cenário"
                className="w-full px-3 py-2 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
            >
              Adicionar cenário
            </button>
          </form>

          <div className="rounded-2xl border border-white/10 bg-[#17171F] overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs text-[#A1A1AA]">
                <tr>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Título</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.scenarios.slice(0, 30).map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-4 text-xs text-[#A1A1AA]">{s.categoryName}</td>
                    <td className="py-2.5 px-4 text-white">{s.title}</td>
                    <td className="py-2.5 px-4 text-xs text-white">
                      {s.active ? 'Ativo' : 'Desativado'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleScenarioActive(s)}
                        className="px-3 py-1 rounded border border-white/15 text-xs text-white hover:bg-white/5"
                      >
                        {s.active ? 'Desativar' : 'Ativar'}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.plans.map((p) => (
            <div key={p.id} className="rounded-2xl border border-white/10 bg-[#17171F] p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-white">{p.name}</h2>
              <p className="text-sm text-[#A1A1AA] font-mono-num">
                Preço: {p.priceFormatted} · Créditos: {p.creditsMonthly} ({p.maxPhotosMonthly} fotos)
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updatePlan(p, p.priceBrl, p.creditsMonthly + 50)}
                  className="px-3 py-2 rounded-xl border border-[#7C3AED] text-xs text-white"
                >
                  +50 créditos mensais
                </button>
                <button
                  type="button"
                  onClick={() => updatePlan(p, p.priceBrl, Math.max(50, p.creditsMonthly - 50))}
                  className="px-3 py-2 rounded-xl border border-white/15 text-xs text-[#A1A1AA]"
                >
                  -50 créditos mensais
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'geracoes' && (
        <div className="rounded-2xl border border-white/10 bg-[#17171F] overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs text-[#A1A1AA]">
              <tr>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Cenário</th>
                <th className="py-3 px-4">Provedor / Modelo</th>
                <th className="py-3 px-4 text-right">Custo API</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.generations.map((g) => (
                <tr key={g.id}>
                  <td className="py-3 px-4 text-xs text-[#A1A1AA] font-mono-num">
                    {new Date(g.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-white">{g.scenarioTitle}</td>
                  <td className="py-3 px-4 text-xs text-[#A1A1AA]">
                    {g.provider} · {g.model}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-num text-white">
                    US$ {(g.estimatedCostUsd || 0).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'avisos' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateNotice}
            className="rounded-2xl border border-white/10 bg-[#17171F] p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold text-white">Publicar novidade</h2>
            <input
              type="text"
              required
              value={newNoticeTitle}
              onChange={(e) => setNewNoticeTitle(e.target.value)}
              placeholder="Título do aviso"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
            />
            <textarea
              required
              rows={2}
              value={newNoticeMsg}
              onChange={(e) => setNewNoticeMsg(e.target.value)}
              placeholder="Mensagem para os usuários"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
            >
              Publicar aviso
            </button>
          </form>

          <div className="space-y-3">
            {data.notices.map((n) => (
              <div
                key={n.id}
                className="rounded-2xl border border-white/10 bg-[#17171F] p-5 flex items-start justify-between gap-4"
              >
                <div>
                  <h3 className="font-display text-sm font-semibold text-white">{n.title}</h3>
                  <p className="mt-1 text-xs text-[#A1A1AA]">{n.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteNotice(n.id)}
                  className="text-xs text-red-300 hover:underline shrink-0"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'moderacao' && (
        <div className="rounded-2xl border border-white/10 bg-[#17171F] overflow-x-auto">
          {data.moderationLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#A1A1AA]">
              Nenhum bloqueio de moderação registrado.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs text-[#A1A1AA]">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Usuário</th>
                  <th className="py-3 px-4">Trecho</th>
                  <th className="py-3 px-4">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.moderationLogs.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 px-4 text-xs text-[#A1A1AA] font-mono-num">
                      {new Date(m.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-xs text-white">{m.userEmail || '—'}</td>
                    <td className="py-3 px-4 text-xs text-[#A1A1AA]">{m.inputSnippet}</td>
                    <td className="py-3 px-4 text-xs text-red-300">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
