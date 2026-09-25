-- 0024 — O gmail deixa de ser master e fica só como ADM da DSD
--
-- RODAR SÓ DEPOIS de criar a conta david@peaceontax.com em /criar-conta e
-- confirmar o e-mail. Se rodar antes, não apaga nada (a trava abaixo impede que
-- a plataforma fique sem master) e a conferência volta false — é só rodar de novo
-- depois da confirmação.
--
-- A filiação do gmail à DSD (organizacao_membros) não é tocada: ele continua ADM
-- dela, com os mesmos dados. Sem função. Idempotente. Teste: tests/schema14.test.sql.

delete from public.plataforma_admins a
 where a.email_normalizado = 'david.lazzarotto@gmail.com'
   and exists (
     select 1 from public.plataforma_admins o
       join auth.users u on lower(trim(u.email)) = o.email_normalizado
      where o.email_normalizado = 'david@peaceontax.com'
        and u.email_confirmed_at is not null);

-- Conferência: tem que voltar true nas duas colunas.
select not exists (select 1 from public.plataforma_admins
                    where email_normalizado = 'david.lazzarotto@gmail.com') as gmail_fora_do_master,
       exists (select 1 from public.plataforma_admins o
                 join auth.users u on lower(trim(u.email)) = o.email_normalizado
                where o.email_normalizado = 'david@peaceontax.com'
                  and u.email_confirmed_at is not null) as master_novo_confirmado;
