"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useSession } from "next-auth/react"
import { 
  Mic, 
  Square, 
  Loader2, 
  User, 
  Stethoscope,
  Activity,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Save,
  Download,
  ClipboardList,
  Eye,
  Brain,
  Calendar,
  Users,
  Pause,
  Play
} from "lucide-react"
import { DashboardBackground } from "@/components/dashboard-background"
import { cn } from "@/lib/utils"
import { generateConsultationPdf } from "@/lib/pdf-generator"
import { RecordingAlerts } from "@/components/recording-alerts"
import { ConsultationFeedback } from "@/components/consultation-feedback"
import { 
  SpeakerIdentification, 
  DialogueWithSpeakers,
  parseDialogueWithSpeakers,
  autoDetectSpeakerRoles,
  type SpeakerRole,
  type DialogueLineWithSpeaker
} from "@/components/speaker-identification"
import { useEncounter, type EncounterState } from "@/hooks/use-encounter"
import { PausedEncounters } from "@/components/paused-encounters"

// WebSocket URL - через nginx прокси для HTTPS совместимости
// In development, connect directly to backend; in production, use nginx proxy
const getWsUrl = () => {
  if (typeof window === "undefined") return "ws://localhost:8001/ws/analyze"
  
  // In production (HTTPS), use the proxy path
  if (window.location.protocol === "https:") {
    return `wss://${window.location.host}/ws/analyze`
  }
  
  // In development, connect directly to backend on port 8001
  return `ws://${window.location.hostname}:8001/ws/analyze`
}
const WS_URL = getWsUrl()

interface AnalysisResult {
  status: string
  result: ReportFields
}

// SOAP Format fields
interface ReportFields {
  // SOAP Format
  subjective?: string      // Patient's complaints, symptoms, history
  objective?: string       // Provider's observations, vital signs
  assessment?: string      // Diagnosis, clinical impressions
  differentialDiagnosis?: string // Alternative diagnoses when mentioned
  plan?: string           // Treatment plan, follow-up
  
  // Legacy fields
  generalCondition: string
  dialogueProtocol: string
  recommendations: string
  conclusion: string
}

// Extract unique speakers from dialogue
function extractSpeakers(rawDialogue: string): string[] {
  const speakerSet = new Set<string>()
  const lines = rawDialogue.split("\n")
  
  lines.forEach(line => {
    const match = line.match(/^(SPEAKER_\d+):/)
    if (match) {
      speakerSet.add(match[1])
    }
  })
  
  return Array.from(speakerSet).sort()
}

export default function ConsultationPage() {
  const { data: session } = useSession()
  const userId = session?.user?.id || null
  
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState("")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [savedReportId, setSavedReportId] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [finalRecordingTime, setFinalRecordingTime] = useState(0)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState("")
  
  // Speaker identification state
  const [speakerLabels, setSpeakerLabels] = useState<Record<string, SpeakerRole>>({})
  const [speakers, setSpeakers] = useState<string[]>([])
  const [dialogueLines, setDialogueLines] = useState<DialogueLineWithSpeaker[]>([])
  
  // Recording interruption state
  const [isPaused, setIsPaused] = useState(false)
  
  // Encounter management
  const {
    currentEncounter,
    pausedEncounters,
    isLoading: encounterLoading,
    pauseEncounter,
    resumeEncounter,
    startEncounter,
    completeEncounter
  } = useEncounter(userId)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (wsRef.current) wsRef.current.close()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  useEffect(() => {
    setPdfError("")
    setPdfLoading(false)
  }, [result])

  const startRecording = async () => {
    try {
      setError("")
      setResult(null)
      audioChunksRef.current = []
      setSpeakerLabels({})
      setSpeakers([])
      setDialogueLines([])
      setIsPaused(false)
      
      // Start encounter tracking (if not resuming)
      if (!currentEncounter && userId) {
        await startEncounter({ step: "recording" })
      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      })
      
      streamRef.current = stream

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
          ? "audio/webm;codecs=opus" 
          : "audio/webm"
      })
      
      mediaRecorderRef.current = mediaRecorder
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        
        // Create audio blob and send to WebSocket
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        sendAudioToServer(audioBlob)
      }

      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      setRecordingTime(0)
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error("Failed to start recording:", err)
      setError("Не удалось получить доступ к микрофону. Разрешите доступ в настройках браузера.")
    }
  }

  // Handle microphone lost
  const handleMicrophoneLost = useCallback(() => {
    setIsPaused(true)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Handle microphone restored
  const handleMicrophoneRestored = useCallback(() => {
    setIsPaused(false)
    if (isRecording && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    }
  }, [isRecording])

  // Handle interruption (phone call, etc.)
  const handleInterruption = useCallback((type: "phone" | "audio_focus") => {
    console.log("Recording interrupted:", type)
    setIsPaused(true)
  }, [])

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsProcessing(true)
      setFinalRecordingTime(recordingTime)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      // Complete encounter if active
      if (currentEncounter) {
        completeEncounter()
      }
    }
  }

  // Pause recording and save state
  const pauseRecording = async () => {
    if (!isRecording) return
    
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    // Pause the media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause()
    }
    
    setIsPaused(true)
    
    // Save state to encounter
    if (currentEncounter) {
      const state: EncounterState = {
        step: "recording",
        recordingTime,
        speakerLabels: speakerLabels as Record<string, string>,
      }
      await pauseEncounter(state)
    }
    
    // Stop the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    setIsRecording(false)
  }

  // Resume from paused encounter
  const handleResumeEncounter = async (encounterId: string) => {
    const encounter = await resumeEncounter(encounterId)
    if (encounter?.state) {
      const state = encounter.state as EncounterState
      
      // Restore state
      if (state.recordingTime) {
        setRecordingTime(state.recordingTime)
      }
      if (state.speakerLabels) {
        setSpeakerLabels(state.speakerLabels as Record<string, SpeakerRole>)
      }
      
      // Start recording again
      await startRecording()
    }
    return encounter
  }

  const saveReport = async () => {
    if (!result?.result) return
    
    setIsSaving(true)
    setError("")
    
    try {
      const response = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report: {
            ...result.result,
            // Include SOAP format
            subjective: result.result.subjective,
            objective: result.result.objective,
            assessment: result.result.assessment,
            differentialDiagnosis: result.result.differentialDiagnosis,
            plan: result.result.plan
          },
          recordingDuration: finalRecordingTime,
          speakerLabels: speakerLabels
        })
      })
      
      if (!response.ok) {
        throw new Error("Failed to save report")
      }
      
      const savedData = await response.json()
      setSavedReportId(savedData.report?.id || null)
      setIsSaved(true)
      setShowFeedback(true)
    } catch (err) {
      console.error("Error saving report:", err)
      setError("Не удалось сохранить отчёт")
    } finally {
      setIsSaving(false)
    }
  }

  const downloadPdf = async () => {
    if (!result?.result) return
    setPdfError("")
    setPdfLoading(true)

    try {
      const blob = await generateConsultationPdf(
        {
          recordingDuration: finalRecordingTime,
          generalCondition: result.result.generalCondition,
          dialogueProtocol: result.result.dialogueProtocol,
          recommendations: result.result.recommendations,
          conclusion: result.result.conclusion,
          createdAt: new Date(),
        },
        { brandName: "AMAN AI" }
      )

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const datePart = new Date().toISOString().split("T")[0]
      link.href = url
      link.download = `Consultation_preview_${datePart}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Error generating consultation PDF:", err)
      setPdfError("PDF генерациясы сәтсіз аяқталды. Кейінірек қайталап көріңіз.")
    } finally {
      setPdfLoading(false)
    }
  }

  const sendAudioToServer = useCallback(async (audioBlob: Blob) => {
    try {
      setWsStatus("connecting")
      
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("WebSocket connected")
        setWsStatus("connected")
        
        // Send audio as binary
        ws.send(audioBlob)
      }

      ws.onmessage = (event) => {
        console.log("Received message:", event.data)
        try {
          const data = JSON.parse(event.data)
          if (data.status === "completed" && data.result) {
            const rawDialogue = data.result.dialogueProtocol ?? data.result.dialogue_protocol ?? data.result.raw_dialogue ?? ""
            
            const normalizedResult: ReportFields = {
              // SOAP format fields
              subjective: data.result.subjective ?? "",
              objective: data.result.objective ?? "",
              assessment: data.result.assessment ?? "",
              differentialDiagnosis: data.result.differentialDiagnosis ?? data.result.differential_diagnosis ?? "",
              plan: data.result.plan ?? "",
              
              // Legacy fields
              generalCondition: data.result.generalCondition ?? data.result.general_condition ?? "",
              dialogueProtocol: rawDialogue,
              recommendations: data.result.recommendations ?? "",
              conclusion: data.result.conclusion ?? ""
            }
            
            // Extract speakers and auto-detect roles
            const detectedSpeakers = extractSpeakers(rawDialogue)
            setSpeakers(detectedSpeakers)
            
            // Parse dialogue lines
            const parsedLines = parseDialogueWithSpeakers(rawDialogue)
            setDialogueLines(parsedLines)
            
            // Auto-detect speaker roles
            const autoLabels = autoDetectSpeakerRoles(parsedLines)
            setSpeakerLabels(autoLabels)
            
            setResult({ status: data.status, result: normalizedResult })
            setIsProcessing(false)
            setWsStatus("disconnected")
          } else if (data.status === "error") {
            setError(data.message || "Ошибка обработки аудио")
            setIsProcessing(false)
            setWsStatus("disconnected")
          }
        } catch (e) {
          console.error("Failed to parse response:", e)
        }
      }

      ws.onerror = () => {
        console.warn("WebSocket connection failed - analysis service may be unavailable")
        setError("Сервер анализа недоступен. Убедитесь, что backend запущен на порту 8001.")
        setIsProcessing(false)
        setWsStatus("disconnected")
      }

      ws.onclose = () => {
        console.log("WebSocket closed")
        setWsStatus("disconnected")
      }

    } catch (err) {
      console.error("Failed to send audio:", err)
      setError("Ошибка отправки аудио на сервер")
      setIsProcessing(false)
      setWsStatus("disconnected")
    }
  }, [])

  const hasResultContent = !!(
    result?.result?.conclusion ||
    result?.result?.generalCondition ||
    result?.result?.recommendations ||
    result?.result?.dialogueProtocol ||
    result?.result?.subjective ||
    result?.result?.objective ||
    result?.result?.assessment ||
    result?.result?.plan
  )
  const isPdfDisabled = !hasResultContent || pdfLoading
  
  // Check if SOAP format is available
  const hasSOAPFormat = !!(
    result?.result?.subjective ||
    result?.result?.objective ||
    result?.result?.assessment ||
    result?.result?.plan
  )
  
  // Handle speaker label change
  const handleSpeakerLabelChange = (speakerId: string, role: SpeakerRole) => {
    setSpeakerLabels(prev => ({ ...prev, [speakerId]: role }))
  }

  return (
    <div className="min-h-screen relative">
      <DashboardBackground />
      
      {/* Recording Alerts (Microphone Lost / Phone Interruption) */}
      <RecordingAlerts
        isRecording={isRecording}
        onMicrophoneLost={handleMicrophoneLost}
        onMicrophoneRestored={handleMicrophoneRestored}
        onInterruption={handleInterruption}
      />
      
      <div className="relative z-10 p-6 lg:p-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🩺 Запись консультации</h1>
          <p className="text-muted-foreground">
            Записывайте разговор с пациентом — AI автоматически расшифрует и создаст структурированное заключение (SOAP формат)
          </p>
        </div>

        {/* Paused Encounters */}
        <div className="max-w-4xl mx-auto">
          <PausedEncounters
            encounters={pausedEncounters}
            onResume={handleResumeEncounter}
            isLoading={encounterLoading}
          />
        </div>

        {/* Recording Section */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-8 mb-8">
            <div className="flex flex-col items-center justify-center min-h-[300px]">
              
              {/* Status */}
              <div className="text-center mb-8 h-8">
                {isRecording && !isPaused && (
                  <div className="flex items-center gap-2 text-red-500 animate-pulse">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                    <span className="text-lg font-medium">Запись: {formatTime(recordingTime)}</span>
                  </div>
                )}
                {isRecording && isPaused && (
                  <div className="flex items-center gap-2 text-amber-500">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-lg font-medium">Приостановлено: {formatTime(recordingTime)}</span>
                  </div>
                )}
                {isProcessing && (
                  <div className="flex items-center gap-2 text-amber-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-lg font-medium">
                      {wsStatus === "connecting" && "Подключение к серверу..."}
                      {wsStatus === "connected" && "Анализ аудио... Это может занять минуту"}
                    </span>
                  </div>
                )}
                {!isRecording && !isProcessing && !result && (
                  <span className="text-lg text-muted-foreground">
                    Нажмите для начала записи
                  </span>
                )}
                {result && (
                  <div className="flex items-center gap-2 text-emerald-500">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-lg font-medium">Анализ завершён</span>
                  </div>
                )}
              </div>

              {/* Record Button */}
              <div className="relative">
                {isRecording && (
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                )}
                
                {isRecording ? (
                  <div className="flex items-center gap-6">
                    {/* Pause Button */}
                    <button
                      onClick={pauseRecording}
                      disabled={encounterLoading}
                      className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xl shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105 transition-all duration-300 cursor-pointer z-50 disabled:opacity-50"
                      title="Приостановить"
                    >
                      <Pause className="w-8 h-8" />
                    </button>
                    
                    {/* Stop Button */}
                    <button
                      onClick={stopRecording}
                      className="relative w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center shadow-2xl shadow-red-500/30 hover:shadow-red-500/50 hover:scale-105 transition-all duration-300 cursor-pointer z-50"
                      title="Остановить и обработать"
                    >
                      <Square className="w-12 h-12" />
                    </button>
                  </div>
                ) : isProcessing ? (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-2xl">
                    <Loader2 className="w-12 h-12 animate-spin" />
                  </div>
                ) : (
                  <button
                    onClick={startRecording}
                    className="relative w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 transition-all duration-300 cursor-pointer z-50"
                  >
                    <Mic className="w-12 h-12" />
                  </button>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-center max-w-md flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Instructions */}
              {!isRecording && !isProcessing && !result && (
                <p className="mt-8 text-sm text-muted-foreground text-center max-w-md">
                  💡 Нажмите кнопку и начните консультацию. AI автоматически разделит речь врача и пациента и создаст структурированный отчёт.
                </p>
              )}
            </div>
          </div>

          {/* Results */}
          {result && result.result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Speaker Identification - only show if we have multiple speakers */}
              {speakers.length > 1 && (
                <SpeakerIdentification
                  speakers={speakers}
                  speakerLabels={speakerLabels}
                  onLabelChange={handleSpeakerLabelChange}
                  dialogueLines={dialogueLines}
                />
              )}
              
              {/* SOAP Format Sections */}
              {hasSOAPFormat ? (
                <>
                  {/* Subjective - Patient's complaints */}
                  {result.result.subjective && (
                    <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-medium">Subjective (S)</h3>
                          <p className="text-xs text-muted-foreground">Жалобы пациента</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.result.subjective}</p>
                    </div>
                  )}

                  {/* Objective - Provider's observations */}
                  {result.result.objective && (
                    <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <Eye className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="font-medium">Objective (O)</h3>
                          <p className="text-xs text-muted-foreground">Объективные данные</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.result.objective}</p>
                    </div>
                  )}

                  {/* Assessment - Diagnosis */}
                  <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-sm rounded-2xl border border-emerald-500/20 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Assessment (A)</h2>
                        <p className="text-xs text-muted-foreground">Оценка / Диагноз</p>
                      </div>
                    </div>
                    <p className="text-lg font-medium text-emerald-400">
                      {result.result.assessment || result.result.conclusion}
                    </p>
                    
                    {/* Differential Diagnosis - when mentioned */}
                    {result.result.differentialDiagnosis && (
                      <div className="mt-4 pt-4 border-t border-emerald-500/20">
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong className="text-amber-400">Дифференциальный диагноз:</strong>
                        </p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {result.result.differentialDiagnosis}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Plan - Treatment plan */}
                  <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 backdrop-blur-sm rounded-2xl border border-amber-500/20 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <ClipboardList className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Plan (P)</h2>
                        <p className="text-xs text-muted-foreground">План лечения</p>
                      </div>
                    </div>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {result.result.plan || result.result.recommendations}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Legacy Format - Conclusion Card */}
                  <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-sm rounded-2xl border border-emerald-500/20 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-emerald-500" />
                      </div>
                      <h2 className="text-xl font-semibold">Заключение</h2>
                    </div>
                    <p className="text-lg font-medium text-emerald-400">{result.result.conclusion}</p>
                  </div>

                  {/* General Condition */}
                  {result.result.generalCondition && (
                    <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-blue-400" />
                        </div>
                        <h3 className="font-medium">Жалпы жағдай / Общее состояние</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{result.result.generalCondition}</p>
                    </div>
                  )}

                  {/* Recommendations */}
                  {result.result.recommendations && (
                    <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 backdrop-blur-sm rounded-2xl border border-amber-500/20 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-amber-500" />
                        </div>
                        <h2 className="text-xl font-semibold">Рекомендации</h2>
                      </div>
                      <p className="text-muted-foreground">{result.result.recommendations}</p>
                    </div>
                  )}
                </>
              )}

              {/* Dialogue with Speaker Identification */}
              <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Расшифровка диалога</h2>
                    <p className="text-xs text-muted-foreground">
                      {speakers.length > 0 && `${speakers.length} участник(ов) обнаружено`}
                    </p>
                  </div>
                </div>
                
                {dialogueLines.length > 0 ? (
                  <DialogueWithSpeakers
                    lines={dialogueLines}
                    speakerLabels={speakerLabels}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Диалог не обнаружен
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center gap-4">
                {!isSaved ? (
                  <button
                    onClick={saveReport}
                    disabled={isSaving}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Сохранить отчёт
                      </>
                    )}
                  </button>
                ) : (
                  <div className="px-6 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Отчёт сохранён
                  </div>
                )}
                <button
                  onClick={downloadPdf}
                  disabled={isPdfDisabled}
                  className="px-6 py-3 rounded-xl border border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {pdfLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      PDF...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Скачать PDF
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setResult(null)
                    setRecordingTime(0)
                    setIsSaved(false)
                    setSavedReportId(null)
                    setShowFeedback(false)
                  }}
                  className="px-6 py-3 rounded-xl bg-foreground text-background font-medium hover:opacity-90 transition-opacity"
                >
                  Начать новую запись
                </button>
              </div>
              {pdfError && (
                <p className="text-sm text-red-500 text-center mt-2">{pdfError}</p>
              )}

              {/* Feedback Section - Show after save */}
              {isSaved && showFeedback && savedReportId && (
                <ConsultationFeedback
                  reportId={savedReportId}
                  onSubmit={() => setShowFeedback(false)}
                  onClose={() => setShowFeedback(false)}
                />
              )}
            </div>
          )}
        </div>

        {/* Features */}
        {!result && (
          <div className="mt-8 grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-4 text-center">
              <div className="text-2xl mb-2">🎙️</div>
              <h3 className="font-medium">Диаризация</h3>
              <p className="text-sm text-muted-foreground">Разделение на врача и пациента</p>
            </div>
            <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-4 text-center">
              <div className="text-2xl mb-2">🧠</div>
              <h3 className="font-medium">AI Анализ</h3>
              <p className="text-sm text-muted-foreground">Структурированное заключение</p>
            </div>
            <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-4 text-center">
              <div className="text-2xl mb-2">📋</div>
              <h3 className="font-medium">Рекомендации</h3>
              <p className="text-sm text-muted-foreground">Автоматические назначения</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
