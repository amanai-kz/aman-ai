"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Logo } from "@/components/logo"
import { useAppLocale } from "@/components/providers/locale-provider"
import { getAppCopy } from "@/lib/app-copy"
import { getDashboardNavigation } from "@/lib/dashboard-navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  History,
  FileText,
  Settings,
  LogOut,
  Users,
  ClipboardCheck,
  ListOrdered,
  BarChart3,
  Cog,
  Scan,
  Activity,
  ClipboardList,
  Dna,
  Droplets,
  HeartPulse,
  Brain,
  ScanLine,
  Radiation,
  BrainCircuit,
  FlaskConical,
  TestTube2,
  Waves,
  PersonStanding,
  Syringe,
  Dumbbell,
  Atom,
  BookOpen,
  AudioLines,
  Mic,
  Moon,
  Eye,
  Stethoscope,
  User,
  LucideIcon,
} from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  Scan,
  Activity,
  ClipboardList,
  Dna,
  Droplets,
  HeartPulse,
  Brain,
  ScanLine,
  Radiation,
  BrainCircuit,
  FlaskConical,
  TestTube2,
  Waves,
  PersonStanding,
  Syringe,
  Dumbbell,
  Atom,
  BookOpen,
  AudioLines,
  Mic,
  Moon,
  Eye,
  Stethoscope,
  FileText,
}

interface DashboardSidebarProps {
  user: {
    name?: string | null
    email?: string | null
    role: string
  }
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname()
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale)
  const navConfig = getDashboardNavigation(
    user.role === "ADMIN" ? "ADMIN" : user.role === "DOCTOR" ? "DOCTOR" : "PATIENT",
    locale
  )
  const navigation = navConfig.primary.map((item) => ({
    ...item,
    icon:
      item.href === "/dashboard" || item.href === "/doctor/dashboard" || item.href === "/admin/dashboard"
        ? LayoutDashboard
        : item.href === "/doctor/patients" || item.href === "/admin/users"
          ? Users
          : item.href === "/doctor/worklist"
            ? ListOrdered
            : item.href === "/doctor/reviews"
              ? ClipboardCheck
              : item.href === "/doctor/reports"
                ? FileText
                : item.href === "/admin/stats"
                  ? BarChart3
                  : item.href === "/admin/services"
                    ? Cog
                    : item.href === "/dashboard/history"
                      ? History
                      : (item as { iconName?: string }).iconName
                        ? iconMap[(item as { iconName?: string }).iconName as string] || Scan
                        : Scan,
  }))

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-background border-r border-border z-40 hidden lg:flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/">
            <Logo size="default" />
          </Link>
        </div>

        {/* User info - clickable to profile */}
        <Link 
          href={navConfig.profileHref}
          className="block px-6 py-4 border-b border-border hover:bg-secondary/50 transition-colors"
        >
          <p className="font-medium truncate">{user.name || copy.common.profileFallback}</p>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-secondary text-muted-foreground">
            {user.role === "ADMIN" ? copy.common.roles.admin : user.role === "DOCTOR" ? copy.common.roles.doctor : copy.common.roles.patient}
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-border space-y-1">
          <Link
            href="/dashboard/profile"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
              pathname === "/dashboard/profile"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <User className="w-4 h-4" />
            <span>{copy.sidebar.profile}</span>
          </Link>
          <Link
            href={navConfig.settingsHref}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
              pathname.includes("/settings")
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Settings className="w-4 h-4" />
            <span>{copy.sidebar.settings}</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{copy.sidebar.signOut}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40">
        <div className="flex items-center justify-around py-2 px-4">
          {navigation.slice(0, 5).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] truncate max-w-[60px]">
                  {item.name.split(" ")[0]}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
