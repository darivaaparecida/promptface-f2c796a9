/**
 * Seed do catálogo no Supabase — PromptFace.
 *
 * Insere as 14 categorias, os 84 cenários e os 2 planos EXATAMENTE como estão
 * em src/shared/catalog.ts (nada inventado), além das configurações iniciais
 * de maintenance e fal_quota. Pode rodar mais de uma vez (upsert por id).
 *
 * Uso:
 *   SUPABASE_URL=https://<projeto>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<chave service_role> \
 *   npx tsx scripts/seed-supabase.ts
 *
 * As chaves vêm de variáveis de ambiente — nunca coloque valores reais aqui.
 */
import { createClient } from '@supabase/supabase-js';
import {
  CATEGORIES,
  INITIAL_PLANS,
  INITIAL_SCENARIOS,
} from '../src/shared/catalog.ts';
import { DEFAULT_MAINTENANCE_CONFIG } from '../src/shared/adminStats.ts';
import { DEFAULT_FAL_FREE_LIMIT } from '../src/shared/providerQuota.ts';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Faltam variáveis de ambiente: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main(): Promise<void> {
  const categories = CATEGORIES.map((c, i) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    sort_order: i,
  }));
  const { error: catError } = await supabase.from('categories').upsert(categories);
  if (catError) throw new Error(`categories: ${catError.message}`);
  console.log(`categories: ${categories.length} inseridas/atualizadas`);

  const scenarios = INITIAL_SCENARIOS.map((s, i) => ({
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
    sort_order: i,
  }));
  const { error: scenError } = await supabase.from('scenarios').upsert(scenarios);
  if (scenError) throw new Error(`scenarios: ${scenError.message}`);
  console.log(`scenarios: ${scenarios.length} inseridos/atualizados`);

  const plans = INITIAL_PLANS.map((p, i) => ({
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
    sort_order: i,
  }));
  const { error: planError } = await supabase.from('plans').upsert(plans);
  if (planError) throw new Error(`plans: ${planError.message}`);
  console.log(`plans: ${plans.length} inseridos/atualizados`);

  const settings = [
    { key: 'maintenance', value: { ...DEFAULT_MAINTENANCE_CONFIG } },
    {
      key: 'fal_quota',
      value: { falImagesUsed: 0, falFreeLimit: DEFAULT_FAL_FREE_LIMIT },
    },
  ];
  const { error: settingsError } = await supabase.from('settings').upsert(settings);
  if (settingsError) throw new Error(`settings: ${settingsError.message}`);
  console.log('settings: maintenance + fal_quota inseridas');

  console.log('Seed concluído.');
}

main().catch((err) => {
  console.error('Seed falhou:', err instanceof Error ? err.message : err);
  process.exit(1);
});
