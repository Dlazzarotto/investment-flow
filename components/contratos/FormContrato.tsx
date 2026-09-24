"use client";
import { useState } from "react";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { rotuloUnidade } from "@/lib/i18n";
import {
  BASES_COMISSAO, DIRECOES_CONTRATO, FORMAS_PAGAMENTO, INCOTERMS, MODALIDADES_CONTRATO, MOEDAS, PAPEIS_CONTRATO,
  STATUS_CONTRATO, TIPOS_PRECO, UNIDADES_VOLUME,
  type ActionState, type Cliente, type Commodity, type Contrato, type Projeto,
} from "@/lib/types";

/** Valores iniciais: o contrato salvo, ou o que veio da proposta (estimativa de custo). */
export type ValoresContrato = Partial<Contrato>;

interface Props {
  acao: (s: ActionState, fd: FormData) => Promise<ActionState>;
  organizacaoId: string;
  clientes: Cliente[];
  commodities: Commodity[];
  projetos: Projeto[];
  valores: ValoresContrato;
  rotuloSalvar: string;
}

/**
 * Um formulário para criar e para editar. Os campos de preço e de comissão
 * aparecem conforme o tipo de preço e o papel — o banco exige essa coerência
 * (contratos_preco_ck, contratos_comissao_ck), e a tela não oferece o que ele
 * vai recusar.
 */
export function FormContrato({ acao, organizacaoId, clientes, commodities, projetos, valores: v, rotuloSalvar }: Props) {
  const { d } = useI18n();
  const t = d.contratos;
  const e = d.enums;
  const [estado, formAction] = useAcaoFormulario(acao);
  const [tipoPreco, setTipoPreco] = useState(v.tipo_preco ?? "fixo");
  const [papel, setPapel] = useState(v.papel ?? "principal");
  const [direcao, setDirecao] = useState(v.direcao ?? "venda");

  // Contraparte certa primeiro: na venda, compradores; na compra, vendedores.
  const tipoEsperado = direcao === "venda" ? "comprador" : "vendedor";
  const contrapartes = [...clientes]
    .filter((c) => c.ativo || c.id === v.contraparte_id)
    .sort((a, b) => Number(b.tipos.includes(tipoEsperado)) - Number(a.tipos.includes(tipoEsperado)));
  const num = (x: number | null | undefined) => (x === null || x === undefined ? "" : String(x));

  return (
    <form action={formAction} className="grid gap-8">
      <input type="hidden" name="organizacao_id" value={organizacaoId} />
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {v.estimativa_id && <input type="hidden" name="estimativa_id" value={v.estimativa_id} />}

      <Bloco titulo={t.blocoPartes}>
        <Campo col={2} rotulo={t.numero} id="numero">
          <input id="numero" name="numero" maxLength={60} className="campo" defaultValue={v.numero ?? ""}
                 placeholder={t.numeroPlaceholder} />
        </Campo>
        <Campo col={2} rotulo={t.direcao} id="direcao">
          <select id="direcao" name="direcao" className="campo" value={direcao}
                  onChange={(x) => setDirecao(x.target.value as typeof direcao)}>
            {DIRECOES_CONTRATO.map((o) => <option key={o} value={o}>{e.direcaoContrato[o]}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={t.papel} id="papel">
          <select id="papel" name="papel" className="campo" value={papel}
                  onChange={(x) => setPapel(x.target.value as typeof papel)}>
            {PAPEIS_CONTRATO.map((o) => <option key={o} value={o}>{e.papelContrato[o]}</option>)}
          </select>
        </Campo>
        <p className="text-sm text-stone sm:col-span-6">{e.descricaoPapelContrato[papel]}</p>
        <Campo col={3} rotulo={direcao === "venda" ? t.comprador : t.vendedor} id="contraparte_id">
          <select id="contraparte_id" name="contraparte_id" required className="campo" defaultValue={v.contraparte_id ?? ""}>
            <option value="" disabled>{t.escolha}</option>
            {contrapartes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo col={3} rotulo={t.commodity} id="commodity_id">
          <select id="commodity_id" name="commodity_id" required className="campo" defaultValue={v.commodity_id ?? ""}>
            <option value="" disabled>{t.escolha}</option>
            {commodities.filter((c) => c.ativo || c.id === v.commodity_id)
              .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo col={3} rotulo={t.projeto} id="projeto_id">
          <select id="projeto_id" name="projeto_id" className="campo" defaultValue={v.projeto_id ?? ""}>
            <option value="">{t.semProjeto}</option>
            {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </Campo>
        <Campo col={3} rotulo={t.status} id="status">
          <select id="status" name="status" className="campo" defaultValue={v.status ?? "rascunho"}>
            {STATUS_CONTRATO.map((o) => <option key={o} value={o}>{e.statusContrato[o]}</option>)}
          </select>
        </Campo>
      </Bloco>

      <Bloco titulo={t.blocoVolume}>
        <Campo col={2} rotulo={t.modalidade} id="modalidade">
          <select id="modalidade" name="modalidade" className="campo" defaultValue={v.modalidade ?? "spot"}>
            {MODALIDADES_CONTRATO.map((o) => <option key={o} value={o}>{e.modalidadeContrato[o]}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={t.volume} id="volume">
          <input id="volume" name="volume" type="number" inputMode="decimal" step="any" min="0" required
                 className="campo num" defaultValue={num(v.volume)} />
        </Campo>
        <Campo col={2} rotulo={t.unidade} id="unidade">
          <input id="unidade" name="unidade" list="unidades-contrato" required maxLength={40} className="campo"
                 defaultValue={v.unidade ?? "Toneladas"} />
          <datalist id="unidades-contrato">
            {UNIDADES_VOLUME.map((u) => <option key={u} value={u}>{rotuloUnidade(u, d)}</option>)}
          </datalist>
        </Campo>
        <Campo col={2} rotulo={t.tolerancia} id="tolerancia_pct">
          <input id="tolerancia_pct" name="tolerancia_pct" type="number" inputMode="decimal" step="any" min="0" max="50"
                 className="campo num" defaultValue={num(v.tolerancia_pct ?? 0)} />
        </Campo>
        <Campo col={2} rotulo={t.incoterm} id="incoterm">
          <select id="incoterm" name="incoterm" className="campo" defaultValue={v.incoterm ?? "FOB"}>
            {INCOTERMS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={t.moeda} id="moeda">
          <select id="moeda" name="moeda" className="campo" defaultValue={v.moeda ?? "USD"}>
            {MOEDAS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Campo>
        <Campo col={3} rotulo={t.portoEmbarque} id="porto_embarque">
          <input id="porto_embarque" name="porto_embarque" maxLength={160} className="campo" defaultValue={v.porto_embarque ?? ""} />
        </Campo>
        <Campo col={3} rotulo={t.portoDestino} id="porto_destino">
          <input id="porto_destino" name="porto_destino" maxLength={160} className="campo" defaultValue={v.porto_destino ?? ""} />
        </Campo>
        <Campo col={3} rotulo={t.inicioEntregas} id="inicio_entregas">
          <input id="inicio_entregas" name="inicio_entregas" type="date" className="campo" defaultValue={v.inicio_entregas ?? ""} />
        </Campo>
        <Campo col={3} rotulo={t.fimEntregas} id="fim_entregas">
          <input id="fim_entregas" name="fim_entregas" type="date" className="campo" defaultValue={v.fim_entregas ?? ""} />
        </Campo>
      </Bloco>

      <Bloco titulo={t.blocoPreco}>
        <Campo col={2} rotulo={t.tipoPreco} id="tipo_preco">
          <select id="tipo_preco" name="tipo_preco" className="campo" value={tipoPreco}
                  onChange={(x) => setTipoPreco(x.target.value as typeof tipoPreco)}>
            {TIPOS_PRECO.map((o) => <option key={o} value={o}>{e.tipoPreco[o]}</option>)}
          </select>
        </Campo>
        {tipoPreco === "fixo" ? (
          <Campo col={2} rotulo={t.precoFixo} id="preco_fixo">
            <input id="preco_fixo" name="preco_fixo" type="number" inputMode="decimal" step="any" min="0" required
                   className="campo num" defaultValue={num(v.preco_fixo)} />
          </Campo>
        ) : (
          <>
            <Campo col={4} rotulo={t.indice} id="indice">
              <input id="indice" name="indice" required maxLength={160} className="campo" defaultValue={v.indice ?? ""}
                     placeholder={t.indicePlaceholder} />
            </Campo>
            <Campo col={2} rotulo={t.premio} id="premio">
              <input id="premio" name="premio" type="number" inputMode="decimal" step="any"
                     className="campo num" defaultValue={num(v.premio ?? 0)} />
            </Campo>
            <Campo col={2} rotulo={t.indiceReferencia} id="indice_referencia">
              <input id="indice_referencia" name="indice_referencia" type="number" inputMode="decimal" step="any" min="0"
                     className="campo num" defaultValue={num(v.indice_referencia)} />
            </Campo>
            <Campo col={2} rotulo={t.periodoCotacao} id="periodo_cotacao">
              <input id="periodo_cotacao" name="periodo_cotacao" maxLength={160} className="campo"
                     defaultValue={v.periodo_cotacao ?? ""} placeholder={t.periodoCotacaoPlaceholder} />
            </Campo>
            <p className="text-sm text-stone sm:col-span-6">{t.formulaAjuda}</p>
          </>
        )}
        <p className="text-sm text-stone sm:col-span-6">{t.qualidadeAjuda}</p>
      </Bloco>

      <Bloco titulo={t.blocoPagamento}>
        <Campo col={2} rotulo={t.formaPagamento} id="forma_pagamento">
          <select id="forma_pagamento" name="forma_pagamento" className="campo" defaultValue={v.forma_pagamento ?? "lc"}>
            {FORMAS_PAGAMENTO.map((o) => <option key={o} value={o}>{e.formaPagamento[o]}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={t.prazoPagamento} id="prazo_pagamento_dias">
          <input id="prazo_pagamento_dias" name="prazo_pagamento_dias" type="number" inputMode="numeric" min="0" max="365"
                 className="campo num" defaultValue={num(v.prazo_pagamento_dias ?? 0)} />
        </Campo>
        <Campo col={2} rotulo={t.pctProvisoria} id="pct_provisoria">
          <input id="pct_provisoria" name="pct_provisoria" type="number" inputMode="decimal" step="any" min="0" max="99.99"
                 className="campo num" defaultValue={num(v.pct_provisoria)} placeholder={t.semProvisoria} />
        </Campo>
        {papel === "agente" && (
          <>
            <Campo col={3} rotulo={t.comissaoBase} id="comissao_base">
              <select id="comissao_base" name="comissao_base" required className="campo" defaultValue={v.comissao_base ?? "por_unidade"}>
                {BASES_COMISSAO.map((o) => <option key={o} value={o}>{e.baseComissao[o]}</option>)}
              </select>
            </Campo>
            <Campo col={3} rotulo={t.comissaoValor} id="comissao_valor">
              <input id="comissao_valor" name="comissao_valor" type="number" inputMode="decimal" step="any" min="0" required
                     className="campo num" defaultValue={num(v.comissao_valor)} />
            </Campo>
          </>
        )}
      </Bloco>

      <Bloco titulo={t.blocoMarcos}>
        {(["data_loi", "data_icpo", "data_sco", "data_assinatura"] as const).map((k) => (
          <Campo key={k} col={3} rotulo={t[k]} id={k}>
            <input id={k} name={k} type="date" className="campo" defaultValue={v[k] ?? ""} />
          </Campo>
        ))}
        <Campo col={6} rotulo={t.observacoes} id="observacoes">
          <textarea id="observacoes" name="observacoes" rows={3} maxLength={2000} className="campo"
                    defaultValue={v.observacoes ?? ""} />
        </Campo>
      </Bloco>

      <div>
        <SubmitButton>{rotuloSalvar}</SubmitButton>
        <Mensagem estado={estado} />
      </div>
    </form>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-md border border-stone-light bg-white p-4">
      <legend className="px-2 text-lg font-semibold text-navy">{titulo}</legend>
      <div className="grid gap-4 sm:grid-cols-6">{children}</div>
    </fieldset>
  );
}

function Campo({ col, rotulo, id, children }: { col: number; rotulo: string; id: string; children: React.ReactNode }) {
  // Classes escritas por extenso: o Tailwind só gera as que encontra no código.
  const span = { 2: "sm:col-span-2", 3: "sm:col-span-3", 4: "sm:col-span-4", 6: "sm:col-span-6" }[col] ?? "sm:col-span-6";
  return (
    <div className={span}>
      <label className="rotulo" htmlFor={id}>{rotulo}</label>
      {children}
    </div>
  );
}
