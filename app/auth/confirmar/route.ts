import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { caminhoInterno } from "@/lib/validacao";

export const dynamic = "force-dynamic";

/**
 * Destino dos links enviados por e-mail (recuperação de senha, confirmação).
 * Troca o código do link por uma sessão e segue para onde o link pedia.
 *
 * Aceita as duas formas porque dependem de como o template de e-mail do Supabase
 * está montado: `code` (fluxo PKCE, o padrão do @supabase/ssr) e `token_hash`
 * com `type` (template que usa {{ .TokenHash }}). A terceira forma possível —
 * tokens no fragmento `#` da URL — não chega ao servidor, e nesse caso o
 * usuário cai na tela de link inválido pedindo outro.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // caminhoInterno barra "?next=//evil.com": o link vem de fora, do e-mail.
  const next = caminhoInterno(searchParams.get("next"), "/projetos");
  const supabase = createClient();

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/esqueci-senha?expirado=1", request.url));
}
