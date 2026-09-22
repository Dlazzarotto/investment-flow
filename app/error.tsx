"use client";
import { useI18n } from "@/lib/i18n/client";
export default function Erro({ error, reset }: { error: Error; reset: () => void }) {
  const { d } = useI18n();
  return (
    <main className="mx-auto max-w-lg px-5 py-24 text-center">
      <h1 className="text-2xl">{d.comum.erroTitulo}</h1>
      <p className="mt-3 text-stone">{error.message}</p>
      <button onClick={reset} className="btn-navy mt-8">{d.comum.tentarDeNovo}</button>
    </main>
  );
}
