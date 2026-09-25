"use client";
import { useState } from "react";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { caladoLimite, fretePrincipalDo, laytimeDias } from "@/lib/catalogo";
import { SeletorLocal, SeletorProduto } from "./SeletoresCatalogo";
import {
  ASSINANTES_CONTRATO, BASES_COMISSAO, BASES_PRECO, CONTAS_CONTRATO, DIRECOES_CONTRATO, DOCUMENTOS_EXIGIDOS, EMBALAGENS, EVENTOS_SALDO,
  INCOTERMS, LOCAIS_INSPECAO, MODAIS_INTERIOR, MODALIDADES_CONTRATO, MOEDAS, PAPEIS_CONTRATO, PARTES_RESPONSAVEIS, PORTES_NAVIO,
  STATUS_CONTRATO, TIPOS_PRECO, UNIDADES_VOLUME,
  type ActionState, type Cliente, type Commodity, type CommodityGrade, type CommodityGrupo, type CommodityParametro, type Contrato,
  type Local, type Projeto,
} from "@/lib/types";

/** Valores iniciais: o contrato salvo (com as partes), ou o que veio da proposta (estimativa de custo). */
export type ValoresContrato = Partial<Contrato> & {
  comprador_id?: string | null; vendedor_id?: string | null; financial_partner_id?: string | null;
};

interface Props {
  acao: (s: ActionState, fd: FormData) => Promise<ActionState>;
  organizacaoId: string;
  clientes: Cliente[];
  commodities: Commodity[];
  grupos: CommodityGrupo[];
  grades: CommodityGrade[];
  parametros: CommodityParametro[];
  locais: Local[];
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
export function FormContrato({
  acao, organizacaoId, clientes, commodities, grupos, grades, parametros, locais, projetos, valores: v, rotuloSalvar,
}: Props) {
  const { d, locale } = useI18n();
  const fmt = formatadores(locale);
  const t = d.contratos;
  const e = d.enums;
  const [estado, formAction] = useAcaoFormulario(acao);
  const [tipoPreco, setTipoPreco] = useState(v.tipo_preco ?? "fixo");
  const [papel, setPapel] = useState(v.papel ?? "principal");
  const [direcao, setDirecao] = useState(v.direcao ?? "venda");

  const [conta, setConta] = useState(v.conta ?? "propria");
  // Quem é cliente em cada ponta: trader vendendo tem só o comprador (a empresa é
  // o vendedor); comprando, só o vendedor; intermediando, os dois.
  const pedeComprador = papel === "agente" || direcao === "venda";
  const pedeVendedor = papel === "agente" || direcao === "compra";
  const ativos = clientes.filter((c) => c.ativo || [v.comprador_id, v.vendedor_id, v.financial_partner_id].includes(c.id));
  // O Financial Partner só recebe e administra o instrumento — não entra como
  // ponta do produto. Quem é SÓ Financial Partner fica fora dos seletores de ponta.
  const soFp = (c: Cliente) => c.tipos.length > 0 && c.tipos.every((x) => x === "financial_partner");
  const ordenar = (tipo: Cliente["tipos"][number]) => ativos.filter((c) => !soFp(c))
    .sort((a, b) => Number(b.tipos.includes(tipo)) - Number(a.tipos.includes(tipo)) || a.nome.localeCompare(b.nome));
  const financiais = ativos.filter((c) => c.tipos.includes("financial_partner") || c.id === v.financial_partner_id);
  const num = (x: number | null | undefined) => (x === null || x === undefined ? "" : String(x));

  // Rota e logística (0029): locais criados aqui aparecem em todos os seletores.
  const [novosLocais, setNovosLocais] = useState<Local[]>([]);
  const todosLocais = [...locais, ...novosLocais];
  const [loc, setLoc] = useState({
    origem_id: v.origem_id ?? "", ponto_carga_id: v.ponto_carga_id ?? "", ponto_descarga_id: v.ponto_descarga_id ?? "",
    destino_final_id: v.destino_final_id ?? "", transbordo_id: v.transbordo_id ?? "",
  });
  const mudaLoc = (k: keyof typeof loc) => (id: string) => setLoc((x) => ({ ...x, [k]: id }));
  const acharLocal = (id: string) => todosLocais.find((l) => l.id === id);
  const limite = caladoLimite({
    carga: acharLocal(loc.ponto_carga_id), transbordo: acharLocal(loc.transbordo_id), descarga: acharLocal(loc.ponto_descarga_id),
  });
  const [incoterm, setIncoterm] = useState<string>(v.incoterm ?? "FOB");
  const [volume, setVolume] = useState(num(v.volume));
  const [taxaCarga, setTaxaCarga] = useState(num(v.taxa_carga_dia));
  const [taxaDescarga, setTaxaDescarga] = useState(num(v.taxa_descarga_dia));
  const ltCarga = laytimeDias(Number(volume) || null, Number(taxaCarga) || null);
  const ltDescarga = laytimeDias(Number(volume) || null, Number(taxaDescarga) || null);
  const [docs, setDocs] = useState<string[]>(v.documentos_exigidos ?? []);
  const seletorLocal = (k: keyof typeof loc, rotulo: string, vazio: string, tipo?: Local["tipo"]) => (
    <SeletorLocal name={k} rotulo={rotulo} locais={todosLocais} valor={loc[k]} aoMudar={mudaLoc(k)} organizacaoId={organizacaoId}
                  aoCriar={(l) => setNovosLocais((x) => [...x, l])} tipoPadrao={tipo} vazio={vazio} />
  );

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
        {pedeComprador ? (
          <Campo col={3} rotulo={t.comprador} id="comprador_id">
            <select id="comprador_id" name="comprador_id" required className="campo" defaultValue={v.comprador_id ?? ""}>
              <option value="" disabled>{t.escolha}</option>
              {ordenar("comprador").map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
        ) : (
          <p className="self-end text-stone sm:col-span-3">{t.empresaCompra}</p>
        )}
        {pedeVendedor ? (
          <Campo col={3} rotulo={t.vendedor} id="vendedor_id">
            <select id="vendedor_id" name="vendedor_id" required className="campo" defaultValue={v.vendedor_id ?? ""}>
              <option value="" disabled>{t.escolha}</option>
              {ordenar("vendedor").map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
        ) : (
          <p className="self-end text-stone sm:col-span-3">{t.empresaVende}</p>
        )}
        <Campo col={3} rotulo={t.financialPartner} id="financial_partner_id">
          <select id="financial_partner_id" name="financial_partner_id" className="campo" defaultValue={v.financial_partner_id ?? ""}>
            <option value="">{t.semFinancialPartner}</option>
            {financiais.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <p className="text-sm text-stone sm:col-span-3 sm:self-end">{t.financialPartnerAjuda}</p>
        <Campo col={2} rotulo={t.conta} id="conta">
          <select id="conta" name="conta" className="campo" value={conta}
                  onChange={(x) => setConta(x.target.value as typeof conta)}>
            {CONTAS_CONTRATO.map((o) => <option key={o} value={o}>{e.contaContrato[o]}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={t.assinante} id="assinante">
          <select id="assinante" name="assinante" className="campo" defaultValue={v.assinante ?? "empresa"}>
            {ASSINANTES_CONTRATO.map((o) => <option key={o} value={o}>{e.assinanteContrato[o]}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={conta === "projeto" ? t.projetoObrigatorio : t.projeto} id="projeto_id">
          <select id="projeto_id" name="projeto_id" required={conta === "projeto"} className="campo" defaultValue={v.projeto_id ?? ""}>
            <option value="">{t.semProjeto}</option>
            {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </Campo>
        <p className="text-sm text-stone sm:col-span-6">{e.descricaoContaContrato[conta]}</p>
        <Campo col={3} rotulo={t.status} id="status">
          <select id="status" name="status" className="campo" defaultValue={v.status ?? "rascunho"}>
            {STATUS_CONTRATO.map((o) => <option key={o} value={o}>{e.statusContrato[o]}</option>)}
          </select>
        </Campo>
      </Bloco>

      <Bloco titulo={t.blocoProduto}>
        <SeletorProduto organizacaoId={organizacaoId} grupos={grupos} commodities={commodities} grades={grades}
                        parametros={parametros} commodityInicial={v.commodity_id} gradeInicial={v.grade_id} />
        <Campo col={6} rotulo={t.especificacaoContrato} id="especificacao">
          <textarea id="especificacao" name="especificacao" rows={2} maxLength={2000} className="campo"
                    defaultValue={v.especificacao ?? ""} />
          <p className="mt-1 text-sm text-stone">{t.especificacaoAjuda}</p>
        </Campo>
        <Campo col={2} rotulo={t.embalagem} id="embalagem">
          <select id="embalagem" name="embalagem" className="campo" defaultValue={v.embalagem ?? ""}>
            <option value="">{t.naoInformado}</option>
            {EMBALAGENS.map((o) => <option key={o} value={o}>{e.embalagem[o]}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={t.modalidade} id="modalidade">
          <select id="modalidade" name="modalidade" className="campo" defaultValue={v.modalidade ?? "spot"}>
            {MODALIDADES_CONTRATO.map((o) => <option key={o} value={o}>{e.modalidadeContrato[o]}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={t.volume} id="volume">
          <input id="volume" name="volume" type="number" inputMode="decimal" step="any" min="0" required
                 className="campo num" value={volume} onChange={(x) => setVolume(x.target.value)} />
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
        <Campo col={2} rotulo={t.basePreco} id="base_preco">
          <select id="base_preco" name="base_preco" className="campo" defaultValue={v.base_preco ?? ""}>
            <option value="">{t.naoInformado}</option>
            {BASES_PRECO.map((o) => <option key={o} value={o}>{e.basePreco[o]}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={t.incoterm} id="incoterm">
          <select id="incoterm" name="incoterm" className="campo" value={incoterm} onChange={(x) => setIncoterm(x.target.value)}>
            {INCOTERMS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={t.moeda} id="moeda">
          <select id="moeda" name="moeda" className="campo" defaultValue={v.moeda ?? "USD"}>
            {MOEDAS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Campo>
        <p className="text-sm text-stone sm:col-span-6">{t.qualidadeAjuda}</p>
      </Bloco>

      <Bloco titulo={t.blocoPagamento}>
        {/* Carta de crédito é GARANTIA (seção de instrumentos), não forma de pagamento:
            aqui vai o cronograma que as partes negociaram. */}
        <Campo col={2} rotulo={t.pctAntecipado} id="pct_antecipado">
          <input id="pct_antecipado" name="pct_antecipado" type="number" inputMode="decimal" step="any" min="0" max="100"
                 className="campo num" defaultValue={num(v.pct_antecipado ?? 0)} />
        </Campo>
        <Campo col={2} rotulo={t.eventoSaldo} id="evento_saldo">
          <select id="evento_saldo" name="evento_saldo" className="campo" defaultValue={v.evento_saldo ?? "bl"}>
            {EVENTOS_SALDO.map((o) => <option key={o} value={o}>{e.eventoSaldo[o]}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={t.prazoPagamento} id="prazo_pagamento_dias">
          <input id="prazo_pagamento_dias" name="prazo_pagamento_dias" type="number" inputMode="numeric" min="0" max="365"
                 className="campo num" defaultValue={num(v.prazo_pagamento_dias ?? 0)} />
        </Campo>
        <p className="text-sm text-stone sm:col-span-6">{t.pagamentoAjuda}</p>
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

      <Bloco titulo={t.blocoRota}>
        {/* Portos em texto livre da versão anterior: preservados até alguém escolher o local. */}
        {v.porto_embarque && <input type="hidden" name="porto_embarque" value={v.porto_embarque} />}
        {v.porto_destino && <input type="hidden" name="porto_destino" value={v.porto_destino} />}
        {seletorLocal("origem_id", t.origem, t.naoInformado, "mina")}
        {seletorLocal("ponto_carga_id", t.pontoCarga, t.naoInformado)}
        {(v.porto_embarque || v.porto_destino) && (
          <p className="text-sm text-stone sm:col-span-6">
            {[v.porto_embarque && `${t.portoEmbarque}: ${v.porto_embarque}`, v.porto_destino && `${t.portoDestino}: ${v.porto_destino}`]
              .filter(Boolean).join(" · ")}
          </p>
        )}
        {seletorLocal("transbordo_id", t.transbordo, t.semTransbordo)}
        {seletorLocal("ponto_descarga_id", t.pontoDescarga, t.naoInformado)}
        <Campo col={3} rotulo={t.destino} id="destino">
          <input id="destino" name="destino" maxLength={160} className="campo" defaultValue={v.destino ?? ""} />
        </Campo>
        {seletorLocal("destino_final_id", t.destinoFinal, t.naoInformado, "cidade")}
        <Campo col={3} rotulo={t.entregaInterior} id="entrega_interior">
          <select id="entrega_interior" name="entrega_interior" className="campo" defaultValue={v.entrega_interior ?? ""}>
            <option value="">{t.naoInformado}</option>
            {MODAIS_INTERIOR.map((o) => <option key={o} value={o}>{e.modalInterior[o]}</option>)}
          </select>
        </Campo>
        <Campo col={3} rotulo={t.entregaInteriorObs} id="entrega_interior_obs">
          <input id="entrega_interior_obs" name="entrega_interior_obs" maxLength={300} className="campo"
                 defaultValue={v.entrega_interior_obs ?? ""} />
        </Campo>
        <Campo col={6} rotulo={t.rotaFluvial} id="rota_fluvial">
          <input id="rota_fluvial" name="rota_fluvial" maxLength={300} className="campo" defaultValue={v.rota_fluvial ?? ""}
                 placeholder={t.rotaFluvialPlaceholder} />
        </Campo>
        <Campo col={2} rotulo={t.barcacasQtd} id="barcacas_qtd">
          <input id="barcacas_qtd" name="barcacas_qtd" type="number" inputMode="numeric" min="0" max="500"
                 className="campo num" defaultValue={num(v.barcacas_qtd)} />
        </Campo>
        <Campo col={4} rotulo={t.barcacaObs} id="barcaca_obs">
          <input id="barcaca_obs" name="barcaca_obs" maxLength={300} className="campo" defaultValue={v.barcaca_obs ?? ""}
                 placeholder={t.barcacaObsPlaceholder} />
        </Campo>
        <Campo col={2} rotulo={t.porteNavio} id="porte_navio">
          <select id="porte_navio" name="porte_navio" className="campo" defaultValue={v.porte_navio ?? ""}>
            <option value="">{t.naoInformado}</option>
            {PORTES_NAVIO.map((o) => <option key={o} value={o}>{e.porteNavio[o]}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={t.navioNome} id="navio_nome">
          <input id="navio_nome" name="navio_nome" maxLength={120} className="campo" defaultValue={v.navio_nome ?? ""} />
        </Campo>
        <Campo col={2} rotulo={t.navioImo} id="navio_imo">
          <input id="navio_imo" name="navio_imo" inputMode="numeric" pattern="[0-9]{7}" maxLength={7} className="campo num"
                 defaultValue={v.navio_imo ?? ""} />
        </Campo>
        <Campo col={2} rotulo={t.caladoMax} id="calado_max_m">
          <input id="calado_max_m" name="calado_max_m" type="number" inputMode="decimal" step="0.01" min="0" max="40"
                 className="campo num" defaultValue={num(v.calado_max_m)} />
        </Campo>
        <Campo col={2} rotulo={t.frete} id="frete_valor">
          <input id="frete_valor" name="frete_valor" type="number" inputMode="decimal" step="any" min="0"
                 className="campo num" defaultValue={num(v.frete_valor)} />
        </Campo>
        <p className="self-end text-sm text-stone sm:col-span-2">
          {fmtTexto(fretePrincipalDo(incoterm) === "vendedor" ? t.freteVendedor : t.freteComprador, { incoterm })}
        </p>
        {limite !== null && (
          <p className="text-sm text-navy sm:col-span-6">{fmtTexto(t.caladoLimite, { m: fmt.numero(limite, 2) })}</p>
        )}
        <Campo col={3} rotulo={t.taxaCarga} id="taxa_carga_dia">
          <input id="taxa_carga_dia" name="taxa_carga_dia" type="number" inputMode="decimal" step="any" min="0"
                 className="campo num" value={taxaCarga} onChange={(x) => setTaxaCarga(x.target.value)} />
        </Campo>
        <Campo col={3} rotulo={t.taxaDescarga} id="taxa_descarga_dia">
          <input id="taxa_descarga_dia" name="taxa_descarga_dia" type="number" inputMode="decimal" step="any" min="0"
                 className="campo num" value={taxaDescarga} onChange={(x) => setTaxaDescarga(x.target.value)} />
        </Campo>
        <Campo col={3} rotulo={t.demurrage} id="demurrage_dia">
          <input id="demurrage_dia" name="demurrage_dia" type="number" inputMode="decimal" step="any" min="0"
                 className="campo num" defaultValue={num(v.demurrage_dia)} />
        </Campo>
        <Campo col={3} rotulo={t.despatch} id="despatch_dia">
          <input id="despatch_dia" name="despatch_dia" type="number" inputMode="decimal" step="any" min="0"
                 className="campo num" defaultValue={num(v.despatch_dia)} />
        </Campo>
        <p className="text-sm text-stone sm:col-span-6">
          {ltCarga !== null || ltDescarga !== null
            ? fmtTexto(t.laytimeDias, { c: ltCarga === null ? "—" : fmt.numero(ltCarga, 2), d: ltDescarga === null ? "—" : fmt.numero(ltDescarga, 2) })
            : t.laytimeAjuda}
        </p>
      </Bloco>

      <Bloco titulo={t.blocoEmbarque}>
        <p className="font-semibold text-navy sm:col-span-6">{t.janelaEmbarque}</p>
        <Campo col={3} rotulo={t.inicioEntregas} id="inicio_entregas">
          <input id="inicio_entregas" name="inicio_entregas" type="date" className="campo" defaultValue={v.inicio_entregas ?? ""} />
        </Campo>
        <Campo col={3} rotulo={t.fimEntregas} id="fim_entregas">
          <input id="fim_entregas" name="fim_entregas" type="date" className="campo" defaultValue={v.fim_entregas ?? ""} />
        </Campo>
        <Campo col={2} rotulo={t.inspetora} id="inspetora">
          <input id="inspetora" name="inspetora" maxLength={120} className="campo" defaultValue={v.inspetora ?? ""}
                 placeholder={t.inspetoraPlaceholder} />
        </Campo>
        <Campo col={2} rotulo={t.inspecaoLocal} id="inspecao_local">
          <select id="inspecao_local" name="inspecao_local" className="campo" defaultValue={v.inspecao_local ?? ""}>
            <option value="">{t.naoInformado}</option>
            {LOCAIS_INSPECAO.map((o) => <option key={o} value={o}>{e.localInspecao[o]}</option>)}
          </select>
        </Campo>
        <Campo col={2} rotulo={t.inspecaoCusto} id="inspecao_custo">
          <select id="inspecao_custo" name="inspecao_custo" className="campo" defaultValue={v.inspecao_custo ?? ""}>
            <option value="">{t.naoInformado}</option>
            {PARTES_RESPONSAVEIS.map((o) => <option key={o} value={o}>{e.parteResponsavel[o]}</option>)}
          </select>
        </Campo>
        <fieldset className="sm:col-span-6">
          <legend className="rotulo">{t.documentosExigidos}</legend>
          <p className="mb-2 text-sm text-stone">{t.documentosAjuda}</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {DOCUMENTOS_EXIGIDOS.map((doc) => (
              <label key={doc} className="flex min-h-touch items-center gap-3">
                <input type="checkbox" name="documentos_exigidos" value={doc} className="h-6 w-6 accent-navy"
                       checked={docs.includes(doc)}
                       onChange={(x) => setDocs((l) => x.target.checked ? [...l, doc] : l.filter((y) => y !== doc))} />
                <span>{e.documentoExigido[doc]}</span>
              </label>
            ))}
          </div>
        </fieldset>
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
