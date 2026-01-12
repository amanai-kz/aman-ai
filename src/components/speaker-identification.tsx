"use client"

import { useState, useEffect } from "react"
import { User, Stethoscope, Users, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type SpeakerRole = "Provider" | "Patient" | "Other"

export interface SpeakerLabel {
  speakerId: string
  role: SpeakerRole
  confidence?: number
}

export interface DialogueLineWithSpeaker {
  speakerId: string
  text: string
  role: SpeakerRole
  timestamp?: number
}

interface SpeakerIdentificationProps {
  speakers: string[] // List of unique speaker IDs detected
  speakerLabels: Record<string, SpeakerRole>
  onLabelChange: (speakerId: string, role: SpeakerRole) => void
  dialogueLines?: DialogueLineWithSpeaker[]
}

const ROLE_CONFIG: Record<SpeakerRole, { icon: typeof User; color: string; bgColor: string; label: string; labelKz: string }> = {
  Provider: {
    icon: Stethoscope,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    label: "Врач",
    labelKz: "Дәрігер"
  },
  Patient: {
    icon: User,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    label: "Пациент",
    labelKz: "Науқас"
  },
  Other: {
    icon: Users,
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    label: "Другой",
    labelKz: "Басқа"
  }
}

// Auto-detect speaker roles based on common patterns
export function autoDetectSpeakerRoles(
  dialogueLines: Array<{ speakerId: string; text: string }>
): Record<string, SpeakerRole> {
  const speakerStats: Record<string, { 
    totalWords: number;
    medicalTerms: number;
    questionCount: number;
    symptomMentions: number;
  }> = {}

  // Medical terms that providers typically use
  const medicalTerms = [
    "диагноз", "diagnosis", "рекомендую", "recommend", "назначаю", "prescribe",
    "лечение", "treatment", "терапия", "therapy", "анализ", "analysis", "test",
    "обследование", "examination", "препарат", "medication", "дозировка", "dosage",
    "симптом", "symptom", "жалоба", "complaint", "осмотр", "checkup"
  ]

  // Symptom-related terms that patients typically use
  const symptomTerms = [
    "болит", "hurts", "боль", "pain", "тошнит", "nausea", "голова", "head",
    "температура", "fever", "слабость", "weakness", "устал", "tired",
    "кашель", "cough", "чувствую", "feel", "беспокоит", "worried"
  ]

  // Analyze each speaker's dialogue
  dialogueLines.forEach(line => {
    if (!speakerStats[line.speakerId]) {
      speakerStats[line.speakerId] = {
        totalWords: 0,
        medicalTerms: 0,
        questionCount: 0,
        symptomMentions: 0
      }
    }

    const lowerText = line.text.toLowerCase()
    const words = lowerText.split(/\s+/)

    speakerStats[line.speakerId].totalWords += words.length
    speakerStats[line.speakerId].questionCount += (line.text.match(/\?/g) || []).length

    medicalTerms.forEach(term => {
      if (lowerText.includes(term)) {
        speakerStats[line.speakerId].medicalTerms++
      }
    })

    symptomTerms.forEach(term => {
      if (lowerText.includes(term)) {
        speakerStats[line.speakerId].symptomMentions++
      }
    })
  })

  // Determine roles based on patterns
  const labels: Record<string, SpeakerRole> = {}
  const speakers = Object.keys(speakerStats)

  if (speakers.length === 0) return labels

  // Score each speaker
  const scores = speakers.map(speakerId => {
    const stats = speakerStats[speakerId]
    const providerScore = (stats.medicalTerms * 2) + stats.questionCount - stats.symptomMentions
    const patientScore = (stats.symptomMentions * 2) - stats.medicalTerms
    
    return {
      speakerId,
      providerScore,
      patientScore,
      totalWords: stats.totalWords
    }
  })

  // Sort by provider likelihood
  scores.sort((a, b) => b.providerScore - a.providerScore)

  // Assign roles
  if (scores.length >= 1) {
    // Highest provider score = Provider
    labels[scores[0].speakerId] = "Provider"
  }
  if (scores.length >= 2) {
    // Second highest with most symptom mentions = Patient
    labels[scores[1].speakerId] = "Patient"
  }
  // Rest are Other
  scores.slice(2).forEach(s => {
    labels[s.speakerId] = "Other"
  })

  return labels
}

// Parse dialogue with speaker detection
export function parseDialogueWithSpeakers(
  rawDialogue: string,
  speakerLabels?: Record<string, SpeakerRole>
): DialogueLineWithSpeaker[] {
  const lines = rawDialogue.split("\n").filter(line => line.trim())
  
  const parsedLines = lines.map(line => {
    // Match patterns like "SPEAKER_00:", "SPEAKER_01:", etc.
    const match = line.match(/^(SPEAKER_\d+):\s*(.*)$/)
    
    if (match) {
      const speakerId = match[1]
      const text = match[2].trim()
      const role = speakerLabels?.[speakerId] || 
        (speakerId === "SPEAKER_00" ? "Provider" : speakerId === "SPEAKER_01" ? "Patient" : "Other")
      
      return { speakerId, text, role }
    }
    
    // Fallback for unformatted lines
    return { speakerId: "UNKNOWN", text: line.trim(), role: "Other" as SpeakerRole }
  })

  return parsedLines.filter(line => line.text.length > 0)
}

export function SpeakerIdentification({
  speakers,
  speakerLabels,
  onLabelChange,
  dialogueLines
}: SpeakerIdentificationProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null)
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  if (speakers.length === 0) return null

  return (
    <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <Users className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h3 className="font-medium">Идентификация спикеров</h3>
          <p className="text-xs text-muted-foreground">
            Укажите роль каждого участника разговора
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {speakers.map(speakerId => {
          const currentRole = speakerLabels[speakerId] || "Other"
          const config = ROLE_CONFIG[currentRole]
          const Icon = config.icon
          const isOpen = openDropdown === speakerId

          // Get sample text from this speaker
          const sampleLine = dialogueLines?.find(line => line.speakerId === speakerId)
          const sampleText = sampleLine?.text.substring(0, 50) + (sampleLine && sampleLine.text.length > 50 ? "..." : "")

          return (
            <div
              key={speakerId}
              className="relative"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenDropdown(isOpen ? null : speakerId)
                }}
                className={cn(
                  "w-full p-3 rounded-xl border transition-all",
                  "hover:border-white/20",
                  isOpen ? "border-white/30 bg-white/5" : "border-white/10"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", config.bgColor)}>
                    <Icon className={cn("w-5 h-5", config.color)} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{speakerId}</span>
                      <ChevronDown className={cn(
                        "w-4 h-4 transition-transform",
                        isOpen && "rotate-180"
                      )} />
                    </div>
                    <div className={cn("font-medium", config.color)}>
                      {config.label}
                    </div>
                  </div>
                </div>
                
                {sampleText && (
                  <div className="mt-2 text-xs text-muted-foreground text-left italic truncate">
                    "{sampleText}"
                  </div>
                )}
              </button>

              {/* Dropdown */}
              {isOpen && (
                <div 
                  className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(Object.keys(ROLE_CONFIG) as SpeakerRole[]).map(role => {
                    const roleConfig = ROLE_CONFIG[role]
                    const RoleIcon = roleConfig.icon
                    const isSelected = currentRole === role

                    return (
                      <button
                        key={role}
                        onClick={(e) => {
                          e.stopPropagation()
                          onLabelChange(speakerId, role)
                          setOpenDropdown(null)
                        }}
                        className={cn(
                          "w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors",
                          isSelected && "bg-white/10"
                        )}
                      >
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", roleConfig.bgColor)}>
                          <RoleIcon className={cn("w-4 h-4", roleConfig.color)} />
                        </div>
                        <span className={cn("flex-1 text-left", roleConfig.color)}>
                          {roleConfig.label} / {roleConfig.labelKz}
                        </span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-emerald-400" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Enhanced dialogue display with proper speaker labels
export function DialogueWithSpeakers({
  lines,
  speakerLabels
}: {
  lines: DialogueLineWithSpeaker[]
  speakerLabels: Record<string, SpeakerRole>
}) {
  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
      {lines.map((line, index) => {
        const role = speakerLabels[line.speakerId] || line.role
        const config = ROLE_CONFIG[role]
        const Icon = config.icon
        const isProvider = role === "Provider"

        return (
          <div
            key={index}
            className={cn(
              "flex gap-3 animate-in fade-in slide-in-from-bottom-2",
              isProvider ? "flex-row" : "flex-row-reverse"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
              config.bgColor
            )}>
              <Icon className={cn("w-4 h-4", config.color)} />
            </div>
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-3",
              isProvider
                ? "bg-emerald-500/10 rounded-tl-sm"
                : role === "Patient"
                ? "bg-blue-500/10 rounded-tr-sm"
                : "bg-purple-500/10 rounded-tr-sm"
            )}>
              <p className="text-xs text-muted-foreground mb-1">
                {config.label}
              </p>
              <p className="text-sm">{line.text}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

