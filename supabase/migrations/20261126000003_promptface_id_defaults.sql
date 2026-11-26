-- PromptFace — defaults de id para inserts diretos do navegador (26/11/2026).
--
-- Todas as tabelas com id uuid foram criadas como "id uuid primary key" SEM
-- default. O frontend (Fase 1) insere direto pelo navegador e não envia id em
-- face_references, notices e waitlist — o insert falhava com
-- 'null value in column "id" violates not-null constraint' (foi o erro do
-- upload da foto de referência). Em folders o código enviava ainda um id
-- inválido ('fld-<uuid>' num campo uuid). O RLS continua decidindo o que cada
-- papel pode ver/fazer; o default só gera o id quando o insert não envia um.
alter table public.users alter column id set default gen_random_uuid();
alter table public.face_references alter column id set default gen_random_uuid();
alter table public.folders alter column id set default gen_random_uuid();
alter table public.generations alter column id set default gen_random_uuid();
alter table public.credit_ledger alter column id set default gen_random_uuid();
alter table public.payments alter column id set default gen_random_uuid();
alter table public.moderation_logs alter column id set default gen_random_uuid();
alter table public.notices alter column id set default gen_random_uuid();
alter table public.waitlist alter column id set default gen_random_uuid();
