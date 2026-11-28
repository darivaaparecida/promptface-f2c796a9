// ---------------------------------------------------------------------------
// Camada de dados — acesso DIRETO ao Supabase (sem servidor Express).
// ---------------------------------------------------------------------------
// O site em produção é só o frontend (Vercel). Não existe servidor em
// produção e não há Render: cada função abaixo fala com o Supabase pelo
// cliente do navegador (anon key + RLS). Geração de imagem, edição no Studio,
// melhoria de descrição e checkout Stripe NÃO estão aqui — eles precisam de
// chaves secretas e chegam na Fase 2 via Edge Functions do Supabase.
// ---------------------------------------------------------------------------
import { getSupabase } from './supabase';
import { notifyCreditsChanged } from '../shared/creditsEvents';
import type { AuthUser } from '../context/AuthContext';
import {
  CATEGORIES,
  INITIAL_PLANS,
  INITIAL_SCENARIOS,
  type BillingInterval,
  type CategoryItem,
  type PaidPlanId,
  type PlanDefinition,
  type PlanId,
  type ScenarioItem,
} from '../shared/catalog';
import { getPlanCyclePricing } from '../shared/plansCalculator';
import {
  getAllowedPreferredModels,
  normalizePreferredAiModel,
  type PreferredAiModelId,
} from '../shared/aiModels';
import {
  DEFAULT_MAINTENANCE_CONFIG,
  buildAdminDailyStats,
  normalizeMaintenanceConfig,
  type MaintenanceConfig,
} from '../shared/adminStats';
import {
  DEFAULT_FAL_FREE_LIMIT,
  getFalQuotaSummary,
  normalizeFalQuotaState,
  type FalQuotaSummary,
} from '../shared/providerQuota';
import { validateNewFolderName, validateRenameFolder, type FolderItem } from '../shared/photoFolders';
import { MAX_TAGS_PER_PHOTO, normalizeTagList, normalizeTagName } from '../shared/photoTags';
import type { VisualProfileData } from '../shared/rules';

export const FACE_REFERENCES_BUCKET = 'face-references';
export const GENERATED_IMAGES_BUCKET = 'generated-images';

/** Validade das URLs assinadas de mídia (7 dias). A lista é recarregada a cada visita. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

const MAX_FACE_FILE_BYTES = 6 * 1024 * 1024;

type Row = Record<string, unknown>;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toError(error: unknown, fallback: string): Error {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message)
      : '';
  return new Error(message ? `${fallback} (${message})` : fallback);
}

// ------------------------------- tipos -------------------------------------

export interface FaceItem {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  consentAccepted: boolean;
  consentTimestamp: string;
  faceVerified: boolean;
  createdAt: string;
  /** URL assinada do Storage (válida por 7 dias). */
  url: string;
}

export interface GenerationVersionItem {
  id: string;
  instruction: string;
  filename: string;
  mimeType: string;
  createdAt: string;
  /** URL assinada do Storage (válida por 7 dias). */
  url: string;
}

export interface GenerationItem {
  id: string;
  userId: string;
  mode: 'preset' | 'free' | 'variation';
  scenarioId?: string;
  scenarioTitle: string;
  categoryId: string;
  categoryName: string;
  promptUsed: string;
  aspectRatio: string;
  filename: string;
  mimeType: string;
  costCredits: number;
  estimatedCostUsd: number;
  status: 'pending' | 'completed' | 'failed';
  provider: string;
  model: string;
  favorite: boolean;
  /** Foto publicada na Galeria da Comunidade (opt-in do dono). */
  isPublic: boolean;
  folderId?: string;
  tags: string[];
  synthIdMarked: boolean;
  versions: GenerationVersionItem[];
  createdAt: string;
  /** URL assinada do Storage (válida por 7 dias). */
  url: string;
}

export interface CreditEntryItem {
  id: string;
  userId: string;
  type: string;
  operation: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface PaymentItem {
  id: string;
  userId: string;
  planId: PaidPlanId;
  billingInterval?: BillingInterval;
  amountBrl: number;
  status: 'paid' | 'canceled' | 'refunded' | 'pending';
  stripeSessionId?: string;
  method: string;
  createdAt: string;
}

export interface NoticeItem {
  id: string;
  title: string;
  message: string;
  active: boolean;
  createdAt: string;
}

export interface ModerationLogItem {
  id: string;
  userId?: string;
  userEmail?: string;
  inputSnippet: string;
  reason: string;
  action: 'blocked_prompt' | 'blocked_upload';
  createdAt: string;
}

export interface AdminMetrics {
  totalUsers: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  mrrBrl: number;
  totalRevenueBrl: number;
  totalGenerations: number;
  generationsToday: number;
  avgCostUsd: number;
  estimatedMarginPct: number;
}

export interface AdminOverview {
  metrics: AdminMetrics;
  users: AuthUser[];
  generations: GenerationItem[];
  categories: typeof CATEGORIES;
  scenarios: typeof INITIAL_SCENARIOS;
  plans: PlanDefinition[];
  notices: NoticeItem[];
  moderationLogs: ModerationLogItem[];
  waitlistCount: number;
  maintenance: MaintenanceConfig;
  falQuota: FalQuotaSummary;
  dailyStats30d: ReturnType<typeof buildAdminDailyStats>;
}

// --------------------------- mapeamento linhas ------------------------------

function userFromRow(r: Row): AuthUser {
  return {
    id: String(r.id),
    name: asString(r.name),
    email: asString(r.email),
    role: r.role === 'admin' ? 'admin' : 'user',
    emailVerified: Boolean(r.email_verified),
    credits: asNumber(r.credits, 0),
    planId: (r.plan_id as PlanId) ?? 'free_trial',
    billingInterval: (r.billing_interval as BillingInterval | null) ?? undefined,
    subscriptionStatus:
      (r.subscription_status as AuthUser['subscriptionStatus']) ?? 'inactive',
    currentPeriodEnd: (r.current_period_end as string | null) ?? undefined,
    nextMonthlyCreditGrantAt:
      (r.next_monthly_credit_grant_at as string | null) ?? undefined,
    preferredModel: normalizePreferredAiModel(r.preferred_model),
    createdAt: asString(r.created_at, new Date().toISOString()),
  };
}

function faceFromRow(r: Row, url: string): FaceItem {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    filename: String(r.filename ?? ''),
    mimeType: String(r.mime_type ?? 'image/jpeg'),
    consentAccepted: Boolean(r.consent_accepted),
    consentTimestamp: String(r.consent_timestamp ?? ''),
    faceVerified: Boolean(r.face_verified),
    createdAt: String(r.created_at ?? ''),
    url,
  };
}

function generationFromRow(r: Row, url: string, versions: GenerationVersionItem[]): GenerationItem {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    mode: (r.mode as GenerationItem['mode']) ?? 'preset',
    scenarioId: (r.scenario_id as string | null) ?? undefined,
    scenarioTitle: asString(r.scenario_title),
    categoryId: asString(r.category_id),
    categoryName: asString(r.category_name),
    promptUsed: asString(r.prompt_used),
    aspectRatio: asString(r.aspect_ratio, '3:4'),
    filename: String(r.filename ?? ''),
    mimeType: String(r.mime_type ?? 'image/jpeg'),
    costCredits: asNumber(r.cost_credits, 0),
    estimatedCostUsd: asNumber(r.estimated_cost_usd, 0),
    status: (r.status as GenerationItem['status']) ?? 'completed',
    provider: asString(r.provider),
    model: asString(r.model),
    favorite: Boolean(r.favorite),
    isPublic: Boolean(r.is_public),
    folderId: (r.folder_id as string | null) ?? undefined,
    tags: normalizeTagList(r.tags),
    synthIdMarked: Boolean(r.synth_id_marked),
    versions,
    createdAt: String(r.created_at ?? ''),
    url,
  };
}

function ledgerFromRow(r: Row): CreditEntryItem {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    type: String(r.type ?? ''),
    operation: asString(r.operation),
    amount: asNumber(r.amount, 0),
    balanceAfter: asNumber(r.balance_after, 0),
    description: asString(r.description),
    createdAt: String(r.created_at ?? ''),
  };
}

function paymentFromRow(r: Row): PaymentItem {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    planId: (r.plan_id as PaidPlanId) ?? 'pro',
    billingInterval: (r.billing_interval as BillingInterval | null) ?? undefined,
    amountBrl: asNumber(r.amount_brl, 0),
    status: (r.status as PaymentItem['status']) ?? 'pending',
    stripeSessionId: (r.stripe_session_id as string | null) ?? undefined,
    method: asString(r.method),
    createdAt: String(r.created_at ?? ''),
  };
}

function noticeFromRow(r: Row): NoticeItem {
  return {
    id: String(r.id),
    title: asString(r.title),
    message: asString(r.message),
    active: Boolean(r.active),
    createdAt: String(r.created_at ?? ''),
  };
}

function moderationFromRow(r: Row): ModerationLogItem {
  return {
    id: String(r.id),
    userId: (r.user_id as string | null) ?? undefined,
    userEmail: (r.user_email as string | null) ?? undefined,
    inputSnippet: asString(r.input_snippet),
    reason: asString(r.reason),
    action: (r.action as ModerationLogItem['action']) ?? 'blocked_prompt',
    createdAt: String(r.created_at ?? ''),
  };
}

// --------------------- sessão / id do perfil -------------------------------

let cachedProfileId: { authUid: string; profileId: string } | null = null;

export function clearProfileCache(): void {
  cachedProfileId = null;
}

async function getAuthUid(): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw toError(error, 'Não foi possível verificar sua sessão.');
  if (!session) throw new Error('Faça login para acessar esta área.');
  return session.user.id;
}

/** id da linha em public.users do usuário logado (a chave das demais tabelas). */
export async function getMyProfileId(): Promise<string> {
  const authUid = await getAuthUid();
  if (cachedProfileId?.authUid === authUid) return cachedProfileId.profileId;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUid)
    .maybeSingle();
  if (error) throw toError(error, 'Não foi possível carregar sua conta.');
  if (!data) {
    throw new Error(
      'Conta não encontrada no banco. Saia e entre novamente; se o erro persistir, fale com o suporte.'
    );
  }
  const profileId = String((data as Row).id);
  cachedProfileId = { authUid, profileId };
  return profileId;
}

// ------------------------- URLs assinadas ----------------------------------

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * URL assinada do Storage para um arquivo privado. O navegador não pode
 * abrir os buckets privados sem assinatura — por isso as URLs são resolvidas
 * no carregamento das listas (e não na renderização).
 */
export async function getSignedMediaUrl(bucket: string, path: string): Promise<string> {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const key = `${bucket}/${path}`;
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw toError(error, 'Não foi possível abrir a imagem.');
  }
  signedUrlCache.set(key, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}

async function resolveGenerationUrls(row: Row): Promise<GenerationItem> {
  const versionsRaw = Array.isArray(row.versions) ? (row.versions as Row[]) : [];
  const versions: GenerationVersionItem[] = await Promise.all(
    versionsRaw.map(async (v) => ({
      id: String(v.id ?? ''),
      instruction: asString(v.instruction),
      filename: String(v.filename ?? ''),
      mimeType: String(v.mime_type ?? 'image/jpeg'),
      createdAt: String(v.created_at ?? ''),
      url: await getSignedMediaUrl(GENERATED_IMAGES_BUCKET, String(v.filename ?? '')),
    }))
  );
  const url = await getSignedMediaUrl(GENERATED_IMAGES_BUCKET, String(row.filename ?? ''));
  return generationFromRow(row, url, versions);
}

// --------------------------- perfil / conta --------------------------------

/**
 * Linha de public.users do usuário logado. Se a assinatura trimestral/anual
 * tiver liberação mensal vencida, tenta resgatar (mesma regra que o servidor
 * aplicava em /api/auth/session, /api/credits e /api/subscription).
 */
export async function getMyProfile(): Promise<AuthUser | null> {
  const supabase = getSupabase();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();
  if (error) throw toError(error, 'Não foi possível carregar sua conta.');
  if (!data) return null;
  let profile = userFromRow(data as Row);
  cachedProfileId = { authUid: authUser.id, profileId: profile.id };

  const interval = profile.billingInterval ?? 'monthly';
  if (
    profile.subscriptionStatus === 'active' &&
    profile.planId !== 'free_trial' &&
    interval !== 'monthly' &&
    profile.nextMonthlyCreditGrantAt &&
    new Date(profile.nextMonthlyCreditGrantAt).getTime() <= Date.now()
  ) {
    try {
      const { error: rpcError } = await supabase.rpc('claim_monthly_credits');
      if (!rpcError) {
        const { data: refreshed, error: refetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', profile.id)
          .maybeSingle();
        if (!refetchError && refreshed) profile = userFromRow(refreshed as Row);
      }
    } catch {
      // Falha no resgate não bloqueia o login; os créditos caem no próximo acesso.
    }
  }
  return profile;
}

export async function updateMyPreferredModel(
  preferredModel: PreferredAiModelId
): Promise<void> {
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  // Trava também na hora de salvar: modelo fora do plano vira 'auto'
  // (o modelo efetivo do plano). A geração reforça isso no servidor.
  const { data: me } = await supabase
    .from('users')
    .select('plan_id')
    .eq('id', profileId)
    .maybeSingle();
  const planId = (me?.plan_id as PlanId) ?? 'free_trial';
  const allowed = getAllowedPreferredModels(planId);
  const normalized = normalizePreferredAiModel(preferredModel);
  const safe = allowed.includes(normalized) ? normalized : 'auto';
  const { error } = await supabase
    .from('users')
    .update({ preferred_model: safe })
    .eq('id', profileId);
  if (error) throw toError(error, 'Não foi possível salvar sua preferência de modelo.');
}

export interface VisualProfileResult {
  profile: VisualProfileData | null;
  preferredModel: PreferredAiModelId;
}

export async function getVisualProfile(): Promise<VisualProfileResult> {
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('visual_profiles')
    .select('*')
    .eq('user_id', profileId)
    .maybeSingle();
  if (error) throw toError(error, 'Não foi possível carregar seu Perfil Visual.');
  if (!data) {
    const me = await getMyProfile();
    return {
      profile: null,
      preferredModel: normalizePreferredAiModel(me?.preferredModel),
    };
  }
  const row = data as Row;
  const profile: VisualProfileData = {
    eyeColor: (row.eye_color as string | null) ?? undefined,
    hairColorStyle: (row.hair_color_style as string | null) ?? undefined,
    hairType: (row.hair_type as string | null) ?? undefined,
    beardMustache: (row.beard_mustache as string | null) ?? undefined,
    skinTone: (row.skin_tone as string | null) ?? undefined,
    facialFeatures: (row.facial_features as string | null) ?? undefined,
    heightBodyType: (row.height_body_type as string | null) ?? undefined,
    otherCharacteristics: (row.other_characteristics as string | null) ?? undefined,
    preferredModel: normalizePreferredAiModel(row.preferred_model),
  };
  return { profile, preferredModel: profile.preferredModel ?? 'auto' };
}

export async function saveVisualProfile(
  data: VisualProfileData
): Promise<VisualProfileResult> {
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const preferredModel = normalizePreferredAiModel(data.preferredModel);
  const clean = (v: unknown) =>
    typeof v === 'string' ? v.trim().slice(0, 120) : null;
  const { error } = await supabase.from('visual_profiles').upsert(
    {
      user_id: profileId,
      eye_color: clean(data.eyeColor),
      hair_color_style: clean(data.hairColorStyle),
      hair_type: clean(data.hairType),
      beard_mustache: clean(data.beardMustache),
      skin_tone: clean(data.skinTone),
      facial_features: clean(data.facialFeatures),
      height_body_type: clean(data.heightBodyType),
      other_characteristics: clean(data.otherCharacteristics),
      preferred_model: preferredModel,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw toError(error, 'Não foi possível salvar seu Perfil Visual.');
  await updateMyPreferredModel(preferredModel);
  return { profile: { ...data, preferredModel }, preferredModel };
}

// ------------------------ referências faciais ------------------------------

/** Extensão permitida a partir do mime type (o servidor aceitava os mesmos 3). */
function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function listFaces(): Promise<FaceItem[]> {
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('face_references')
    .select('*')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw toError(error, 'Não foi possível carregar suas fotos de referência.');
  return Promise.all(
    ((data ?? []) as Row[]).map(async (row) =>
      faceFromRow(
        row,
        await getSignedMediaUrl(FACE_REFERENCES_BUCKET, String(row.filename ?? ''))
      )
    )
  );
}

/**
 * Prepara uma imagem para subir ao Storage sem pesar e sem perder qualidade
 * visível: reduz para no máximo 1024 px no lado maior e converte para WebP
 * (qualidade 0.85). Uma foto de celular (4032x3024, 3–6 MB) vira ~100–200 KB
 * — 90–95% menor — e continua idêntica na tela e como referência para a IA,
 * que não usa mais que ~1024 px de referência facial. Arquivos já pequenos
 * (JPEG/WebP até 1024 px e até 400 KB) sobem como estão, sem re-encodar.
 * Se qualquer passo falhar, devolve o arquivo original: nunca bloqueia o
 * envio. Exportada para reutilizar no mesmo tratamento das imagens geradas
 * na Fase 2 (lá, a Edge Function deve guardar a imagem como WebP q85 em vez
 * de PNG).
 */
const MAX_UPLOAD_IMAGE_SIDE_PX = 1024;
const UPLOAD_IMAGE_WEBP_QUALITY = 0.85;
const UPLOAD_IMAGE_SMALL_BYTES = 400 * 1024;

async function decodeImageFile(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // cai para o <img> abaixo
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareImageForUpload(
  file: File
): Promise<{ blob: Blob; mimeType: string }> {
  const fallback = { blob: file as Blob, mimeType: file.type || 'image/jpeg' };
  try {
    const source = await decodeImageFile(file);
    const width = source.width;
    const height = source.height;
    const longestSide = Math.max(width, height);
    const alreadySmall = longestSide <= MAX_UPLOAD_IMAGE_SIDE_PX;
    const alreadyEfficient =
      (file.type === 'image/jpeg' || file.type === 'image/webp') &&
      file.size <= UPLOAD_IMAGE_SMALL_BYTES;
    if (alreadySmall && alreadyEfficient) {
      if (source instanceof ImageBitmap) source.close();
      return fallback;
    }
    const scale = alreadySmall ? 1 : MAX_UPLOAD_IMAGE_SIDE_PX / longestSide;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (source instanceof ImageBitmap) source.close();
      return fallback;
    }
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
    if (source instanceof ImageBitmap) source.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', UPLOAD_IMAGE_WEBP_QUALITY)
    );
    if (!blob) return fallback;
    return { blob, mimeType: 'image/webp' };
  } catch {
    return fallback;
  }
}

/**
 * Envia uma foto de referência facial para o bucket privado e cria a linha
 * na tabela. A verificação por IA do rosto (que o servidor fazia) NÃO existe
 * nesta fase — volta na Fase 2, via Edge Function; até lá a foto entra com
 * faceVerified=false e a geração continua bloqueada até lá.
 */
export async function uploadFace(file: File, consentAccepted: boolean): Promise<FaceItem> {
  if (!consentAccepted) {
    throw new Error(
      'O consentimento explícito é obrigatório antes do envio da foto facial (LGPD).'
    );
  }
  if (file.size > MAX_FACE_FILE_BYTES) {
    throw new Error('Envie uma foto válida (máximo 6 MB).');
  }
  // Reduz + converte para WebP antes de subir: a foto pesa 90–95% menos no
  // Storage e continua igual no visual e como referência para a IA.
  const prepared = await prepareImageForUpload(file);
  const mimeType = prepared.mimeType;
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const storagePath = `${profileId}/${crypto.randomUUID()}.${extensionForMime(mimeType)}`;
  const { error: uploadError } = await supabase.storage
    .from(FACE_REFERENCES_BUCKET)
    .upload(storagePath, prepared.blob, { contentType: mimeType, upsert: false });
  if (uploadError) throw toError(uploadError, 'Não foi possível enviar sua foto.');
  const { data, error } = await supabase
    .from('face_references')
    .insert({
      user_id: profileId,
      filename: storagePath,
      mime_type: mimeType,
      consent_accepted: true,
      consent_timestamp: new Date().toISOString(),
      face_verified: false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    // Evita arquivo órfão no bucket se a linha não foi criada.
    await supabase.storage.from(FACE_REFERENCES_BUCKET).remove([storagePath]);
    throw toError(error, 'Não foi possível salvar sua foto de referência.');
  }
  // Marco de convite: a 1ª foto de referência paga +5 para quem indicou e +5
  // para quem foi indicado. Nunca quebra o envio (a função devolve false).
  const milestonePaid = await checkInviteMilestone('first_photo');
  if (milestonePaid) notifyCreditsChanged();
  const url = await getSignedMediaUrl(FACE_REFERENCES_BUCKET, storagePath);
  return faceFromRow(data as Row, url);
}

export async function deleteFace(id: string): Promise<void> {
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('face_references')
    .select('filename')
    .eq('id', id)
    .eq('user_id', profileId)
    .maybeSingle();
  if (error) throw toError(error, 'Não foi possível excluir a foto.');
  if (!data) throw new Error('Referência facial não encontrada.');
  const filename = String((data as Row).filename ?? '');
  const { error: deleteError } = await supabase
    .from('face_references')
    .delete()
    .eq('id', id)
    .eq('user_id', profileId);
  if (deleteError) throw toError(deleteError, 'Não foi possível excluir a foto.');
  if (filename) {
    await supabase.storage.from(FACE_REFERENCES_BUCKET).remove([filename]);
  }
}

// --------------------------- gerações --------------------------------------

export async function listGenerations(): Promise<GenerationItem[]> {
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw toError(error, 'Não foi possível carregar suas fotos.');
  return Promise.all(((data ?? []) as Row[]).map((row) => resolveGenerationUrls(row)));
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('generations')
    .select('favorite')
    .eq('id', id)
    .eq('user_id', profileId)
    .maybeSingle();
  if (error) throw toError(error, 'Não foi possível atualizar a foto.');
  if (!data) throw new Error('Fotografia não encontrada.');
  const next = !Boolean((data as Row).favorite);
  const { error: updateError } = await supabase
    .from('generations')
    .update({ favorite: next })
    .eq('id', id)
    .eq('user_id', profileId);
  if (updateError) throw toError(updateError, 'Não foi possível atualizar a foto.');
  return next;
}

// ------------------------- galeria da comunidade ---------------------------

export interface CommunityGalleryItem {
  id: string;
  scenarioTitle: string;
  categoryName: string;
  /** Só o primeiro nome do autor (privacidade). */
  authorName: string;
  /** URL assinada do Storage. */
  imageUrl: string;
  likesCount: number;
  likedByMe: boolean;
  createdAt: string;
}

/**
 * Fotos públicas da Galeria da Comunidade (só is_public + completed, 30
 * mais recentes). A leitura passa pela função get_community_gallery(), que
 * devolve só o primeiro nome do autor — a tabela users nunca é exposta.
 */
export async function listCommunityGallery(): Promise<CommunityGalleryItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_community_gallery');
  if (error) throw toError(error, 'Não foi possível carregar a galeria.');
  const resolved = await Promise.all(
    ((data ?? []) as Row[]).map(async (row) => {
      try {
        return {
          id: String(row.id),
          scenarioTitle: asString(row.scenario_title),
          categoryName: asString(row.category_name),
          authorName: asString(row.author_first_name, 'PromptFace'),
          imageUrl: await getSignedMediaUrl(
            GENERATED_IMAGES_BUCKET,
            String(row.filename ?? '')
          ),
          likesCount: asNumber(row.likes_count, 0),
          likedByMe: row.liked_by_me === true,
          createdAt: String(row.created_at ?? ''),
        } satisfies CommunityGalleryItem;
      } catch {
        // Arquivo sem acesso (ex.: removido): a foto some da galeria.
        return null;
      }
    })
  );
  return resolved.filter((item): item is CommunityGalleryItem => item !== null);
}

/**
 * Curte (ou descurte) uma foto pública. Retorna o novo estado. Exige login.
 */
export async function toggleCommunityLike(generationId: string): Promise<boolean> {
  let profileId: string;
  try {
    profileId = await getMyProfileId();
  } catch {
    throw new Error('Você precisa estar logado para curtir.');
  }
  const supabase = getSupabase();
  const { data: existing, error: lookupError } = await supabase
    .from('community_likes')
    .select('id')
    .eq('generation_id', generationId)
    .eq('user_id', profileId)
    .maybeSingle();
  if (lookupError) throw toError(lookupError, 'Não foi possível curtir a foto.');
  if (existing) {
    const { error } = await supabase
      .from('community_likes')
      .delete()
      .eq('id', String((existing as Row).id));
    if (error) throw toError(error, 'Não foi possível remover a curtida.');
    return false;
  }
  const { error } = await supabase
    .from('community_likes')
    .insert({ generation_id: generationId, user_id: profileId });
  if (error) throw toError(error, 'Não foi possível curtir a foto.');
  return true;
}

/**
 * Publica (ou tira) a própria geração da Galeria da Comunidade.
 * Retorna a geração atualizada, ou false se ela não for sua.
 */
export async function setGenerationPublic(
  generationId: string,
  isPublic: boolean
): Promise<GenerationItem | false> {
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('generations')
    .update({ is_public: isPublic })
    .eq('id', generationId)
    .eq('user_id', profileId)
    .select()
    .maybeSingle();
  if (error) throw toError(error, 'Não foi possível atualizar a foto.');
  if (!data) return false;
  return resolveGenerationUrls(data as Row);
}

export async function moveGenerationToFolder(
  id: string,
  folderId: string | null
): Promise<string | null> {
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  if (folderId) {
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', profileId)
      .maybeSingle();
    if (folderError) throw toError(folderError, 'Não foi possível mover a foto.');
    if (!folder) throw new Error('Pasta não encontrada.');
  }
  const { error } = await supabase
    .from('generations')
    .update({ folder_id: folderId })
    .eq('id', id)
    .eq('user_id', profileId);
  if (error) throw toError(error, 'Não foi possível mover a foto.');
  return folderId;
}

export async function batchMoveToFolder(
  generationIds: string[],
  folderId: string | null
): Promise<string[]> {
  if (generationIds.length === 0) {
    throw new Error('Selecione pelo menos uma fotografia.');
  }
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  if (folderId) {
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', profileId)
      .maybeSingle();
    if (folderError) throw toError(folderError, 'Não foi possível mover as fotos.');
    if (!folder) throw new Error('Pasta de destino não encontrada.');
  }
  const { error } = await supabase
    .from('generations')
    .update({ folder_id: folderId })
    .in('id', generationIds)
    .eq('user_id', profileId);
  if (error) throw toError(error, 'Não foi possível mover as fotos.');
  return generationIds;
}

export async function setGenerationTags(id: string, tags: string[]): Promise<string[]> {
  const normalized = normalizeTagList(tags);
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { error } = await supabase
    .from('generations')
    .update({ tags: normalized })
    .eq('id', id)
    .eq('user_id', profileId);
  if (error) throw toError(error, 'Não foi possível salvar as tags.');
  return normalized;
}

export async function batchSetTags(
  generationIds: string[],
  tag: string,
  action: 'add' | 'remove'
): Promise<Array<{ id: string; tags: string[] }>> {
  if (generationIds.length === 0) {
    throw new Error('Selecione pelo menos uma fotografia.');
  }
  const normalizedTag = normalizeTagName(tag);
  if (!normalizedTag) {
    throw new Error('Informe uma tag válida (2 a 24 caracteres).');
  }
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('generations')
    .select('id, tags')
    .in('id', generationIds)
    .eq('user_id', profileId);
  if (error) throw toError(error, 'Não foi possível atualizar as tags.');
  const tagKey = normalizedTag.toLowerCase();
  const updated: Array<{ id: string; tags: string[] }> = [];
  for (const row of (data ?? []) as Row[]) {
    const current = normalizeTagList(row.tags);
    let next = current;
    if (action === 'remove') {
      next = current.filter((t) => t.toLowerCase() !== tagKey);
    } else if (!current.some((t) => t.toLowerCase() === tagKey)) {
      if (current.length < MAX_TAGS_PER_PHOTO) next = [...current, normalizedTag];
    }
    if (next !== current) {
      const { error: updateError } = await supabase
        .from('generations')
        .update({ tags: next })
        .eq('id', String(row.id))
        .eq('user_id', profileId);
      if (updateError) throw toError(updateError, 'Não foi possível atualizar as tags.');
    }
    updated.push({ id: String(row.id), tags: next });
  }
  return updated;
}

async function removeGenerationFiles(rows: Row[]): Promise<void> {
  const supabase = getSupabase();
  const paths = rows.flatMap((row) => {
    const out: string[] = [];
    if (typeof row.filename === 'string' && row.filename) out.push(row.filename);
    const versions = Array.isArray(row.versions) ? (row.versions as Row[]) : [];
    for (const v of versions) {
      if (typeof v.filename === 'string' && v.filename) out.push(v.filename);
    }
    return out;
  });
  if (paths.length > 0) {
    await supabase.storage.from(GENERATED_IMAGES_BUCKET).remove(paths);
  }
}

export async function batchDeleteGenerations(generationIds: string[]): Promise<string[]> {
  if (generationIds.length === 0) {
    throw new Error('Selecione pelo menos uma fotografia para excluir.');
  }
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('generations')
    .select('id, filename, versions')
    .in('id', generationIds)
    .eq('user_id', profileId);
  if (error) throw toError(error, 'Não foi possível excluir as fotos.');
  const rows = (data ?? []) as Row[];
  await removeGenerationFiles(rows);
  const { error: deleteError } = await supabase
    .from('generations')
    .delete()
    .in('id', generationIds)
    .eq('user_id', profileId);
  if (deleteError) throw toError(deleteError, 'Não foi possível excluir as fotos.');
  return rows.map((row) => String(row.id));
}

export async function deleteGeneration(id: string): Promise<void> {
  await batchDeleteGenerations([id]);
}

// --------------------------- pastas ----------------------------------------

export async function listFolders(): Promise<FolderItem[]> {
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('folders')
    .select('id, name, created_at')
    .eq('user_id', profileId)
    .order('created_at', { ascending: true });
  if (error) throw toError(error, 'Não foi possível carregar suas pastas.');
  return ((data ?? []) as Row[]).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    createdAt: String(row.created_at ?? ''),
  }));
}

export async function createFolder(rawName: unknown): Promise<FolderItem> {
  const existing = await listFolders();
  const validation = validateNewFolderName(existing, rawName);
  if (!validation.ok) throw new Error(validation.error);
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('folders')
    .insert({
      user_id: profileId,
      name: validation.name,
      created_at: new Date().toISOString(),
    })
    .select('id, name, created_at')
    .single();
  if (error) throw toError(error, 'Não foi possível criar a pasta.');
  const row = data as Row;
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

export async function renameFolder(id: string, rawName: unknown): Promise<FolderItem> {
  const existing = await listFolders();
  const validation = validateRenameFolder(existing, id, rawName);
  if (!validation.ok) throw new Error(validation.error);
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('folders')
    .update({ name: validation.name })
    .eq('id', id)
    .eq('user_id', profileId)
    .select('id, name, created_at')
    .single();
  if (error) throw toError(error, 'Não foi possível renomear a pasta.');
  const row = data as Row;
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

export async function deleteFolder(id: string): Promise<string> {
  const profileId = await getMyProfileId();
  const supabase = getSupabase();
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', id)
    .eq('user_id', profileId);
  if (error) throw toError(error, 'Não foi possível excluir a pasta.');
  return id;
}

// --------------------- créditos e assinatura -------------------------------

export async function getCredits(): Promise<{ credits: number; ledger: CreditEntryItem[] }> {
  const me = await getMyProfile();
  if (!me) throw new Error('Faça login para acessar esta área.');
  const profileId = me.id;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('*')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw toError(error, 'Não foi possível carregar seu extrato.');
  return { credits: me.credits, ledger: ((data ?? []) as Row[]).map(ledgerFromRow) };
}

export interface SubscriptionInfo {
  planId: PlanId;
  billingInterval: BillingInterval;
  subscriptionStatus: AuthUser['subscriptionStatus'];
  currentPeriodEnd?: string;
  nextMonthlyCreditGrantAt?: string;
  plan: PlanDefinition | null;
  payments: PaymentItem[];
}

export async function getSubscription(): Promise<SubscriptionInfo> {
  const me = await getMyProfile();
  if (!me) throw new Error('Faça login para acessar esta área.');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', me.id)
    .order('created_at', { ascending: false });
  if (error) throw toError(error, 'Não foi possível carregar sua assinatura.');
  const plan = INITIAL_PLANS.find((p) => p.id === me.planId) ?? null;
  return {
    planId: me.planId,
    billingInterval: me.billingInterval ?? 'monthly',
    subscriptionStatus: me.subscriptionStatus,
    currentPeriodEnd: me.currentPeriodEnd,
    nextMonthlyCreditGrantAt: me.nextMonthlyCreditGrantAt,
    plan,
    payments: ((data ?? []) as Row[]).map(paymentFromRow),
  };
}

// --------------------------- lista de espera -------------------------------

export async function joinWaitlist(
  email: string,
  feature: 'generation' | 'payments' | 'general'
): Promise<{ ok: true }> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Informe um e-mail válido.');
  }
  const supabase = getSupabase();
  const { error } = await supabase.from('waitlist').upsert(
    {
      email: normalized,
      feature,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'email,feature', ignoreDuplicates: true }
  );
  if (error) throw toError(error, 'Não foi possível entrar na lista de espera.');
  return { ok: true };
}

// --------------------- config pública (manutenção) -------------------------

export interface PublicSettings {
  maintenance: MaintenanceConfig;
  falQuota: FalQuotaSummary;
}

/** Manutenção e cota Fal lidas da tabela settings (leitura pública liberada). */
export async function fetchPublicSettings(): Promise<PublicSettings> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['maintenance', 'fal_quota']);
  if (error) {
    return {
      maintenance: DEFAULT_MAINTENANCE_CONFIG,
      falQuota: getFalQuotaSummary(
        { falImagesUsed: 0, falFreeLimit: DEFAULT_FAL_FREE_LIMIT },
        { active: false, inFlight: 0 }
      ),
    };
  }
  const byKey = new Map(
    ((data ?? []) as Row[]).map((row) => [String(row.key), row.value as never])
  );
  return {
    maintenance: normalizeMaintenanceConfig(
      (byKey.get('maintenance') as Partial<MaintenanceConfig> | undefined) ??
        DEFAULT_MAINTENANCE_CONFIG
    ),
    falQuota: getFalQuotaSummary(
      normalizeFalQuotaState(
        (byKey.get('fal_quota') as Partial<{ falImagesUsed: number; falFreeLimit: number }> | undefined) ?? {
          falImagesUsed: 0,
          falFreeLimit: DEFAULT_FAL_FREE_LIMIT,
        }
      ),
      { active: false, inFlight: 0 }
    ),
  };
}

// -------------------------------- admin ------------------------------------

function computeAdminMetrics(
  users: AuthUser[],
  generations: GenerationItem[],
  payments: PaymentItem[]
): AdminMetrics {
  const activeSubs = users.filter((u) => u.subscriptionStatus === 'active');
  const canceledSubs = users.filter((u) => u.subscriptionStatus === 'canceled');
  const mrr = activeSubs.reduce((sum, u) => {
    const plan = INITIAL_PLANS.find((p) => p.id === u.planId);
    if (!plan) return sum;
    const pricing = getPlanCyclePricing(plan, u.billingInterval ?? 'monthly');
    return sum + pricing.monthlyEquivalentBrl;
  }, 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const generationsToday = generations.filter((g) => g.createdAt.startsWith(todayStr)).length;
  const totalCostUsd = generations.reduce((sum, g) => sum + (g.estimatedCostUsd || 0), 0);
  const avgCostUsd = generations.length > 0 ? totalCostUsd / generations.length : 0;
  const totalRevenueBrl = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amountBrl, 0);
  return {
    totalUsers: users.length,
    activeSubscriptions: activeSubs.length,
    canceledSubscriptions: canceledSubs.length,
    mrrBrl: mrr,
    totalRevenueBrl,
    totalGenerations: generations.length,
    generationsToday,
    avgCostUsd,
    estimatedMarginPct: mrr > 0 ? Math.max(0, ((mrr - totalCostUsd * 5.8) / mrr) * 100) : 0,
  };
}

/**
 * Catálogo (categorias + cenários) — fonte: tabelas public.categories e
 * public.scenarios no Supabase, com fallback para o código
 * (CATEGORIES / INITIAL_SCENARIOS) se a leitura falhar ou vier vazia.
 * O resultado fica em cache no módulo: as páginas leem o catálogo do código
 * no primeiro paint e trocam pelos dados do banco quando chegam, sem loading.
 * A escrita (criar/editar/excluir) é só do admin, via RLS (is_admin()).
 */
export interface LoadedCatalog {
  categories: CategoryItem[];
  scenarios: ScenarioItem[];
}

let catalogCache: LoadedCatalog | null = null;
let catalogPromise: Promise<LoadedCatalog | null> | null = null;

function categoryFromRow(row: Row): CategoryItem {
  return {
    id: asString(row.id),
    name: asString(row.name),
    slug: asString(row.slug),
    description: asString(row.description),
    image: asString(row.image),
  };
}

function scenarioFromRow(row: Row): ScenarioItem {
  return {
    id: asString(row.id),
    categoryId: asString(row.category_id),
    categoryName: asString(row.category_name),
    title: asString(row.title),
    description: asString(row.description),
    image: asString(row.image),
    defaultOutfit: asString(row.default_outfit),
    defaultEnvironment: asString(row.default_environment),
    defaultPose: asString(row.default_pose),
    defaultLighting: asString(row.default_lighting),
    defaultStyle: asString(row.default_style),
    popular: row.popular === true,
    active: row.active !== false,
  };
}

export function loadCatalog(): Promise<LoadedCatalog | null> {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    try {
      const supabase = getSupabase();
      const [categoriesRes, scenariosRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('scenarios').select('*').order('sort_order', { ascending: true }),
      ]);
      if (categoriesRes.error || scenariosRes.error) return null;
      const categories = ((categoriesRes.data ?? []) as Row[]).map(categoryFromRow);
      const scenarios = ((scenariosRes.data ?? []) as Row[]).map(scenarioFromRow);
      if (categories.length === 0 || scenarios.length === 0) return null;
      catalogCache = { categories, scenarios };
      return catalogCache;
    } catch {
      return null;
    }
  })();
  return catalogPromise;
}

/**
 * Visão geral do admin — mesma resposta que /api/admin/overview devolvia.
 * O catálogo vem do banco (loadCatalog, com fallback para o código);
 * os planos continuam no código (INITIAL_PLANS).
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = getSupabase();
  const catalog = await loadCatalog();
  const [usersRes, generationsRes, paymentsRes, noticesRes, moderationRes, waitlistRes, settingsRes] =
    await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: true }),
      supabase
        .from('generations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
      supabase.from('notices').select('*').order('created_at', { ascending: false }),
      supabase
        .from('moderation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('waitlist').select('id', { count: 'exact', head: true }),
      supabase.from('settings').select('key, value').in('key', ['maintenance', 'fal_quota']),
    ]);
  const firstError = [
    usersRes,
    generationsRes,
    paymentsRes,
    noticesRes,
    moderationRes,
    waitlistRes,
    settingsRes,
  ].find((r) => r.error);
  if (firstError?.error) {
    throw toError(firstError.error, 'Não foi possível carregar o painel de administração.');
  }
  const users = ((usersRes.data ?? []) as Row[]).map(userFromRow);
  const generations = await Promise.all(
    ((generationsRes.data ?? []) as Row[]).map((row) => resolveGenerationUrls(row))
  );
  const payments = ((paymentsRes.data ?? []) as Row[]).map(paymentFromRow);
  const settingsByKey = new Map(
    ((settingsRes.data ?? []) as Row[]).map((row) => [String(row.key), row.value as never])
  );
  const maintenance = normalizeMaintenanceConfig(
    (settingsByKey.get('maintenance') as Partial<MaintenanceConfig> | undefined) ??
      DEFAULT_MAINTENANCE_CONFIG
  );
  const falQuota = getFalQuotaSummary(
    normalizeFalQuotaState(
      (settingsByKey.get('fal_quota') as Partial<{ falImagesUsed: number; falFreeLimit: number }> | undefined) ?? {
        falImagesUsed: 0,
        falFreeLimit: DEFAULT_FAL_FREE_LIMIT,
      }
    ),
    { active: false, inFlight: 0 }
  );
  return {
    metrics: computeAdminMetrics(users, generations, payments),
    users,
    generations,
    categories: catalog?.categories ?? CATEGORIES,
    scenarios: catalog?.scenarios ?? INITIAL_SCENARIOS,
    plans: INITIAL_PLANS,
    notices: ((noticesRes.data ?? []) as Row[]).map(noticeFromRow),
    moderationLogs: ((moderationRes.data ?? []) as Row[]).map(moderationFromRow),
    waitlistCount: waitlistRes.count ?? 0,
    maintenance,
    falQuota,
    dailyStats30d: buildAdminDailyStats({ users, generations, days: 30 }),
  };
}

export async function adminSetFalQuota(
  falFreeLimit: number,
  falImagesUsed: number
): Promise<FalQuotaSummary> {
  const supabase = getSupabase();
  const next = normalizeFalQuotaState({
    falFreeLimit: Math.max(0, Math.floor(falFreeLimit)),
    falImagesUsed: Math.max(0, Math.floor(falImagesUsed)),
    updatedAt: new Date().toISOString(),
  });
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'fal_quota', value: next }, { onConflict: 'key' });
  if (error) throw toError(error, 'Não foi possível salvar a cota Fal.');
  return getFalQuotaSummary(next, { active: false, inFlight: 0 });
}

export async function adminSetMaintenance(
  config: Partial<MaintenanceConfig>
): Promise<MaintenanceConfig> {
  const supabase = getSupabase();
  const { data, error: readError } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'maintenance')
    .maybeSingle();
  if (readError) throw toError(readError, 'Não foi possível ler a manutenção.');
  const current = normalizeMaintenanceConfig(
    ((data as Row | null)?.value as Partial<MaintenanceConfig> | undefined) ??
      DEFAULT_MAINTENANCE_CONFIG
  );
  const next = normalizeMaintenanceConfig({
    enabled: typeof config.enabled === 'boolean' ? config.enabled : current.enabled,
    title: typeof config.title === 'string' ? config.title : current.title,
    message: typeof config.message === 'string' ? config.message : current.message,
    estimatedReturn:
      typeof config.estimatedReturn === 'string'
        ? config.estimatedReturn
        : current.estimatedReturn,
    updatedAt: new Date().toISOString(),
  });
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'maintenance', value: next }, { onConflict: 'key' });
  if (error) throw toError(error, 'Não foi possível salvar a manutenção.');
  return next;
}

/** Ajuste de créditos por um admin (atômico via RPC no banco). */
export async function adminAdjustCredits(
  userId: string,
  delta: number,
  reason: string
): Promise<AuthUser> {
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('Informe uma variação válida de créditos.');
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('admin_adjust_credits', {
    p_user_id: userId,
    p_delta: Math.trunc(delta),
    p_reason: reason.trim() || 'Ajuste administrativo',
  });
  if (error) throw toError(error, 'Não foi possível ajustar os créditos.');
  if (!data) throw new Error('Usuário não encontrado.');
  return userFromRow(data as Row);
}

/** Conversão de convite: quem entrou pelo link de alguém. */
export interface InviteItem {
  id: string;
  inviteCode: string;
  invitedName: string;
  invitedEmail: string;
  status: 'pending' | 'converted';
  rewardCredits: number;
  /** Bônus de marco (+5) já pago para este convite. */
  milestoneRewardPaid: boolean;
  /** Bônus de assinatura (+30) já pago para este convite. */
  subscriptionBonusPaid: boolean;
  createdAt: string;
  convertedAt: string | null;
}

/** Código de convite do usuário logado (cria na primeira vez que abrir /convites). */
export async function getMyInviteCode(): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_or_create_invite_code');
  if (error) throw toError(error, 'Não foi possível carregar seu link de convite.');
  if (typeof data !== 'string' || !data) {
    throw new Error('Não foi possível carregar seu link de convite.');
  }
  return data;
}

/** Convites do usuário logado (RLS filtra só as próprias conversões). */
export async function getMyInvites(): Promise<InviteItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw toError(error, 'Não foi possível carregar seus convites.');
  return ((data ?? []) as Row[]).map((row) => ({
    id: String(row.id),
    inviteCode: String(row.invite_code ?? ''),
    invitedName: String(row.invited_name ?? row.invited_email ?? 'Convidado'),
    invitedEmail: String(row.invited_email ?? ''),
    status: row.status === 'pending' ? 'pending' : 'converted',
    rewardCredits: Number(row.reward_credits ?? 0),
    milestoneRewardPaid: row.milestone_reward_paid === true,
    subscriptionBonusPaid: row.subscription_bonus_paid === true,
    createdAt: String(row.created_at ?? ''),
    convertedAt: row.converted_at ? String(row.converted_at) : null,
  }));
}

/** Paga o bônus de marco (+5/+5) quando o usuário atinge um marco real. */
export async function checkInviteMilestone(
  milestone: 'first_photo' | 'first_generation'
): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('check_invite_milestone', {
      p_milestone: milestone,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/**
 * Bônus de assinatura (+30 convidador / +10 amigo). Fase 2: chamar no
 * webhook do Stripe quando o pagamento do 1º mês confirmar.
 */
export async function grantSubscriptionReferralBonus(
  userId: string
): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('grant_subscription_referral_bonus', {
      p_user_id: userId,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export async function adminCreateNotice(
  title: string,
  message: string
): Promise<NoticeItem> {
  const cleanTitle = title.trim();
  const cleanMessage = message.trim();
  if (!cleanTitle || !cleanMessage) {
    throw new Error('Título e mensagem são obrigatórios.');
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notices')
    .insert({
      title: cleanTitle,
      message: cleanMessage,
      active: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw toError(error, 'Não foi possível criar o aviso.');
  return noticeFromRow(data as Row);
}

export async function adminDeleteNotice(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('notices').delete().eq('id', id);
  if (error) throw toError(error, 'Não foi possível excluir o aviso.');
}
