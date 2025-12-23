"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { 
  Mic, 
  Square, 
  Loader2, 
  User, 
  Stethoscope,
  Brain,
  Moon,
  Heart,
  Activity,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Save
} from "lucide-react"
import { DashboardBackground } from "@/components/dashboard-background"
import { cn } from "@/lib/utils"

const WS_URL = "ws://89.218.178.215:8001/ws/analyze"

interface AnalysisResult {
  status: string
  result: {
    general_condition: string
    sleep: string
    mood: string
    stress: string
    physical_symptoms: string
    conclusion: string
    recommendations: string
    raw_dialogue: string
  }
}

interface DialogueLine {
  speaker: "doctor" | "patient"
  text: string
}

function parseDialogue(rawDialogue: string): DialogueLine[] {
  const lines = rawDialogue.split("\n").filter(line => line.trim())
  return lines.map(line => {
    const isDoctor = line.startsWith("SPEAKER_00:")
    const text = line.replace(/^SPEAKER_0[01]:\s*/, "").trim()
    return {
      speaker: isDoctor ? "doctor" : "patient",
      text
    }
  })
}

export default function ConsultationPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState("")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [finalRecordingTime, setFinalRecordingTime] = useState(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

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

  const startRecording = async () => {
    try {
      setError("")
      setResult(null)
      audioChunksRef.current = []
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      })

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
    }
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
          result: result.result,
          recordingDuration: finalRecordingTime
        })
      })
      
      if (!response.ok) {
        throw new Error("Failed to save report")
      }
      
      setIsSaved(true)
    } catch (err) {
      console.error("Error saving report:", err)
      setError("Не удалось сохранить отчёт")
    } finally {
      setIsSaving(false)
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
            setResult(data)
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

      ws.onerror = (event) => {
        console.error("WebSocket error:", event)
        setError("Ошибка подключения к серверу анализа")
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

  const dialogueLines = result?.result?.raw_dialogue 
    ? parseDialogue(result.result.raw_dialogue) 
    : []

  return (
    <div className="min-h-screen relative">
      <DashboardBackground />
      
      <div className="relative z-10 p-6 lg:p-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🩺 Запись консультации</h1>
          <p className="text-muted-foreground">
            Записывайте разговор с пациентом — AI автоматически расшифрует и создаст структурированное заключение
          </p>
        </div>

        {/* Recording Section */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-8 mb-8">
            <div className="flex flex-col items-center justify-center min-h-[300px]">
              
              {/* Status */}
              <div className="text-center mb-8 h-8">
                {isRecording && (
                  <div className="flex items-center gap-2 text-red-500 animate-pulse">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                    <span className="text-lg font-medium">Запись: {formatTime(recordingTime)}</span>
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
                  <button
                    onClick={stopRecording}
                    className="relative w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center shadow-2xl shadow-red-500/30 hover:shadow-red-500/50 hover:scale-105 transition-all duration-300 cursor-pointer z-50"
                  >
                    <Square className="w-12 h-12" />
                  </button>
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
              
              {/* Conclusion Card - Highlighted */}
              <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-sm rounded-2xl border border-emerald-500/20 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Stethoscope className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h2 className="text-xl font-semibold">Заключение</h2>
                </div>
                <p className="text-lg font-medium text-emerald-400">{result.result.conclusion}</p>
              </div>

              {/* Info Cards Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                
                {/* General Condition */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-blue-400" />
                    </div>
                    <h3 className="font-medium">Общее состояние</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.result.general_condition}</p>
                </div>

                {/* Sleep */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                      <Moon className="w-4 h-4 text-indigo-400" />
                    </div>
                    <h3 className="font-medium">Сон</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.result.sleep}</p>
                </div>

                {/* Mood */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                      <Heart className="w-4 h-4 text-pink-400" />
                    </div>
                    <h3 className="font-medium">Настроение</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.result.mood}</p>
                </div>

                {/* Stress */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-orange-400" />
                    </div>
                    <h3 className="font-medium">Стресс</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.result.stress}</p>
                </div>

                {/* Physical Symptoms */}
                <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-5 md:col-span-2">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <Brain className="w-4 h-4 text-red-400" />
                    </div>
                    <h3 className="font-medium">Физические симптомы</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.result.physical_symptoms}</p>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 backdrop-blur-sm rounded-2xl border border-amber-500/20 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-500" />
                  </div>
                  <h2 className="text-xl font-semibold">Рекомендации</h2>
                </div>
                <p className="text-muted-foreground">{result.result.recommendations}</p>
              </div>

              {/* Dialogue */}
              <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-purple-400" />
                  </div>
                  <h2 className="text-xl font-semibold">Расшифровка диалога</h2>
                </div>
                
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {dialogueLines.map((line, index) => (
                    <div 
                      key={index}
                      className={cn(
                        "flex gap-3 animate-in fade-in slide-in-from-bottom-2",
                        line.speaker === "doctor" ? "flex-row" : "flex-row-reverse"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        line.speaker === "doctor" 
                          ? "bg-emerald-500/20" 
                          : "bg-blue-500/20"
                      )}>
                        {line.speaker === "doctor" 
                          ? <Stethoscope className="w-4 h-4 text-emerald-400" />
                          : <User className="w-4 h-4 text-blue-400" />
                        }
                      </div>
                      <div className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3",
                        line.speaker === "doctor"
                          ? "bg-emerald-500/10 rounded-tl-sm"
                          : "bg-blue-500/10 rounded-tr-sm"
                      )}>
                        <p className="text-xs text-muted-foreground mb-1">
                          {line.speaker === "doctor" ? "Врач" : "Пациент"}
                        </p>
                        <p className="text-sm">{line.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
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
                  onClick={() => {
                    setResult(null)
                    setRecordingTime(0)
                    setIsSaved(false)
                  }}
                  className="px-6 py-3 rounded-xl bg-foreground text-background font-medium hover:opacity-90 transition-opacity"
                >
                  Начать новую запись
                </button>
              </div>
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

