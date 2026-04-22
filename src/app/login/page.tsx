"use client"

import Link from "next/link"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/logo"
import { ArrowRight, Loader2, Eye, EyeOff } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  
  const [focused, setFocused] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const activityLevel = useMemo(() => {
    return Math.min((email.length + password.length) / 30, 1)
  }, [email, password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Неверный email или пароль")
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError("Произошла ошибка. Попробуйте снова.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-96 h-96">
            {/* Concentric circles */}
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-full border transition-all duration-700 ease-out"
                style={{
                  transform: `scale(${0.2 + i * 0.2 + activityLevel * 0.1 * (5 - i)})`,
                  borderColor: `rgba(255, 255, 255, ${0.05 + activityLevel * 0.15})`,
                  opacity: 0.5 + activityLevel * 0.5,
                }}
              />
            ))}

            {[...Array(8)].map((_, i) => (
              <div
                key={`particle-${i}`}
                className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-background/40 transition-all duration-500"
                style={{
                  transform: `
                    translate(-50%, -50%) 
                    rotate(${i * 45 + activityLevel * 180}deg) 
                    translateX(${80 + activityLevel * 60}px)
                  `,
                  opacity: activityLevel > 0.1 ? 0.3 + activityLevel * 0.7 : 0,
                  scale: activityLevel > 0.1 ? 0.5 + activityLevel * 0.5 : 0,
                }}
              />
            ))}

            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background transition-all duration-300"
              style={{
                width: `${12 + activityLevel * 8}px`,
                height: `${12 + activityLevel * 8}px`,
                boxShadow: `0 0 ${20 + activityLevel * 40}px ${activityLevel * 20}px rgba(255,255,255,${0.1 + activityLevel * 0.2})`,
              }}
            />
          </div>
        </div>

        <div className="absolute bottom-12 left-12 right-12">
          <p className="text-background/60 text-sm font-light leading-relaxed max-w-md">
            Платформа нового поколения для нейродиагностики с использованием искусственного интеллекта
          </p>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex flex-col">
        <header className="p-8 lg:p-12">
          <Link href="/" className="inline-block">
            <Logo size="default" />
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center px-8 lg:px-12 pb-24">
          <div className="w-full max-w-sm opacity-0 animate-fade-up">
            <div className="space-y-10">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight mb-3">Вход</h1>
                <p className="text-muted-foreground">Войдите в свой аккаунт для доступа к платформе</p>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-6">
                  {/* Email field */}
                  <div className="relative">
                    <label
                      className={`absolute left-0 transition-all duration-300 pointer-events-none ${
                        focused === "email" || email
                          ? "text-xs -top-6 text-foreground"
                          : "text-sm top-3 text-muted-foreground"
                      }`}
                    >
                      Email
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 px-0 border-0 border-b-2 border-border rounded-none bg-transparent focus:border-foreground focus-visible:ring-0 transition-colors"
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      required
                      disabled={loading}
                    />
                  </div>

                  {/* Password field */}
                  <div className="relative">
                    <label
                      className={`absolute left-0 transition-all duration-300 pointer-events-none ${
                        focused === "password" || password
                          ? "text-xs -top-6 text-foreground"
                          : "text-sm top-3 text-muted-foreground"
                      }`}
                    >
                      Пароль
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 px-0 pr-10 border-0 border-b-2 border-border rounded-none bg-transparent focus:border-foreground focus-visible:ring-0 transition-colors"
                        onFocus={() => setFocused("password")}
                        onBlur={() => setFocused(null)}
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full h-14 rounded-full text-base group" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <span>Войти</span>
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <LoginForm />
}
