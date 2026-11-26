import crypto from 'node:crypto';
import path from 'node:path';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.ts';
import { CATEGORIES, INITIAL_PLANS, INITIAL_SCENARIOS } from '../src/shared/catalog.ts';
import {
  DEFAULT_MAINTENANCE_CONFIG,
  normalizeMaintenanceConfig,
} from '../src/shared/adminStats.ts';
import {
  DEFAULT_FAL_FREE_LIMIT,
  normalizeFalQuotaState,
} from '../src/shared/providerQuota.ts';
import type {
  CreditLedgerEntry,
  DatabaseSchema,
  FaceReferenceRecord,
  FolderRecord,
  GenerationRecord,
  ModerationLogRecord,
  NoticeRecord,
  PaymentRecord,
  UserRecord,
  WaitlistRecord,
} from './types.ts';
import type { VisualProfileData } from '../src/shared/rules.ts';
import type { CategoryItem, PlanDefinition, ScenarioItem } from '../src/shared/catalog.ts';
import type { MaintenanceConfig } from '../src/shared/adminStats.ts';
import type { FalQuotaState } from '../src/shared/providerQuota.ts';

// ---------------------------------------------------------------------------
// Camada de dados — Supabase (substitui o JSON local data/promptface-db.json)
// ---------------------------------------------------------------------------
// Estratégia: o servidor mantém o banco inteiro em cache na memória (mesma
// forma DatabaseSchema de antes) e o saveDb() escreve no Supabase SOMENTE o
// que mudou (diff contra o último estado persistido). Assim as rotas em
// routes.ts continuam iguais: loadDb() síncrono + await saveDb(db).
// O JSON local NÃO é mais lido nem escrito pelo servidor; ele continua no
// disco apenas como leitura de emergência (scripts/import-legacy-json.ts).
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
export const GENERATED_DIR = path.resolve(DATA_DIR, 'generated');

export const FACE_REFERENCES_BUCKET = 'face-references';
export const GENERATED_IMAGES_BUCKET = 'generated-images';

function bucketForDir(baseDir: string): string {
  return baseDir === UPLOADS_DIR ? FACE_REFERENCES_BUCKET : GENERATED_IMAGES_BUCKET;
}

type Row = Record<string, unknown>;

// Converte undefined -> null (o cliente Supabase rejeita undefined em upsert).
function cleanRow(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value === undefined ? null : value;
  }
  return out;
}

// ------------------------- mapeamento app <-> tabelas ----------------------

function userToRow(u: UserRecord): Row {
  return cleanRow({
    id: u.id,
    auth_user_id: u.authUserId ?? null,
    name: u.name,
    email: u.email,
    role: u.role,
    email_verified: u.emailVerified,
    verification_code: u.verificationCode ?? null,
    reset_code: u.resetCode ?? null,
    reset_expires_at: u.resetExpiresAt ?? null,
    credits: u.credits,
    plan_id: u.planId,
    subscription_status: u.subscriptionStatus,
    stripe_customer_id: u.stripeCustomerId ?? null,
    stripe_subscription_id: u.stripeSubscriptionId ?? null,
    current_period_end: u.currentPeriodEnd ?? null,
    preferred_model: u.preferredModel ?? 'auto',
    created_at: u.createdAt,
  });
}

function userFromRow(r: Row): UserRecord {
  return {
    id: String(r.id),
    authUserId: (r.auth_user_id as string | null) ?? undefined,
    name: String(r.name ?? ''),
    email: String(r.email ?? ''),
    role: r.role === 'admin' ? 'admin' : 'user',
    emailVerified: Boolean(r.email_verified),
    verificationCode: (r.verification_code as string | null) ?? undefined,
    resetCode: (r.reset_code as string | null) ?? undefined,
    resetExpiresAt: (r.reset_expires_at as number | null) ?? undefined,
    credits: Number(r.credits ?? 0),
    planId: (r.plan_id as UserRecord['planId']) ?? 'free_trial',
    subscriptionStatus: (r.subscription_status as UserRecord['subscriptionStatus']) ?? 'inactive',
    stripeCustomerId: (r.stripe_customer_id as string | null) ?? undefined,
    stripeSubscriptionId: (r.stripe_subscription_id as string | null) ?? undefined,
    currentPeriodEnd: (r.current_period_end as string | null) ?? undefined,
    preferredModel: (r.preferred_model as UserRecord['preferredModel']) ?? 'auto',
    createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}

function visualProfileToRow(userId: string, p: VisualProfileData & { updatedAt: string }): Row {
  return cleanRow({
    user_id: userId,
    eye_color: p.eyeColor ?? null,
    hair_color_style: p.hairColorStyle ?? null,
    hair_type: p.hairType ?? null,
    beard_mustache: p.beardMustache ?? null,
    skin_tone: p.skinTone ?? null,
    facial_features: p.facialFeatures ?? null,
    height_body_type: p.heightBodyType ?? null,
    other_characteristics: p.otherCharacteristics ?? null,
    preferred_model: p.preferredModel ?? 'auto',
    updated_at: p.updatedAt,
  });
}

function faceRefToRow(f: FaceReferenceRecord): Row {
  return cleanRow({
    id: f.id,
    user_id: f.userId,
    filename: f.filename,
    mime_type: f.mimeType,
    consent_accepted: f.consentAccepted,
    consent_timestamp: f.consentTimestamp,
    face_verified: f.faceVerified,
    created_at: f.createdAt,
  });
}

function faceRefFromRow(r: Row): FaceReferenceRecord {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    filename: String(r.filename),
    mimeType: String(r.mime_type),
    consentAccepted: Boolean(r.consent_accepted),
    consentTimestamp: String(r.consent_timestamp),
    faceVerified: Boolean(r.face_verified),
    createdAt: String(r.created_at),
  };
}

function generationToRow(g: GenerationRecord): Row {
  return cleanRow({
    id: g.id,
    user_id: g.userId,
    mode: g.mode,
    scenario_id: g.scenarioId ?? null,
    scenario_title: g.scenarioTitle,
    category_id: g.categoryId,
    category_name: g.categoryName,
    prompt_used: g.promptUsed,
    aspect_ratio: g.aspectRatio,
    filename: g.filename,
    mime_type: g.mimeType,
    cost_credits: g.costCredits,
    estimated_cost_usd: g.estimatedCostUsd,
    status: g.status,
    provider: g.provider,
    model: g.model,
    favorite: g.favorite,
    folder_id: g.folderId ?? null,
    tags: g.tags ?? [],
    synth_id_marked: g.synthIdMarked,
    versions: g.versions ?? [],
    created_at: g.createdAt,
  });
}

function generationFromRow(r: Row): GenerationRecord {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    mode: (r.mode as GenerationRecord['mode']) ?? 'preset',
    scenarioId: (r.scenario_id as string | null) ?? undefined,
    scenarioTitle: String(r.scenario_title ?? ''),
    categoryId: String(r.category_id ?? ''),
    categoryName: String(r.category_name ?? ''),
    promptUsed: String(r.prompt_used ?? ''),
    aspectRatio: String(r.aspect_ratio ?? '3:4'),
    filename: String(r.filename ?? ''),
    mimeType: String(r.mime_type ?? 'image/jpeg'),
    costCredits: Number(r.cost_credits ?? 0),
    estimatedCostUsd: Number(r.estimated_cost_usd ?? 0),
    status: (r.status as GenerationRecord['status']) ?? 'completed',
    provider: String(r.provider ?? ''),
    model: String(r.model ?? ''),
    favorite: Boolean(r.favorite),
    folderId: (r.folder_id as string | null) ?? undefined,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    synthIdMarked: Boolean(r.synth_id_marked),
    versions: Array.isArray(r.versions) ? (r.versions as GenerationRecord['versions']) : [],
    createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}

function folderToRow(f: FolderRecord): Row {
  return cleanRow({ id: f.id, user_id: f.userId, name: f.name, created_at: f.createdAt });
}

function folderFromRow(r: Row): FolderRecord {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    name: String(r.name ?? ''),
    createdAt: String(r.created_at),
  };
}

function ledgerToRow(e: CreditLedgerEntry): Row {
  return cleanRow({
    id: e.id,
    user_id: e.userId,
    type: e.type,
    operation: e.operation,
    amount: e.amount,
    balance_after: e.balanceAfter,
    description: e.description,
    created_at: e.createdAt,
  });
}

function ledgerFromRow(r: Row): CreditLedgerEntry {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    type: (r.type as CreditLedgerEntry['type']) ?? 'reserve',
    operation: String(r.operation ?? ''),
    amount: Number(r.amount ?? 0),
    balanceAfter: Number(r.balance_after ?? 0),
    description: String(r.description ?? ''),
    createdAt: String(r.created_at),
  };
}

function paymentToRow(p: PaymentRecord): Row {
  return cleanRow({
    id: p.id,
    user_id: p.userId,
    plan_id: p.planId,
    amount_brl: p.amountBrl,
    status: p.status,
    stripe_session_id: p.stripeSessionId ?? null,
    method: p.method,
    created_at: p.createdAt,
  });
}

function paymentFromRow(r: Row): PaymentRecord {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    planId: (r.plan_id as PaymentRecord['planId']) ?? 'pro',
    amountBrl: Number(r.amount_brl ?? 0),
    status: (r.status as PaymentRecord['status']) ?? 'pending',
    stripeSessionId: (r.stripe_session_id as string | null) ?? undefined,
    method: String(r.method ?? ''),
    createdAt: String(r.created_at),
  };
}

function moderationToRow(m: ModerationLogRecord): Row {
  return cleanRow({
    id: m.id,
    user_id: m.userId ?? null,
    user_email: m.userEmail ?? null,
    input_snippet: m.inputSnippet,
    reason: m.reason,
    action: m.action,
    created_at: m.createdAt,
  });
}

function moderationFromRow(r: Row): ModerationLogRecord {
  return {
    id: String(r.id),
    userId: (r.user_id as string | null) ?? undefined,
    userEmail: (r.user_email as string | null) ?? undefined,
    inputSnippet: String(r.input_snippet ?? ''),
    reason: String(r.reason ?? ''),
    action: (r.action as ModerationLogRecord['action']) ?? 'blocked_prompt',
    createdAt: String(r.created_at),
  };
}

function noticeToRow(n: NoticeRecord): Row {
  return cleanRow({
    id: n.id,
    title: n.title,
    message: n.message,
    active: n.active,
    created_at: n.createdAt,
  });
}

function noticeFromRow(r: Row): NoticeRecord {
  return {
    id: String(r.id),
    title: String(r.title ?? ''),
    message: String(r.message ?? ''),
    active: Boolean(r.active),
    createdAt: String(r.created_at),
  };
}

function waitlistToRow(w: WaitlistRecord): Row {
  return cleanRow({
    id: w.id,
    email: w.email,
    feature: w.feature,
    created_at: w.createdAt,
  });
}

function waitlistFromRow(r: Row): WaitlistRecord {
  return {
    id: String(r.id),
    email: String(r.email ?? ''),
    feature: (r.feature as WaitlistRecord['feature']) ?? 'general',
    createdAt: String(r.created_at),
  };
}

function categoryToRow(c: CategoryItem, sortOrder: number): Row {
  return cleanRow({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    sort_order: sortOrder,
  });
}

function categoryFromRow(r: Row): CategoryItem {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    slug: String(r.slug ?? ''),
    description: String(r.description ?? ''),
    image: String(r.image ?? ''),
  };
}

function scenarioToRow(s: ScenarioItem, sortOrder: number): Row {
  return cleanRow({
    id: s.id,
    category_id: s.categoryId,
    category_name: s.categoryName,
    title: s.title,
    description: s.description,
    image: s.image,
    default_outfit: s.defaultOutfit,
    default_environment: s.defaultEnvironment,
    default_pose: s.defaultPose,
    default_lighting: s.defaultLighting,
    default_style: s.defaultStyle,
    popular: Boolean(s.popular),
    active: s.active !== false,
    sort_order: sortOrder,
  });
}

function scenarioFromRow(r: Row): ScenarioItem {
  return {
    id: String(r.id),
    categoryId: String(r.category_id ?? ''),
    categoryName: String(r.category_name ?? ''),
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    image: String(r.image ?? ''),
    defaultOutfit: String(r.default_outfit ?? ''),
    defaultEnvironment: String(r.default_environment ?? ''),
    defaultPose: String(r.default_pose ?? ''),
    defaultLighting: String(r.default_lighting ?? ''),
    defaultStyle: String(r.default_style ?? ''),
    popular: Boolean(r.popular),
    active: r.active !== false,
  };
}

function planToRow(p: PlanDefinition, sortOrder: number): Row {
  return cleanRow({
    id: p.id,
    name: p.name,
    audience: p.audience,
    price_brl: p.priceBrl,
    price_formatted: p.priceFormatted,
    credits_monthly: p.creditsMonthly,
    max_photos_monthly: p.maxPhotosMonthly,
    description: p.description,
    features: p.features ?? [],
    highlighted: Boolean(p.highlighted),
    sort_order: sortOrder,
  });
}

function planFromRow(r: Row): PlanDefinition {
  return {
    id: (r.id as PlanDefinition['id']) ?? 'pro',
    name: String(r.name ?? ''),
    audience: String(r.audience ?? ''),
    priceBrl: Number(r.price_brl ?? 0),
    priceFormatted: String(r.price_formatted ?? ''),
    creditsMonthly: Number(r.credits_monthly ?? 0),
    maxPhotosMonthly: Number(r.max_photos_monthly ?? 0),
    description: String(r.description ?? ''),
    features: Array.isArray(r.features) ? (r.features as string[]) : [],
    highlighted: Boolean(r.highlighted),
  };
}

// ------------------------------- cache -------------------------------------

let dbCache: DatabaseSchema | null = null;
let dbSnapshot: DatabaseSchema | null = null;
let loadPromise: Promise<DatabaseSchema> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function cloneDb(db: DatabaseSchema): DatabaseSchema {
  return structuredClone(db);
}

async function fetchAllFromSupabase(): Promise<DatabaseSchema> {
  const supabase = getSupabaseAdmin();
  const [
    usersRes,
    profilesRes,
    facesRes,
    generationsRes,
    foldersRes,
    ledgerRes,
    paymentsRes,
    moderationRes,
    noticesRes,
    waitlistRes,
    categoriesRes,
    scenariosRes,
    plansRes,
    settingsRes,
  ] = await Promise.all([
    supabase.from('users').select('*').order('created_at', { ascending: true }),
    supabase.from('visual_profiles').select('*'),
    supabase.from('face_references').select('*').order('created_at', { ascending: false }),
    supabase.from('generations').select('*').order('created_at', { ascending: false }),
    supabase.from('folders').select('*').order('created_at', { ascending: true }),
    supabase.from('credit_ledger').select('*').order('created_at', { ascending: false }),
    supabase.from('payments').select('*').order('created_at', { ascending: false }),
    supabase.from('moderation_logs').select('*').order('created_at', { ascending: false }),
    supabase.from('notices').select('*').order('created_at', { ascending: false }),
    supabase.from('waitlist').select('*').order('created_at', { ascending: true }),
    supabase.from('categories').select('*').order('sort_order', { ascending: true }),
    supabase.from('scenarios').select('*').order('sort_order', { ascending: true }),
    supabase.from('plans').select('*').order('sort_order', { ascending: true }),
    supabase.from('settings').select('*'),
  ]);

  const firstError = [
    usersRes,
    profilesRes,
    facesRes,
    generationsRes,
    foldersRes,
    ledgerRes,
    paymentsRes,
    moderationRes,
    noticesRes,
    waitlistRes,
    categoriesRes,
    scenariosRes,
    plansRes,
    settingsRes,
  ].find((r) => r.error);
  if (firstError?.error) {
    throw new Error(`Falha ao carregar o banco do Supabase: ${firstError.error.message}`);
  }

  const settings = new Map<string, unknown>(
    ((settingsRes.data ?? []) as Row[]).map((row) => [String(row.key), row.value])
  );
  const maintenance = normalizeMaintenanceConfig(
    (settings.get('maintenance') as Partial<MaintenanceConfig> | undefined) ??
      DEFAULT_MAINTENANCE_CONFIG
  );
  const falQuota = normalizeFalQuotaState(
    (settings.get('fal_quota') as Partial<FalQuotaState> | undefined) ?? {
      falImagesUsed: 0,
      falFreeLimit: DEFAULT_FAL_FREE_LIMIT,
    }
  );

  // Catálogo: se as tabelas ainda estiverem vazias (seed não rodado), usa o
  // catálogo do código como fallback de leitura, como o JSON antigo fazia.
  const categories = ((categoriesRes.data ?? []) as Row[]).map(categoryFromRow);
  const scenarios = ((scenariosRes.data ?? []) as Row[]).map(scenarioFromRow);
  const plans = ((plansRes.data ?? []) as Row[]).map(planFromRow);
  if (categories.length === 0) {
    console.warn('[store] Tabela categories vazia — usando catálogo do código até rodar o seed.');
  }
  if (scenarios.length === 0) {
    console.warn('[store] Tabela scenarios vazia — usando catálogo do código até rodar o seed.');
  }
  if (plans.length === 0) {
    console.warn('[store] Tabela plans vazia — usando catálogo do código até rodar o seed.');
  }

  const visualProfiles: DatabaseSchema['visualProfiles'] = {};
  for (const row of (profilesRes.data ?? []) as Row[]) {
    visualProfiles[String(row.user_id)] = {
      eyeColor: (row.eye_color as string | null) ?? undefined,
      hairColorStyle: (row.hair_color_style as string | null) ?? undefined,
      hairType: (row.hair_type as string | null) ?? undefined,
      beardMustache: (row.beard_mustache as string | null) ?? undefined,
      skinTone: (row.skin_tone as string | null) ?? undefined,
      facialFeatures: (row.facial_features as string | null) ?? undefined,
      heightBodyType: (row.height_body_type as string | null) ?? undefined,
      otherCharacteristics: (row.other_characteristics as string | null) ?? undefined,
      preferredModel: (row.preferred_model as VisualProfileData['preferredModel']) ?? 'auto',
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    };
  }

  return {
    users: ((usersRes.data ?? []) as Row[]).map(userFromRow),
    visualProfiles,
    faceReferences: ((facesRes.data ?? []) as Row[]).map(faceRefFromRow),
    generations: ((generationsRes.data ?? []) as Row[]).map(generationFromRow),
    folders: ((foldersRes.data ?? []) as Row[]).map(folderFromRow),
    creditLedger: ((ledgerRes.data ?? []) as Row[]).map(ledgerFromRow),
    payments: ((paymentsRes.data ?? []) as Row[]).map(paymentFromRow),
    moderationLogs: ((moderationRes.data ?? []) as Row[]).map(moderationFromRow),
    notices: ((noticesRes.data ?? []) as Row[]).map(noticeFromRow),
    waitlist: ((waitlistRes.data ?? []) as Row[]).map(waitlistFromRow),
    categories: categories.length ? categories : [...CATEGORIES],
    scenarios: scenarios.length ? scenarios : [...INITIAL_SCENARIOS],
    plans: plans.length ? plans : [...INITIAL_PLANS],
    maintenance,
    falQuota,
  };
}

/**
 * Carrega o banco do Supabase para o cache (chamado no boot do servidor).
 * Se o Supabase não estiver configurado, apenas avisa e o servidor sobe sem
 * banco — loadDb() vai lançar erro claro na primeira rota que precisar dele.
 */
export async function initDb(): Promise<boolean> {
  if (dbCache) return true;
  if (!isSupabaseConfigured()) {
    console.warn(
      '[store] Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). ' +
        'O servidor sobe, mas as rotas de dados vão falhar até configurar as chaves.'
    );
    return false;
  }
  if (!loadPromise) {
    loadPromise = fetchAllFromSupabase()
      .then((db) => {
        dbCache = db;
        dbSnapshot = cloneDb(db);
        console.log(
          `[store] Banco carregado do Supabase: ${db.users.length} usuários, ` +
            `${db.generations.length} gerações, ${db.scenarios.length} cenários.`
        );
        return db;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }
  await loadPromise;
  return true;
}

export function isDbReady(): boolean {
  return dbCache !== null;
}

export function loadDb(): DatabaseSchema {
  if (!dbCache) {
    throw new Error(
      'Banco de dados indisponível: o Supabase ainda não foi carregado ou não está configurado. ' +
        'Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  return dbCache;
}

// ------------------------------ diff + save --------------------------------

interface CollectionDiff {
  table: string;
  upserts: Row[];
  deletes: string[];
  idColumn: string;
}

function diffById<T extends { id: string }>(
  table: string,
  prev: T[],
  next: T[],
  toRow: (item: T, index: number) => Row
): CollectionDiff {
  const prevRows = new Map(prev.map((item, i) => [item.id, JSON.stringify(toRow(item, i))]));
  const nextRows = new Map(next.map((item, i) => [item.id, JSON.stringify(toRow(item, i))]));
  const upserts: Row[] = [];
  next.forEach((item, i) => {
    const row = toRow(item, i);
    if (prevRows.get(item.id) !== JSON.stringify(row)) upserts.push(row);
  });
  const deletes: string[] = [];
  for (const id of prevRows.keys()) {
    if (!nextRows.has(id)) deletes.push(id);
  }
  return { table, upserts, deletes, idColumn: 'id' };
}

export async function saveDb(db: DatabaseSchema): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para salvar dados.'
    );
  }
  if (!dbSnapshot) {
    throw new Error('Banco não carregado do Supabase — chame initDb() no boot do servidor.');
  }
  dbCache = db;

  // Serializa as escritas e calcula o diff no momento da execução, para que
  // escritas concorrentes não percam mudanças umas das outras.
  const run = async (): Promise<void> => {
    const prev = dbSnapshot as DatabaseSchema;
    const diffs: CollectionDiff[] = [
      diffById('categories', prev.categories, db.categories, (c, i) => categoryToRow(c, i)),
      diffById('scenarios', prev.scenarios, db.scenarios, (s, i) => scenarioToRow(s, i)),
      diffById('plans', prev.plans, db.plans, (p, i) => planToRow(p, i)),
      diffById('users', prev.users, db.users, (u) => userToRow(u)),
      diffById('folders', prev.folders, db.folders, (f) => folderToRow(f)),
      diffById('face_references', prev.faceReferences, db.faceReferences, (f) => faceRefToRow(f)),
      diffById('generations', prev.generations, db.generations, (g) => generationToRow(g)),
      diffById('credit_ledger', prev.creditLedger, db.creditLedger, (e) => ledgerToRow(e)),
      diffById('payments', prev.payments, db.payments, (p) => paymentToRow(p)),
      diffById('moderation_logs', prev.moderationLogs, db.moderationLogs, (m) => moderationToRow(m)),
      diffById('notices', prev.notices, db.notices, (n) => noticeToRow(n)),
      diffById('waitlist', prev.waitlist, db.waitlist, (w) => waitlistToRow(w)),
    ];

    // Perfis visuais (mapa por usuário).
    const prevProfiles = Object.entries(prev.visualProfiles);
    const nextProfiles = Object.entries(db.visualProfiles);
    const prevProfileRows = new Map(
      prevProfiles.map(([userId, p]) => [userId, JSON.stringify(visualProfileToRow(userId, p))])
    );
    const profileUpserts: Row[] = [];
    for (const [userId, p] of nextProfiles) {
      const row = visualProfileToRow(userId, p);
      if (prevProfileRows.get(userId) !== JSON.stringify(row)) profileUpserts.push(row);
    }
    const profileDeletes = prevProfiles
      .map(([userId]) => userId)
      .filter((userId) => !(userId in db.visualProfiles));

    // Configurações (maintenance + fal_quota) numa única tabela chave/valor.
    const settingsUpserts: Row[] = [];
    if (JSON.stringify(prev.maintenance) !== JSON.stringify(db.maintenance)) {
      settingsUpserts.push({ key: 'maintenance', value: db.maintenance ?? null });
    }
    if (JSON.stringify(prev.falQuota) !== JSON.stringify(db.falQuota)) {
      settingsUpserts.push({ key: 'fal_quota', value: db.falQuota ?? null });
    }

    const supabase = getSupabaseAdmin();
    for (const diff of diffs) {
      if (diff.upserts.length > 0) {
        const { error } = await supabase.from(diff.table).upsert(diff.upserts);
        if (error) throw new Error(`Falha ao salvar ${diff.table}: ${error.message}`);
      }
      if (diff.deletes.length > 0) {
        const { error } = await supabase
          .from(diff.table)
          .delete()
          .in(diff.idColumn, diff.deletes);
        if (error) throw new Error(`Falha ao remover de ${diff.table}: ${error.message}`);
      }
    }
    if (profileUpserts.length > 0) {
      const { error } = await supabase.from('visual_profiles').upsert(profileUpserts);
      if (error) throw new Error(`Falha ao salvar visual_profiles: ${error.message}`);
    }
    if (profileDeletes.length > 0) {
      const { error } = await supabase
        .from('visual_profiles')
        .delete()
        .in('user_id', profileDeletes);
      if (error) throw new Error(`Falha ao remover de visual_profiles: ${error.message}`);
    }
    if (settingsUpserts.length > 0) {
      const { error } = await supabase.from('settings').upsert(settingsUpserts);
      if (error) throw new Error(`Falha ao salvar settings: ${error.message}`);
    }

    dbSnapshot = cloneDb(db);
  };

  writeQueue = writeQueue.then(run);
  await writeQueue;
}

// ------------------------------ arquivos -----------------------------------
// As imagens agora vivem nos buckets privados do Supabase Storage.
// UPLOADS_DIR/GENERATED_DIR continuam existindo como seletores lógicos de
// bucket (as rotas os importam), mas não apontam mais para pastas no disco.

export function resolveSafeFile(baseDir: string, filename: string): string | null {
  if (!filename || typeof filename !== 'string') return null;
  if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) return null;
  const resolved = path.resolve(baseDir, filename);
  if (!resolved.startsWith(baseDir + path.sep)) return null;
  return resolved;
}

export async function saveImageFile(
  baseDir: string,
  base64Data: string,
  mimeType: string
): Promise<{ filename: string; fullPath: string }> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  if (!resolveSafeFile(baseDir, filename)) {
    throw new Error('Invalid storage filename');
  }
  const bucket = bucketForDir(baseDir);
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(filename, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(`Falha ao enviar imagem para o Storage (${bucket}): ${error.message}`);
  }
  return { filename, fullPath: `${bucket}/${filename}` };
}

export async function deleteImageFile(baseDir: string, filename: string): Promise<void> {
  if (!resolveSafeFile(baseDir, filename)) return;
  try {
    const supabase = getSupabaseAdmin();
    await supabase.storage.from(bucketForDir(baseDir)).remove([filename]);
  } catch {
    // Ignora arquivo já removido / bucket indisponível na exclusão.
  }
}

export async function downloadImageFile(
  baseDir: string,
  filename: string
): Promise<Buffer | null> {
  if (!resolveSafeFile(baseDir, filename)) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(bucketForDir(baseDir))
      .download(filename);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Lê uma imagem do Storage e devolve em base64.
 * ATENÇÃO: virou async (antes era síncrona, lendo do disco). As rotas que
 * usam esta função passaram a usar await — ver server/routes.ts.
 */
export async function readImageAsBase64(
  baseDir: string,
  filename: string
): Promise<string | null> {
  const buffer = await downloadImageFile(baseDir, filename);
  if (!buffer) return null;
  return buffer.toString('base64');
}
