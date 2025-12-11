"use client"

import { ExternalLink, Atom, Info, BookOpen, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardBackground } from '@/components/dashboard-background'

const FEATURES = [
  {
    title: "Предсказание структуры",
    description: "Моделирование 3D структуры белка по аминокислотной последовательности"
  },
  {
    title: "Высокая точность",
    description: "Точность на уровне экспериментальных методов (крио-ЭМ, рентген)"
  },
  {
    title: "Комплексы белков",
    description: "Моделирование взаимодействий белок-белок и белок-лиганд"
  },
  {
    title: "Бесплатный доступ",
    description: "Полностью бесплатный сервис от Google DeepMind"
  },
]

const LINKS = [
  {
    title: "AlphaFold Server",
    description: "Официальный сервер для предсказания структуры",
    url: "https://alphafoldserver.com",
    icon: Play,
    primary: true,
  },
  {
    title: "AlphaFold Database",
    description: "База данных предсказанных структур (200M+ белков)",
    url: "https://alphafold.ebi.ac.uk",
    icon: BookOpen,
    primary: false,
  },
  {
    title: "Документация",
    description: "Научные статьи и руководства",
    url: "https://github.com/google-deepmind/alphafold",
    icon: Info,
    primary: false,
  },
]

export default function AlphaFoldPage() {
  return (
    <div className="relative min-h-screen">
      <DashboardBackground />
      
      <div className="relative z-10 p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-up">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Atom className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                AlphaFold Server
              </h1>
              <p className="text-muted-foreground">
                Google DeepMind
              </p>
            </div>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            AlphaFold — революционная система ИИ для предсказания 3D структуры белков 
            по аминокислотной последовательности. Нобелевская премия по химии 2024.
          </p>
        </div>

        {/* External Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-up stagger-1">
          {LINKS.map((link, idx) => {
            const Icon = link.icon
            return (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group bg-background/60 backdrop-blur-sm p-6 rounded-2xl border transition-all hover:border-primary/50 hover:shadow-lg ${
                  link.primary ? 'md:col-span-1 border-primary/30' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2 rounded-xl ${link.primary ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="font-medium mb-1">{link.title}</h3>
                <p className="text-sm text-muted-foreground">{link.description}</p>
                {link.primary && (
                  <Button className="w-full mt-4 gap-2">
                    <Play className="w-4 h-4" />
                    Открыть сервис
                  </Button>
                )}
              </a>
            )
          })}
        </div>

        {/* Features */}
        <div className="animate-fade-up stagger-2">
          <h2 className="text-lg font-medium mb-4">Возможности</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((feature, idx) => (
              <div 
                key={idx}
                className="bg-background/60 backdrop-blur-sm p-5 rounded-2xl border"
              >
                <h3 className="font-medium mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 animate-fade-up stagger-3">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-500/10 rounded-xl flex-shrink-0">
              <Info className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                Внешний сервис
              </h3>
              <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
                AlphaFold Server — внешний сервис от Google DeepMind. Требуется авторизация 
                через Google аккаунт. Результаты можно скачать и загрузить в нашу систему 
                для дальнейшего анализа.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

