export function Kpi({ rotulo, valor, tom = "neutro", nota }:
  { rotulo: string; valor: string; tom?: "neutro" | "gain" | "loss"; nota?: string }) {
  const cor = tom === "gain" ? "text-gain" : tom === "loss" ? "text-loss" : "text-navy";
  return (
    <div className="border-l-4 border-navy pl-4">
      <p className="text-sm text-stone">{rotulo}</p>
      <p className={`num text-xl font-semibold leading-tight sm:text-2xl ${cor}`}>{valor}</p>
      {nota && <p className="mt-1 text-sm text-stone">{nota}</p>}
    </div>
  );
}
