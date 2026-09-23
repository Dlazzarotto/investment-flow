import Image from "next/image";
import { FormLogin } from "@/components/forms/FormLogin";
import { SeletorIdioma } from "@/components/SeletorIdioma";
import { obterD } from "@/lib/i18n/server";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const { locale, d } = obterD();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-6 flex justify-end"><SeletorIdioma atual={locale} escuro={false} /></div>
      {/* A logo já traz o nome escrito; o alt guarda a marca para leitor de tela. */}
      <Image src="/logo.png" alt={d.login.marca} width={248} height={218} priority
             className="mb-6 h-auto w-[200px]" />
      <h1 className="mt-1 text-2xl">{d.meta.titulo}</h1>
      <p className="mb-8 mt-2 text-stone">{d.login.subtitulo}</p>
      <FormLogin next={searchParams.next} />
    </main>
  );
}
