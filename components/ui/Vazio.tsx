export function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-md border border-dashed border-stone-light bg-white px-5 py-10 text-center">
      <p className="text-lg text-navy">{titulo}</p>
      <p className="mt-1 text-stone">{texto}</p>
    </div>
  );
}
