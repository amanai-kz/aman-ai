import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ServiceCard } from "@/components/service-card"
import { services } from "@/lib/services"
import { HeroVisual } from "@/components/hero-visual"
import { LandingHeader } from "@/components/landing-header"
import { ArrowRight, ArrowDown } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader />

      <main className="flex-1">
        <section className="relative min-h-[100svh] flex items-center justify-center">
          <HeroVisual />

          <div className="max-w-[1600px] mx-auto px-8 md:px-12 lg:px-20 pt-40 pb-32 w-full">
            <div className="max-w-4xl">
              {/* Label */}
              <div className="flex items-center gap-4 mb-12 opacity-0 animate-fade-up">
                <div className="h-[1px] w-16 bg-foreground/15" />
                <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                  AI Agent Platform
                </span>
              </div>

              {/* Main headline - larger with more contrast */}
              <h1 className="text-[clamp(3rem,8vw,7rem)] font-medium tracking-[-0.03em] leading-[0.9] mb-16 opacity-0 animate-fade-up stagger-1">
                <span className="block">Будущее</span>
                <span className="block text-muted-foreground/40">медицинской</span>
                <span className="block">диагностики</span>
              </h1>

              {/* Subtitle with more space */}
              <p className="text-xl md:text-2xl text-muted-foreground font-light leading-relaxed max-w-xl mb-16 opacity-0 animate-fade-up stagger-2">
                AI Agent платформа для точной диагностики и реабилитации неврологических заболеваний
              </p>

              {/* CTA buttons */}
              <div className="flex flex-wrap items-center gap-6 opacity-0 animate-fade-up stagger-3">
                <Button size="lg" className="rounded-full px-10 h-14 text-base font-medium group" asChild>
                  <Link href="/login">
                    Начать работу
                    <ArrowRight className="ml-3 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="rounded-full px-10 h-14 text-base text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <Link href="#services">Узнать больше</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Scroll indicator - redesigned */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 opacity-0 animate-fade-up stagger-6">
            <Link href="#services" className="flex flex-col items-center gap-4 group">
              <span className="font-mono text-[10px] text-muted-foreground/60 tracking-[0.25em] uppercase">Scroll</span>
              <ArrowDown
                className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors animate-float"
                style={{ animationDuration: "2s" }}
              />
            </Link>
          </div>
        </section>

        {/* Stats section - new addition between hero and services */}
        <section className="py-24 border-t border-border/30">
          <div className="max-w-[1600px] mx-auto px-8 md:px-12 lg:px-20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16">
              {[
                { value: "6", label: "AI сервисов" },
                { value: "98%", label: "Точность диагностики" },
                { value: "<1s", label: "Время анализа" },
                { value: "24/7", label: "Доступность системы" },
              ].map((stat, index) => (
                <div key={stat.label} className={`opacity-0 animate-fade-up stagger-${index + 1}`}>
                  <span className="font-mono text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight">
                    {stat.value}
                  </span>
                  <p className="text-sm text-muted-foreground mt-3">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services section - more space */}
        <section id="services" className="py-32 md:py-48 lg:py-56">
          <div className="max-w-[1600px] mx-auto px-8 md:px-12 lg:px-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-12 mb-24">
              <div>
                <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase mb-6 block">
                  Инструменты
                </span>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-[-0.02em]">AI сервисы</h2>
              </div>
              <p className="text-muted-foreground max-w-md text-lg leading-relaxed">
                Комплексные инструменты для диагностики различных аспектов неврологического здоровья
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {services.map((service, index) => (
                <ServiceCard
                  key={service.id}
                  title={service.title}
                  description={service.description}
                  iconName={service.iconName}
                  href={service.href}
                  index={index}
                />
              ))}
            </div>
          </div>
        </section>

        {/* About section - more minimal and spacious */}
        <section id="about" className="py-32 md:py-48 lg:py-56 border-t border-border/30">
          <div className="max-w-[1600px] mx-auto px-8 md:px-12 lg:px-20">
            <div className="grid lg:grid-cols-2 gap-20 lg:gap-32 items-center">
              <div>
                <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase mb-6 block">
                  О платформе
                </span>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-[-0.02em] mb-10">
                  Технологии следующего поколения
                </h2>
                <div className="space-y-6">
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Aman AI объединяет передовые алгоритмы машинного обучения и глубокие нейронные сети для анализа
                    медицинских данных с беспрецедентной точностью.
                  </p>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Наши модели обучены на миллионах клинических случаев и постоянно совершенствуются для обеспечения
                    максимально точной диагностики.
                  </p>
                </div>
              </div>
              {/* Abstract grid visual */}
              <div className="relative aspect-square">
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-3">
                  {[...Array(9)].map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-2xl transition-all duration-500 opacity-0 animate-scale-in ${
                        i % 2 === 0 ? "bg-secondary/80" : "bg-secondary/40"
                      }`}
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
        </div>
        </section>
      </main>

      <footer className="border-t border-border/30">
        <div className="max-w-[1600px] mx-auto px-8 md:px-12 lg:px-20 py-20 flex flex-col md:flex-row items-center justify-between gap-8">
          <Logo />
          <div className="flex items-center gap-12">
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300">
              Документация
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300">
              Поддержка
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300">
              Контакты
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">© 2025 Aman AI</p>
        </div>
      </footer>
    </div>
  )
}
