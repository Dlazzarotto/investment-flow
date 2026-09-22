import Link from "next/link";
import { obterD } from "@/lib/i18n/server";
export default function NotFound() {
  const { d } = obterD();
  return (
    <main className="mx-auto max-w-lg px-5 py-24 text-center">
      <h1 className="text-2xl">{d.comum.naoEncontradoTitulo}</h1>
      <p className="mt-3 text-stone">{d.comum.naoEncontradoTexto}</p>
      <Link href="/projetos" className="btn-navy mt-8">{d.comum.verProjetos}</Link>
    </main>
  );
}
