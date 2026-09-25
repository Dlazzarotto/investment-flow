-- 0023 — Conta master da Investment Flow separada da conta da DSD
--
-- A Investment Flow é a PLATAFORMA vendida por assinatura; a DSD é só uma
-- empresa cliente dela. Até aqui o mesmo e-mail (david.lazzarotto@gmail.com)
-- era master da plataforma E ADM da DSD — dono da plataforma e cliente na mesma
-- conta, o contrário do que torna o sistema vendável a tradings concorrentes.
--
-- Esta migration só ACRESCENTA o master novo. O gmail sai na 0024, que só age
-- depois de a conta nova existir e ter o e-mail confirmado — assim a plataforma
-- nunca fica sem master no meio da troca.
--
-- A senha não passa por aqui: a pessoa cria a conta em /criar-conta. O vínculo é
-- pelo e-mail CONFIRMADO (eh_master() usa email_confirmado()), então quem se
-- cadastrar com este endereço sem acesso à caixa de entrada não vira master.
--
-- Sem função. Idempotente. Teste: tests/schema14.test.sql.

insert into public.plataforma_admins (email, observacoes)
values ('david@peaceontax.com', 'Conta master da plataforma Investment Flow (0023).')
on conflict do nothing;

-- Conferência: tem que voltar true.
select exists (select 1 from public.plataforma_admins
                where email_normalizado = 'david@peaceontax.com') as master_plataforma;
