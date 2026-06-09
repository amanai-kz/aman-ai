"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  APP_LOCALE_STORAGE_KEY,
  appLocales,
  normalizeAppLocale,
  type AppLocale,
} from "@/lib/app-locale"

type LocaleContextValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("ru")

  useEffect(() => {
    let frame = 0

    frame = window.requestAnimationFrame(() => {
      try {
        setLocaleState(normalizeAppLocale(window.localStorage.getItem(APP_LOCALE_STORAGE_KEY)))
      } catch {
        setLocaleState("ru")
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo(
    () => ({
      locale,
      setLocale: (nextLocale: AppLocale) => {
        const normalized = normalizeAppLocale(nextLocale)
        setLocaleState(normalized)
        try {
          window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, normalized)
        } catch {
          // Ignore localStorage failures in restricted environments.
        }
      },
    }),
    [locale]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useAppLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error("useAppLocale must be used within a LocaleProvider")
  }

  return context
}

export { appLocales }
