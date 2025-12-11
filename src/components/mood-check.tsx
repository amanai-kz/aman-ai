"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Smile, Meh, Frown, Angry, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MOODS = [
  { id: "great", label: "Отлично", emoji: "😊", icon: Smile, color: "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30" },
  { id: "good", label: "Хорошо", emoji: "🙂", icon: Smile, color: "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30" },
  { id: "neutral", label: "Нормально", emoji: "😐", icon: Meh, color: "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30" },
  { id: "stressed", label: "Стресс", emoji: "😰", icon: Frown, color: "text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30", trigger: true },
  { id: "anxious", label: "Тревога", emoji: "😟", icon: Angry, color: "text-red-500 bg-red-500/10 hover:bg-red-500/20 border-red-500/30", trigger: true },
]

export function MoodCheck() {
  const [isVisible, setIsVisible] = useState(true)
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [showTrigger, setShowTrigger] = useState(false)
  const router = useRouter()

  const handleMoodSelect = (moodId: string) => {
    setSelectedMood(moodId)
    const mood = MOODS.find(m => m.id === moodId)
    
    if (mood?.trigger) {
      setShowTrigger(true)
    } else {
      // Just thank them and hide after a moment
      setTimeout(() => setIsVisible(false), 1500)
    }
  }

  const handleGoToQuestionnaire = () => {
    router.push("/dashboard/questionnaire")
  }

  if (!isVisible) return null

  return (
    <div className="border border-border rounded-2xl p-5 bg-background/60 backdrop-blur-sm mb-6 animate-fade-up">
      {!selectedMood ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-medium text-sm">Как вы себя чувствуете сегодня?</h3>
            </div>
            <button 
              onClick={() => setIsVisible(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {MOODS.map((mood) => {
              const Icon = mood.icon
              return (
                <button
                  key={mood.id}
                  onClick={() => handleMoodSelect(mood.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-sm font-medium",
                    mood.color
                  )}
                >
                  <span className="text-lg">{mood.emoji}</span>
                  {mood.label}
                </button>
              )
            })}
          </div>
        </>
      ) : showTrigger ? (
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground mb-4">
            Мы заметили, что вы чувствуете {selectedMood === "stressed" ? "стресс" : "тревогу"}. 
            Хотите пройти короткий опросник для оценки уровня стресса?
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={handleGoToQuestionnaire} size="sm" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Пройти опросник
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsVisible(false)}
            >
              Позже
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground">
            Спасибо! Рады, что у вас всё хорошо! 🎉
          </p>
        </div>
      )}
    </div>
  )
}

