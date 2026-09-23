import Image from "next/image";
import { SeletorIdioma } from "@/components/SeletorIdioma";
import { obterD } from "@/lib/i18n/server";

/**
 * Moldura das telas de fora da aplicação — entrada, recuperação de senha,
 * criação de conta e convite. Todas mostram a mesma marca no mesmo lugar.
 *
 * Sem `titulo`, a própria logo é o <h1> (o nome está desenhado nela). Com
 * `titulo`, a logo vira imagem comum e o texto assume o cabeçalho — uma página
 * não pode ter dois <h1>.
 */
export function MolduraEntrada({ titulo, texto, children }:
  { titulo?: string; texto?: string; children: React.ReactNode }) {
  const { locale, d } = obterD();
  const logo = (
    <Image src="/logo.png" alt={d.login.marca} width={248} height={218} priority
           className="mx-auto h-auto w-[200px]" />
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-8 flex items-center justify-center gap-3">
        <span className="text-sm uppercase tracking-wide text-stone">{d.comum.idioma}</span>
        <SeletorIdioma atual={locale} escuro={false} />
      </div>
      {titulo ? (
        <>
          {logo}
          <h1 className="mt-6 text-center text-2xl">{titulo}</h1>
        </>
      ) : (
        <h1>{logo}</h1>
      )}
      {texto && <p className="mx-auto mt-3 max-w-sm text-center text-stone">{texto}</p>}
      <div className="mt-8">{children}</div>
    </main>
  );
}
