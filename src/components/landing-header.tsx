"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { LayoutDashboard } from "lucide-react"

export function LandingHeader() {
  const { data: session, status } = useSession()
  const isLoading = status === "loading"
  const isAuthenticated = !!session?.user

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/30">
      <div className="max-w-[1600px] mx-auto px-8 md:px-12 lg:px-20 py-5 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-16">
          <Link
            href="#services"
            className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300"
          >
            Сервисы
          </Link>
          <Link
            href="#about"
            className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300"
          >
            О платформе
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          {isLoading ? (
            <div className="h-10 w-24 bg-muted animate-pulse rounded-full" />
          ) : isAuthenticated ? (
            <Button size="sm" className="rounded-full px-6 h-10 gap-2" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground hidden sm:flex h-10 px-5"
                asChild
              >
                <Link href="/register">Регистрация</Link>
              </Button>
              <Button size="sm" className="rounded-full px-6 h-10" asChild>
                <Link href="/login">Войти</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

