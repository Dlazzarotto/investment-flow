"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_IDIOMA, ehLocale } from "@/lib/i18n/config";

export async function definirIdioma(fd: FormData): Promise<void> {
  const v = fd.get("idioma");
  if (!ehLocale(v)) return;
  cookies().set(COOKIE_IDIOMA, v, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
