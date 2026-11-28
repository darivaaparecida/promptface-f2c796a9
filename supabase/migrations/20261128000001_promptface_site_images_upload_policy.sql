-- PromptFace — permissão de envio no bucket site-images (Fase 3, 28/11/2026).
--
-- O bucket site-images foi criado pelo painel como público, mas sem política
-- de INSERT: a leitura pública funciona (as fotos do hero carregam), e o
-- envio pelo painel funciona (usa service_role, ignora RLS), mas o envio
-- pelo site — feito com o login da admin — caía com "new row violates
-- row-level security policy". Esta migração libera o envio só para admin
-- (mesmo padrão is_admin() das políticas de escrita do catálogo).
-- Leitura pública continua como está; UPDATE/DELETE não foram liberados.

create policy "site_images_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'site-images'
    and is_admin()
  );
