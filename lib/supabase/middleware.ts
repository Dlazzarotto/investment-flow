import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_IDIOMA, detectarLocale, ehLocale } from "@/lib/i18n/config";

/** Renova a sessão a cada request e protege as rotas da aplicação. */
export async function atualizarSessao(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista: { name: string; value: string; options: CookieOptions }[]) => {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const rotaPublica = pathname.startsWith("/login");

  if (!user && !rotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (user && rotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/projetos";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Primeira visita sem cookie de idioma: fixa o idioma do navegador (pt/en/es/zh).
  if (!ehLocale(request.cookies.get(COOKIE_IDIOMA)?.value)) {
    response.cookies.set(COOKIE_IDIOMA, detectarLocale(request.headers.get("accept-language")),
      { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return response;
}
