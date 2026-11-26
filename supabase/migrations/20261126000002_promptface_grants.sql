-- PromptFace — grants para acesso direto do navegador (Fase 1, 26/11/2026).
--
-- As migrações 1 e 2 criaram as tabelas e as políticas RLS, mas não davam
-- privilégio de tabela aos papéis anon/authenticated. Sem GRANT, o PostgREST
-- devolve 403 em toda leitura/escrita do navegador — foi o que quebrou o
-- login no site ao vivo (o Auth entrava, mas a leitura do perfil falhava
-- silenciosamente e o site voltava para o formulário). O RLS continua sendo
-- quem decide o que cada papel pode ver/fazer; o GRANT só abre a porta.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
