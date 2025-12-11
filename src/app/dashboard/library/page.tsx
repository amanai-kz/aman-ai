"use client"

import { useState } from "react"
import { DashboardBackground } from "@/components/dashboard-background"
import { 
  BookOpen, 
  Play, 
  Clock, 
  Star,
  Headphones,
  Video,
  FileText,
  Brain,
  Heart,
  Moon,
  Zap,
  Filter
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ContentType = "all" | "video" | "audio" | "article"
type Category = "all" | "relaxation" | "education" | "exercise" | "sleep"

const CONTENT = [
  {
    id: 1,
    title: "Дыхательная гимнастика 4-7-8",
    description: "Техника для снижения тревоги и улучшения сна",
    type: "video",
    category: "relaxation",
    duration: "5 мин",
    rating: 4.9,
    thumbnail: "🧘",
  },
  {
    id: 2,
    title: "Прогрессивная мышечная релаксация",
    description: "Пошаговое расслабление всех групп мышц",
    type: "audio",
    category: "relaxation",
    duration: "15 мин",
    rating: 4.8,
    thumbnail: "💆",
  },
  {
    id: 3,
    title: "Что такое нейродегенеративные заболевания?",
    description: "Обзор болезней Альцгеймера, Паркинсона и других",
    type: "article",
    category: "education",
    duration: "10 мин",
    rating: 4.7,
    thumbnail: "🧠",
  },
  {
    id: 4,
    title: "Медитация осознанности",
    description: "Базовая практика mindfulness для начинающих",
    type: "audio",
    category: "relaxation",
    duration: "10 мин",
    rating: 4.9,
    thumbnail: "🧘‍♂️",
  },
  {
    id: 5,
    title: "Упражнения для когнитивной функции",
    description: "Тренировка памяти и внимания",
    type: "video",
    category: "exercise",
    duration: "20 мин",
    rating: 4.6,
    thumbnail: "🏋️",
  },
  {
    id: 6,
    title: "Гигиена сна: 10 правил",
    description: "Как улучшить качество сна естественным путём",
    type: "article",
    category: "sleep",
    duration: "8 мин",
    rating: 4.8,
    thumbnail: "😴",
  },
  {
    id: 7,
    title: "Йога для снятия стресса",
    description: "Мягкая практика для расслабления",
    type: "video",
    category: "relaxation",
    duration: "25 мин",
    rating: 4.7,
    thumbnail: "🧘‍♀️",
  },
  {
    id: 8,
    title: "Звуки природы для медитации",
    description: "Фоновые звуки леса, дождя, океана",
    type: "audio",
    category: "relaxation",
    duration: "60 мин",
    rating: 4.9,
    thumbnail: "🌿",
  },
  {
    id: 9,
    title: "Питание для здоровья мозга",
    description: "Продукты, улучшающие когнитивные функции",
    type: "article",
    category: "education",
    duration: "12 мин",
    rating: 4.5,
    thumbnail: "🥗",
  },
]

const TYPE_ICONS = {
  video: Video,
  audio: Headphones,
  article: FileText,
}

const CATEGORY_ICONS = {
  relaxation: Heart,
  education: Brain,
  exercise: Zap,
  sleep: Moon,
}

export default function LibraryPage() {
  const [typeFilter, setTypeFilter] = useState<ContentType>("all")
  const [categoryFilter, setCategoryFilter] = useState<Category>("all")

  const filteredContent = CONTENT.filter(item => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false
    return true
  })

  return (
    <div className="relative min-h-screen">
      <DashboardBackground />
      
      <div className="relative z-10 p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-xl">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Библиотека
              </h1>
              <p className="text-muted-foreground text-sm">
                Образовательные и релаксационные материалы
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 animate-fade-up stagger-1">
          {/* Type Filter */}
          <div className="flex items-center gap-2 bg-background/60 backdrop-blur-sm border rounded-xl p-1">
            {[
              { value: "all", label: "Все", icon: Filter },
              { value: "video", label: "Видео", icon: Video },
              { value: "audio", label: "Аудио", icon: Headphones },
              { value: "article", label: "Статьи", icon: FileText },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTypeFilter(value as ContentType)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  typeFilter === value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 bg-background/60 backdrop-blur-sm border rounded-xl p-1">
            {[
              { value: "all", label: "Все темы" },
              { value: "relaxation", label: "Релаксация" },
              { value: "education", label: "Обучение" },
              { value: "exercise", label: "Упражнения" },
              { value: "sleep", label: "Сон" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setCategoryFilter(value as Category)}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  categoryFilter === value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-up stagger-2">
          {filteredContent.map((item) => {
            const TypeIcon = TYPE_ICONS[item.type as keyof typeof TYPE_ICONS]
            return (
              <div
                key={item.id}
                className="group bg-background/60 backdrop-blur-sm border rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer"
              >
                {/* Thumbnail */}
                <div className="h-40 bg-gradient-to-br from-primary/10 to-secondary flex items-center justify-center text-6xl">
                  {item.thumbnail}
                </div>
                
                {/* Content */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1",
                      item.type === "video" && "bg-red-500/10 text-red-500",
                      item.type === "audio" && "bg-purple-500/10 text-purple-500",
                      item.type === "article" && "bg-blue-500/10 text-blue-500",
                    )}>
                      <TypeIcon className="w-3 h-3" />
                      {item.type === "video" ? "Видео" : item.type === "audio" ? "Аудио" : "Статья"}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.duration}
                    </span>
                  </div>
                  
                  <h3 className="font-medium mb-1 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {item.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-medium">{item.rating}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      <Play className="w-4 h-4" />
                      {item.type === "article" ? "Читать" : "Смотреть"}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filteredContent.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Материалы не найдены</p>
          </div>
        )}
      </div>
    </div>
  )
}

