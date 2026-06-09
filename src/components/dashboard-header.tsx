"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Logo } from "@/components/logo"
import { useAppLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getDoctorCopy } from "@/lib/doctor-copy"
import { Bell, Search, User, Settings, LogOut, Menu } from "lucide-react"

interface DashboardHeaderProps {
  title?: string
  titleKey?: "doctorWorklist" | "doctorCaseDetail" | "doctorPatientDetail"
}

export function DashboardHeader({ title, titleKey }: DashboardHeaderProps) {
  const { data: session } = useSession()
  const { locale } = useAppLocale()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const copy = getDoctorCopy(locale)
  const settingsHref =
    session?.user?.role === "DOCTOR"
      ? "/doctor/settings"
      : session?.user?.role === "ADMIN"
        ? "/admin/settings"
        : "/dashboard/settings"
  const resolvedTitle =
    titleKey === "doctorWorklist"
      ? copy.worklist.navTitle
      : titleKey === "doctorCaseDetail"
        ? copy.caseDetail.pageTitle
        : titleKey === "doctorPatientDetail"
          ? copy.patientDetail.pageTitle
          : title

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-30">
      <div className="h-full px-6 md:px-8 flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile logo */}
          <div className="lg:hidden">
            <Link href="/">
              <Logo size="sm" />
            </Link>
          </div>

          {/* Page title (desktop) */}
          {resolvedTitle && (
            <h1 className="hidden lg:block text-lg font-medium">{resolvedTitle}</h1>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search (desktop) */}
          <Button variant="ghost" size="sm" className="hidden md:flex gap-2 text-muted-foreground">
            <Search className="w-4 h-4" />
            <span className="text-sm">{copy.common.searchPlaceholder}</span>
            <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-border bg-secondary px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </Button>

          <LanguageSwitcher />

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-foreground rounded-full" />
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <span className="hidden md:block text-sm max-w-[100px] truncate">
                  {session?.user?.name || copy.common.profileFallback}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{session?.user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {session?.user?.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={settingsHref} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  {copy.sidebar.settings}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/" })}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {copy.sidebar.signOut}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
