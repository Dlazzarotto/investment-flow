-- 0027 — Um e-mail, uma empresa. Empresas nunca se misturam.
--
-- A 0007 só proibia o mesmo e-mail duas vezes DENTRO da mesma empresa
-- (organizacao_membros_uq = empresa + e-mail). Nada impedia o master de liberar
-- uma empresa nova com o e-mail do ADM de outra, nem o ADM de uma empresa de
-- incluir como sócio quem já administra outra. Essa pessoa passaria a ser ADM
-- das duas: veria clientes, contratos e documentos de empresas concorrentes na
-- mesma conta — e a tela, que só mostra uma (minha_organizacao), esconderia isso.
--
-- Agora o e-mail é único na tabela inteira: quem administra uma empresa não
-- entra em outra. (Convite para um PROJETO de outra empresa continua possível:
-- é projeto_membros, acesso ao projeto, não à empresa.)
--
-- Declarativo, sem função. Idempotente. Se esta instrução falhar com "could not
-- create unique index", já existe um e-mail em duas empresas: NÃO force —
-- mande a mensagem de erro, que ela diz qual e-mail é.
-- Teste: tests/schema17.test.sql.

create unique index if not exists organizacao_membros_email_uq
  on public.organizacao_membros (email_normalizado);

-- Conferência: tem que voltar true.
select exists (select 1 from pg_indexes where indexname = 'organizacao_membros_email_uq') as um_email_uma_empresa;
