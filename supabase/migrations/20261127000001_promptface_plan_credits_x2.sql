-- PromptFace — migração 7: dobrar as fotos dos planos (decisão 27/11/2026).
-- O Nano Banana 2.1 custa ~US$ 0,04/foto no fal.ai, então o volume mensal
-- dobra sem mudar os preços: Essencial 15 → 30 fotos (300 créditos),
-- PRO 40 → 80 fotos (800 créditos), PREMIUM 80 → 160 fotos (1.600 créditos).
-- O teste grátis continua 10 créditos (1 foto) — não muda aqui.
-- Idempotente: UPDATE por id, pode rodar de novo sem efeito.

update public.plans
set credits_monthly = 300, max_photos_monthly = 30
where id = 'essencial';

update public.plans
set credits_monthly = 800, max_photos_monthly = 80
where id = 'pro';

update public.plans
set credits_monthly = 1600, max_photos_monthly = 160
where id = 'premium';
