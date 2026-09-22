"use client";
import { useI18n } from "@/lib/i18n/client";

/**
 * Campo de PIN que aparece só para o papel Escritório. O valor vai no formulário
 * da própria alteração: a action confere antes de gravar e o RLS confirma depois.
 */
export function CampoPin({ id }: { id: string }) {
  const { d } = useI18n();
  return (
    <div>
      <label className="rotulo" htmlFor={`pin-${id}`}>{d.acesso.pinPedido}</label>
      <input id={`pin-${id}`} name="pin" type="password" required minLength={6} maxLength={64}
             autoComplete="off" className="campo" placeholder="••••••" />
      <p className="mt-1 text-stone">{d.acesso.pinJanela}</p>
    </div>
  );
}
