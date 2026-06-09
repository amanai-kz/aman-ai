"use client"

import { Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getDoctorCopy } from "@/lib/doctor-copy"
import { appLocales, type AppLocale } from "@/lib/app-locale"
import { useAppLocale } from "@/components/providers/locale-provider"

export function LanguageSwitcher() {
  const { locale, setLocale } = useAppLocale()
  const copy = getDoctorCopy(locale)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{locale.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{copy.common.language}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => setLocale(value as AppLocale)}>
          {appLocales.map((item) => (
            <DropdownMenuRadioItem key={item} value={item}>
              {copy.common.localeNames[item]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
