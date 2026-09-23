import type { NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  // manifest.webmanifest fica de fora porque o celular busca ele SEM sessão ao
  // "adicionar à tela de início"; passando pelo middleware, virava redirect para
  // o login e a instalação ficava sem nome e sem ícone.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
