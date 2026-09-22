import { FormLogin } from "@/components/forms/FormLogin";
import { SeletorIdioma } from "@/components/SeletorIdioma";
import { obterD } from "@/lib/i18n/server";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const { locale, d } = obterD();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-6 flex justify-end"><SeletorIdioma atual={locale} escuro={false} /></div>
      <p className="text-sm text-stone">{d.login.marca}</p>
      <h1 className="mt-1 text-2xl">{d.meta.titulo}</h1>
      <p className="mb-8 mt-2 text-stone">{d.login.subtitulo}</p>
      <FormLogin next={searchParams.next} />
    </main>
  );
}
