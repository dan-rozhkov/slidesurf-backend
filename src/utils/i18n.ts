import en from "@/locales/en";
import ru from "@/locales/ru";

const locales: Record<string, typeof en> = { en, ru };

export function getI18n(lang?: string): typeof en {
  if (lang && locales[lang]) {
    return locales[lang];
  }
  return locales.ru;
}

export function getI18nFromHeader(acceptLanguage?: string): typeof en {
  if (!acceptLanguage) return locales.ru;

  const preferred = acceptLanguage.split(",")[0]?.split("-")[0]?.trim();
  if (preferred && locales[preferred]) {
    return locales[preferred];
  }
  return locales.ru;
}
