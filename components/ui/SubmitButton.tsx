"use client";
import { useFormStatus } from "react-dom";
import { useI18n } from "@/lib/i18n/client";

export function SubmitButton({ children, aguardando, className = "btn-primario" }:
  { children: React.ReactNode; aguardando?: string; className?: string }) {
  const { pending } = useFormStatus();
  const { d } = useI18n();
  return (
    <button type="submit" disabled={pending} className={className} aria-busy={pending}>
      {pending ? (aguardando ?? d.comum.salvando) : children}
    </button>
  );
}
