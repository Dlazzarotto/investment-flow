import { FormCriarConta } from "@/components/forms/FormCriarConta";
import { MolduraEntrada } from "@/components/MolduraEntrada";
import { obterD } from "@/lib/i18n/server";

/**
 * Criação de conta. Não há link para cá na tela de entrada: conta só nasce por
 * convite, e quem chega aqui veio de /convite/[token]. O `next` leva de volta
 * ao convite depois do cadastro.
 */
export default function CriarContaPage({ searchParams }: { searchParams: { next?: string } }) {
  const { d } = obterD();
  return (
    <MolduraEntrada titulo={d.login.criarContaTitulo} texto={d.login.criarContaTexto}>
      <FormCriarConta next={searchParams.next} />
    </MolduraEntrada>
  );
}
