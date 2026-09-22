"use client";
import { useEffect, useState } from "react";
import { hojeISO } from "@/lib/format";

/**
 * Data de hoje no fuso do aparelho, preenchida só depois da hidratação:
 * o servidor (Vercel) roda em UTC e, à noite no Brasil, já estaria em "amanhã".
 */
export function useHoje(): string {
  const [hoje, setHoje] = useState("");
  useEffect(() => setHoje(hojeISO()), []);
  return hoje;
}
