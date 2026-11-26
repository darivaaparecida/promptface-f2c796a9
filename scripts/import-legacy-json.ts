/**
 * Importação única do JSON antigo (data/promptface-db.json) para o Supabase.
 *
 * Esta é a "leitura de emergência" do JSON local: o servidor NÃO lê nem
 * escreve mais esse arquivo. Rode este script UMA vez, depois de rodar o SQL
 * de migração (supabase/migrations/...) e o seed (scripts/seed-supabase.ts).
 *
 * O que ele importa: usuários, perfis visuais, referências faciais, gerações
 * (com versões), pastas, extrato de créditos, pagamentos, moderação, avisos,
 * waitlist, maintenance e fal_quota — e envia os arquivos de imagem
 * (data/uploads/* e data/generated/*) para os buckets privados.
 *
 * ATENÇÃO — senhas NÃO migram: o hash scrypt do JSON é descartado. Os
 * usuários importados ficam com auth_user_id NULL e NÃO conseguem entrar com
 * a senha antiga. Para recuperar o acesso: criar conta nova com o mesmo
 * e-mail NÃO funciona (o e-mail já existe no perfil) — o caminho é o
 * claim-admin (com ADMIN_PASSWORD) para a conta de teste admin, ou apagar
 * o perfil importado e cadastrar de novo. Veja o relatório da migração.
 *
 * IDs: ids antigos que não são UUID (ex.: 'user-teste-admin') ganham um UUID
 * novo, e todas as referências (userId, folderId) são reescritas juntas.
 *
 * Uso:
 *   SUPABASE_URL=https://<projeto>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<chave service_role> \
 *   npx tsx scripts/import-legacy-json.ts [caminho-do-json]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
const JSON_PATH = path.resolve(
  process.cwd(),
  process.argv[2] || 'data/promptface-db.json'
);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Faltam variáveis de ambiente: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.'
  );
  process.exit(1);
}
if (!fs.existsSync(JSON_PATH)) {
  console.error(`Arquivo JSON não encontrado: ${JSON_PATH}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const userIdMap = new Map<string, string>();
const folderIdMap = new Map<string, string>();

function remapId(oldId: string, map: Map<string, string>): string {
  const existing = map.get(oldId);
  if (existing) return existing;
  const next = UUID_RE.test(oldId) ? oldId : crypto.randomUUID();
  map.set(oldId, next);
  return next;
}

function toIso(value: unknown): string {
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

async function uploadFileIfExists(
  bucket: string,
  localDir: string,
  filename: string,
  mimeType: string
): Promise<void> {
  const fullPath = path.resolve(localDir, filename);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  [aviso] arquivo local não encontrado, pulando: ${filename}`);
    return;
  }
  const buffer = fs.readFileSync(fullPath);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, { contentType: mimeType, upsert: true });
  if (error) {
    console.warn(`  [aviso] falha ao enviar ${filename}: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) as Record<string, any>;
  const dataDir = path.dirname(JSON_PATH);
  const uploadsDir = path.resolve(dataDir, 'uploads');
  const generatedDir = path.resolve(dataDir, 'generated');

  // Usuários (sem senha — o hash scrypt é descartado de propósito).
  const users = (raw.users ?? []).map((u: any) => ({
    id: remapId(String(u.id), userIdMap),
    auth_user_id: null,
    name: u.name ?? '',
    email: String(u.email ?? '').toLowerCase(),
    role: u.role === 'admin' ? 'admin' : 'user',
    email_verified: Boolean(u.emailVerified),
    verification_code: u.verificationCode ?? null,
    reset_code: u.resetCode ?? null,
    reset_expires_at: u.resetExpiresAt ?? null,
    credits: Number(u.credits ?? 0),
    plan_id: u.planId ?? 'free_trial',
    subscription_status: u.subscriptionStatus ?? 'inactive',
    stripe_customer_id: u.stripeCustomerId ?? null,
    stripe_subscription_id: u.stripeSubscriptionId ?? null,
    current_period_end: u.currentPeriodEnd ?? null,
    preferred_model: u.preferredModel ?? 'auto',
    created_at: toIso(u.createdAt),
  }));
  if (users.length) {
    const { error } = await supabase.from('users').upsert(users);
    if (error) throw new Error(`users: ${error.message}`);
  }
  console.log(`users: ${users.length} importados (sem senha — ver aviso no cabeçalho)`);

  // Perfis visuais.
  const profiles = Object.entries((raw.visualProfiles ?? {}) as Record<string, any>).map(
    ([userId, p]: [string, any]) => ({
      user_id: remapId(userId, userIdMap),
      eye_color: p.eyeColor ?? null,
      hair_color_style: p.hairColorStyle ?? null,
      hair_type: p.hairType ?? null,
      beard_mustache: p.beardMustache ?? null,
      skin_tone: p.skinTone ?? null,
      facial_features: p.facialFeatures ?? null,
      height_body_type: p.heightBodyType ?? null,
      other_characteristics: p.otherCharacteristics ?? null,
      preferred_model: p.preferredModel ?? 'auto',
      updated_at: toIso(p.updatedAt),
    })
  );
  if (profiles.length) {
    const { error } = await supabase.from('visual_profiles').upsert(profiles);
    if (error) throw new Error(`visual_profiles: ${error.message}`);
  }
  console.log(`visual_profiles: ${profiles.length} importados`);

  // Pastas (antes das gerações, que referenciam folderId).
  const folders = (raw.folders ?? []).map((f: any) => ({
    id: remapId(String(f.id), folderIdMap),
    user_id: remapId(String(f.userId), userIdMap),
    name: f.name ?? '',
    created_at: toIso(f.createdAt),
  }));
  if (folders.length) {
    const { error } = await supabase.from('folders').upsert(folders);
    if (error) throw new Error(`folders: ${error.message}`);
  }
  console.log(`folders: ${folders.length} importadas`);

  // Referências faciais + upload dos arquivos.
  const faces = (raw.faceReferences ?? []).map((f: any) => ({
    id: UUID_RE.test(String(f.id)) ? String(f.id) : crypto.randomUUID(),
    user_id: remapId(String(f.userId), userIdMap),
    filename: f.filename,
    mime_type: f.mimeType ?? 'image/jpeg',
    consent_accepted: Boolean(f.consentAccepted),
    consent_timestamp: toIso(f.consentTimestamp),
    face_verified: Boolean(f.faceVerified),
    created_at: toIso(f.createdAt),
  }));
  for (const f of faces) {
    await uploadFileIfExists('face-references', uploadsDir, f.filename, f.mime_type);
  }
  if (faces.length) {
    const { error } = await supabase.from('face_references').upsert(faces);
    if (error) throw new Error(`face_references: ${error.message}`);
  }
  console.log(`face_references: ${faces.length} importadas`);

  // Gerações (+ versões) + upload dos arquivos.
  const generations = (raw.generations ?? []).map((g: any) => ({
    id: UUID_RE.test(String(g.id)) ? String(g.id) : crypto.randomUUID(),
    user_id: remapId(String(g.userId), userIdMap),
    mode: g.mode ?? 'preset',
    scenario_id: g.scenarioId ?? null,
    scenario_title: g.scenarioTitle ?? '',
    category_id: g.categoryId ?? '',
    category_name: g.categoryName ?? '',
    prompt_used: g.promptUsed ?? '',
    aspect_ratio: g.aspectRatio ?? '3:4',
    filename: g.filename,
    mime_type: g.mimeType ?? 'image/jpeg',
    cost_credits: Number(g.costCredits ?? 0),
    estimated_cost_usd: Number(g.estimatedCostUsd ?? 0),
    status: g.status ?? 'completed',
    provider: g.provider ?? '',
    model: g.model ?? '',
    favorite: Boolean(g.favorite),
    folder_id: g.folderId ? remapId(String(g.folderId), folderIdMap) : null,
    tags: Array.isArray(g.tags) ? g.tags : [],
    synth_id_marked: Boolean(g.synthIdMarked),
    versions: Array.isArray(g.versions)
      ? g.versions.map((v: any) => ({
          id: UUID_RE.test(String(v.id)) ? String(v.id) : crypto.randomUUID(),
          instruction: v.instruction ?? '',
          filename: v.filename,
          mimeType: v.mimeType ?? 'image/jpeg',
          createdAt: toIso(v.createdAt),
        }))
      : [],
    created_at: toIso(g.createdAt),
  }));
  for (const g of generations) {
    await uploadFileIfExists('generated-images', generatedDir, g.filename, g.mime_type);
    for (const v of g.versions as any[]) {
      await uploadFileIfExists('generated-images', generatedDir, v.filename, v.mimeType);
    }
  }
  if (generations.length) {
    const { error } = await supabase.from('generations').upsert(generations);
    if (error) throw new Error(`generations: ${error.message}`);
  }
  console.log(`generations: ${generations.length} importadas`);

  const ledger = (raw.creditLedger ?? []).map((e: any) => ({
    id: UUID_RE.test(String(e.id)) ? String(e.id) : crypto.randomUUID(),
    user_id: remapId(String(e.userId), userIdMap),
    type: e.type ?? 'reserve',
    operation: e.operation ?? '',
    amount: Number(e.amount ?? 0),
    balance_after: Number(e.balanceAfter ?? 0),
    description: e.description ?? '',
    created_at: toIso(e.createdAt),
  }));
  if (ledger.length) {
    const { error } = await supabase.from('credit_ledger').upsert(ledger);
    if (error) throw new Error(`credit_ledger: ${error.message}`);
  }
  console.log(`credit_ledger: ${ledger.length} importados`);

  const payments = (raw.payments ?? []).map((p: any) => ({
    id: UUID_RE.test(String(p.id)) ? String(p.id) : crypto.randomUUID(),
    user_id: remapId(String(p.userId), userIdMap),
    plan_id: p.planId ?? 'pro',
    amount_brl: Number(p.amountBrl ?? 0),
    status: p.status ?? 'pending',
    stripe_session_id: p.stripeSessionId ?? null,
    method: p.method ?? '',
    created_at: toIso(p.createdAt),
  }));
  if (payments.length) {
    const { error } = await supabase.from('payments').upsert(payments);
    if (error) throw new Error(`payments: ${error.message}`);
  }
  console.log(`payments: ${payments.length} importados`);

  const moderation = (raw.moderationLogs ?? []).map((m: any) => ({
    id: UUID_RE.test(String(m.id)) ? String(m.id) : crypto.randomUUID(),
    user_id: m.userId ? remapId(String(m.userId), userIdMap) : null,
    user_email: m.userEmail ?? null,
    input_snippet: m.inputSnippet ?? '',
    reason: m.reason ?? '',
    action: m.action ?? 'blocked_prompt',
    created_at: toIso(m.createdAt),
  }));
  if (moderation.length) {
    const { error } = await supabase.from('moderation_logs').upsert(moderation);
    if (error) throw new Error(`moderation_logs: ${error.message}`);
  }
  console.log(`moderation_logs: ${moderation.length} importados`);

  const notices = (raw.notices ?? []).map((n: any) => ({
    id: UUID_RE.test(String(n.id)) ? String(n.id) : crypto.randomUUID(),
    title: n.title ?? '',
    message: n.message ?? '',
    active: Boolean(n.active),
    created_at: toIso(n.createdAt),
  }));
  if (notices.length) {
    const { error } = await supabase.from('notices').upsert(notices);
    if (error) throw new Error(`notices: ${error.message}`);
  }
  console.log(`notices: ${notices.length} importados`);

  const waitlist = (raw.waitlist ?? []).map((w: any) => ({
    id: UUID_RE.test(String(w.id)) ? String(w.id) : crypto.randomUUID(),
    email: String(w.email ?? '').toLowerCase(),
    feature: w.feature ?? 'general',
    created_at: toIso(w.createdAt),
  }));
  if (waitlist.length) {
    const { error } = await supabase.from('waitlist').upsert(waitlist);
    if (error) throw new Error(`waitlist: ${error.message}`);
  }
  console.log(`waitlist: ${waitlist.length} importados`);

  // Catálogo do JSON (cenários criados pelo admin etc.) — upsert, sem apagar o seed.
  const categories = (raw.categories ?? []).map((c: any, i: number) => ({
    id: c.id,
    name: c.name ?? '',
    slug: c.slug ?? '',
    description: c.description ?? '',
    image: c.image ?? '',
    sort_order: i,
  }));
  if (categories.length) {
    const { error } = await supabase.from('categories').upsert(categories);
    if (error) throw new Error(`categories: ${error.message}`);
  }
  const scenarios = (raw.scenarios ?? []).map((s: any, i: number) => ({
    id: s.id,
    category_id: s.categoryId ?? '',
    category_name: s.categoryName ?? '',
    title: s.title ?? '',
    description: s.description ?? '',
    image: s.image ?? '',
    default_outfit: s.defaultOutfit ?? '',
    default_environment: s.defaultEnvironment ?? '',
    default_pose: s.defaultPose ?? '',
    default_lighting: s.defaultLighting ?? '',
    default_style: s.defaultStyle ?? '',
    popular: Boolean(s.popular),
    active: s.active !== false,
    sort_order: i,
  }));
  if (scenarios.length) {
    const { error } = await supabase.from('scenarios').upsert(scenarios);
    if (error) throw new Error(`scenarios: ${error.message}`);
  }
  const plans = (raw.plans ?? []).map((p: any, i: number) => ({
    id: p.id,
    name: p.name ?? '',
    audience: p.audience ?? '',
    price_brl: Number(p.priceBrl ?? 0),
    price_formatted: p.priceFormatted ?? '',
    credits_monthly: Number(p.creditsMonthly ?? 0),
    max_photos_monthly: Number(p.maxPhotosMonthly ?? 0),
    description: p.description ?? '',
    features: Array.isArray(p.features) ? p.features : [],
    highlighted: Boolean(p.highlighted),
    sort_order: i,
  }));
  if (plans.length) {
    const { error } = await supabase.from('plans').upsert(plans);
    if (error) throw new Error(`plans: ${error.message}`);
  }
  console.log(
    `catálogo do JSON: ${categories.length} categorias, ${scenarios.length} cenários, ${plans.length} planos`
  );

  // Configurações.
  const settings: { key: string; value: unknown }[] = [];
  if (raw.maintenance) settings.push({ key: 'maintenance', value: raw.maintenance });
  if (raw.falQuota) settings.push({ key: 'fal_quota', value: raw.falQuota });
  if (settings.length) {
    const { error } = await supabase.from('settings').upsert(settings);
    if (error) throw new Error(`settings: ${error.message}`);
  }
  console.log(`settings: ${settings.length} chaves importadas`);

  console.log('Importação concluída.');
  console.log(
    'Lembrete: usuários importados NÃO têm senha no Supabase Auth. ' +
      'A conta de teste admin (teste@promptface.com.br) só volta a entrar via claim-admin.'
  );
}

main().catch((err) => {
  console.error('Importação falhou:', err instanceof Error ? err.message : err);
  process.exit(1);
});
