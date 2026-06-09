export const appLocales = ["ru", "en", "kk"] as const

export type AppLocale = (typeof appLocales)[number]

export const APP_LOCALE_STORAGE_KEY = "amanai-locale"
export const APP_DISPLAY_TIME_ZONE = "Asia/Almaty"

export function normalizeAppLocale(input?: string | null): AppLocale {
  if (input === "en") return "en"
  if (input === "kk" || input === "kz") return "kk"
  return "ru"
}

export function getIntlLocale(locale: AppLocale): string {
  switch (locale) {
    case "en":
      return "en-US"
    case "kk":
      return "kk-KZ"
    default:
      return "ru-RU"
  }
}
