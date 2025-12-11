"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import { services } from "@/lib/services"
import {
  LayoutDashboard,
  History,
  FileText,
  Settings,
  LogOut,
  Users,
  ClipboardCheck,
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

  const patientNav = [
    { name: "Главная", href: "/dashboard", icon: LayoutDashboard },
    ...services.map((s) => ({
      name: s.title,
      href: s.href,
      icon: iconMap[s.iconName] || Scan,
    })),
    { name: "История", href: "/dashboard/history", icon: History },
    { name: "Отчёты", href: "/dashboard/reports", icon: FileText },
  ]

  const doctorNav = [
    { name: "Главная", href: "/doctor/dashboard", icon: LayoutDashboard },
    { name: "Пациенты", href: "/doctor/patients", icon: Users },
    { name: "На проверку", href: "/doctor/reviews", icon: ClipboardCheck },
    { name: "Отчёты", href: "/doctor/reports", icon: FileText },
  ]

  const adminNav = [
    { name: "Главная", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Пользователи", href: "/admin/users", icon: Users },
    { name: "Статистика", href: "/admin/stats", icon: BarChart3 },
    { name: "Сервисы", href: "/admin/services", icon: Cog },
  ]

  const navigation =
    user.role === "ADMIN"
      ? adminNav
      : user.role === "DOCTOR"
      ? doctorNav
      : patientNav

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

        {/* User info */}
        <div className="px-6 py-4 border-b border-border">
          <p className="font-medium truncate">{user.name || "Пользователь"}</p>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-secondary text-muted-foreground">
            {user.role === "ADMIN" ? "Администратор" : user.role === "DOCTOR" ? "Врач" : "Пациент"}
          </span>
        </div>

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
            href={user.role === "DOCTOR" ? "/doctor/settings" : user.role === "ADMIN" ? "/admin/settings" : "/dashboard/settings"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Настройки</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Выйти</span>
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
