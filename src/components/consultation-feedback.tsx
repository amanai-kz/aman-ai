"use client"

import { useState } from "react"
import { Star, Send, Loader2, CheckCircle2, MessageSquare, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConsultationFeedbackProps {
  reportId: string
  onSubmit?: (feedback: FeedbackData) => void
  onClose?: () => void
}

export interface FeedbackData {
  rating: number
  feedbackText: string
  feedbackCategories: string[]
}

const FEEDBACK_CATEGORIES = [
  { id: "accuracy", label: "Точность диагноза", icon: "🎯" },
  { id: "formatting", label: "Форматирование", icon: "📝" },
  { id: "completeness", label: "Полнота данных", icon: "✅" },
  { id: "recommendations", label: "Качество рекомендаций", icon: "💡" },
  { id: "transcription", label: "Расшифровка речи", icon: "🎙️" },
  { id: "speed", label: "Скорость анализа", icon: "⚡" },
]

export function ConsultationFeedback({ 
  reportId, 
  onSubmit, 
  onClose 
}: ConsultationFeedbackProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [feedbackText, setFeedbackText] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState("")

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    )
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Пожалуйста, поставьте оценку")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch(`/api/consultation/${reportId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          feedbackText,
          feedbackCategories: selectedCategories,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit feedback")
      }

      setIsSubmitted(true)
      onSubmit?.({
        rating,
        feedbackText,
        feedbackCategories: selectedCategories,
      })
    } catch (err) {
      console.error("Error submitting feedback:", err)
      setError("Не удалось отправить отзыв. Попробуйте позже.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-sm rounded-2xl border border-emerald-500/20 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Спасибо за отзыв!</h3>
          <p className="text-muted-foreground max-w-md">
            Ваш отзыв поможет нам улучшить качество AI-анализа и сделать AMAN AI ещё лучше.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 backdrop-blur-sm rounded-2xl border border-violet-500/20 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Оцените качество AI-анализа</h3>
            <p className="text-sm text-muted-foreground">
              Ваш отзыв поможет улучшить систему
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Star Rating */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-3">Общая оценка</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="relative group transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                className={cn(
                  "w-10 h-10 transition-all duration-200",
                  (hoveredRating || rating) >= star
                    ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                    : "text-muted-foreground/30 hover:text-muted-foreground/50"
                )}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            {rating === 1 && "Плохо"}
            {rating === 2 && "Удовлетворительно"}
            {rating === 3 && "Хорошо"}
            {rating === 4 && "Очень хорошо"}
            {rating === 5 && "Отлично"}
          </p>
        )}
      </div>

      {/* Category Chips */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-3">Что можно улучшить? (необязательно)</p>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryToggle(category.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                selectedCategories.includes(category.id)
                  ? "bg-violet-500/30 text-violet-300 border border-violet-500/40"
                  : "bg-background/60 border border-border hover:border-violet-500/30 hover:bg-violet-500/10"
              )}
            >
              <span className="mr-1.5">{category.icon}</span>
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Text */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-3">Комментарий (необязательно)</p>
        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Поделитесь подробностями, как мы можем улучшить AI-анализ..."
          className="w-full h-24 px-4 py-3 rounded-xl bg-background/60 border border-border focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 resize-none transition-all placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || rating === 0}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Отправка...
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            Отправить отзыв
          </>
        )}
      </button>
    </div>
  )
}


