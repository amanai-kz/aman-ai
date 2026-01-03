"use client"

import { useState } from "react"
import { 
  Pause, 
  Play, 
  Clock, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Encounter, EncounterState } from "@/hooks/use-encounter"

interface PausedEncountersProps {
  encounters: Encounter[]
  onResume: (encounterId: string) => Promise<Encounter | null>
  isLoading: boolean
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Только что"
  if (diffMins < 60) return `${diffMins} мин. назад`
  if (diffHours < 24) return `${diffHours} ч. назад`
  if (diffDays < 7) return `${diffDays} дн. назад`
  
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function PausedEncounters({ 
  encounters, 
  onResume, 
  isLoading 
}: PausedEncountersProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [resumingId, setResumingId] = useState<string | null>(null)

  if (encounters.length === 0) return null

  const handleResume = async (encounterId: string) => {
    setResumingId(encounterId)
    await onResume(encounterId)
    setResumingId(null)
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl overflow-hidden mb-6">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-amber-500/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Pause className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-left">
            <h3 className="font-medium text-amber-400">
              Приостановленные консультации
            </h3>
            <p className="text-xs text-muted-foreground">
              {encounters.length} сессия{encounters.length > 1 ? "и" : ""} ожидает продолжения
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* List */}
      {isExpanded && (
        <div className="px-5 pb-4 space-y-3">
          {encounters.map((encounter) => {
            const state = encounter.state as EncounterState | null
            const recordingTime = state?.recordingTime || 0
            const isResuming = resumingId === encounter.id

            return (
              <div
                key={encounter.id}
                className="bg-background/60 rounded-xl p-4 flex items-center gap-4"
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Приостановлено {formatTimeAgo(encounter.paused_at || encounter.updated_at)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {recordingTime > 0 && (
                      <span className="px-2 py-1 bg-muted rounded-lg">
                        Записано: {formatDuration(recordingTime)}
                      </span>
                    )}
                    {state?.step && (
                      <span className="px-2 py-1 bg-muted rounded-lg">
                        Шаг: {state.step}
                      </span>
                    )}
                  </div>
                </div>

                {/* Resume button */}
                <button
                  onClick={() => handleResume(encounter.id)}
                  disabled={isLoading || isResuming}
                  className={cn(
                    "px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition-all",
                    "bg-amber-500 text-black hover:bg-amber-400",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isResuming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Продолжить
                    </>
                  )}
                </button>
              </div>
            )
          })}

          {/* Info */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground pt-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Приостановленные сессии сохраняются автоматически. 
              Вы можете продолжить с того места, где остановились.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

