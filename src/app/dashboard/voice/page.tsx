"use client"

import { useState, useRef, useEffect } from "react"
import { Mic, MicOff, Volume2, Loader2, MessageSquare } from "lucide-react"
import { DashboardBackground } from "@/components/dashboard-background"

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
  }
}

export default function VoiceAssistantPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; text: string }>>([])
  const [error, setError] = useState("")
  const [isSupported, setIsSupported] = useState(true)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        setIsSupported(false)
        setError("Браузер не поддерживает распознавание речи. Используйте Chrome или Edge.")
      }
    }
  }, [])

  const startRecording = () => {
    setError("")
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError("Браузер не поддерживает распознавание речи")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "kk-KZ"
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setIsRecording(true)
    }

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript
      setIsRecording(false)
      
      if (transcript) {
        setMessages(prev => [...prev, { role: "user", text: transcript }])
        await processWithAI(transcript)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error)
      setIsRecording(false)
      if (event.error === 'no-speech') {
        setError("Речь не обнаружена. Попробуйте ещё раз.")
      } else if (event.error === 'not-allowed') {
        setError("Доступ к микрофону запрещён.")
      } else {
        setError(`Ошибка: ${event.error}`)
      }
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsRecording(false)
  }

  const processWithAI = async (text: string) => {
    setIsProcessing(true)
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })

      if (!response.ok) throw new Error("AI error")
      
      const data = await response.json()
      const aiResponse = data.response || data.message || "Кешіріңіз, жауап ала алмадым."
      
      setMessages(prev => [...prev, { role: "ai", text: aiResponse }])
      speakResponse(aiResponse)
    } catch (err) {
      console.error("AI error:", err)
      setError("AI өңдеу қатесі")
    } finally {
      setIsProcessing(false)
    }
  }

  const speakResponse = (text: string) => {
    if ('speechSynthesis' in window) {
      setIsSpeaking(true)
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "kk-KZ"
      utterance.rate = 0.9
      
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      
      window.speechSynthesis.speak(utterance)
    }
  }

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

  if (!isSupported) {
    return (
      <div className="min-h-screen relative">
        <DashboardBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
          <div className="text-red-400 text-xl mb-4">⚠️ Браузер не поддерживает голосовой ввод</div>
          <p className="text-gray-400">Используйте Google Chrome или Microsoft Edge</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      <DashboardBackground />
      
      <div className="relative z-10 p-6 lg:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🎤 Дауыстық көмекші / Голосовой ассистент</h1>
          <p className="text-muted-foreground">
            Қазақша немесе орысша сөйлеңіз — AI жауап береді
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Voice Control */}
          <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-8">
            <div className="flex flex-col items-center justify-center min-h-[400px]">
              <div className="text-center mb-8">
                {isRecording && (
                  <div className="flex items-center gap-2 text-red-500 animate-pulse">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-lg font-medium">Тыңдаймын... / Слушаю...</span>
                  </div>
                )}
                {isProcessing && (
                  <div className="flex items-center gap-2 text-blue-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-lg font-medium">Өңделуде... / Обработка...</span>
                  </div>
                )}
                {isSpeaking && (
                  <div className="flex items-center gap-2 text-emerald-500">
                    <Volume2 className="w-5 h-5 animate-pulse" />
                    <span className="text-lg font-medium">AI сөйлеуде... / AI говорит...</span>
                  </div>
                )}
                {!isRecording && !isProcessing && !isSpeaking && (
                  <span className="text-lg text-muted-foreground">
                    Микрофонды басыңыз / Нажмите на микрофон
                  </span>
                )}
              </div>

              {/* Main Button */}
              {isSpeaking ? (
                <button
                  onClick={stopSpeaking}
                  className="w-32 h-32 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-2xl hover:shadow-amber-500/50 transition-all duration-300 relative z-50 cursor-pointer"
                >
                  <Volume2 className="w-12 h-12 animate-pulse" />
                </button>
              ) : isRecording ? (
                <button
                  onClick={stopRecording}
                  className="w-32 h-32 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white flex items-center justify-center shadow-2xl animate-pulse relative z-50 cursor-pointer"
                >
                  <MicOff className="w-12 h-12" />
                </button>
              ) : (
                <button
                  onClick={() => { console.log("Button clicked!"); startRecording(); }}
                  disabled={isProcessing}
                  className="w-32 h-32 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-2xl hover:shadow-emerald-500/50 hover:scale-105 transition-all duration-300 disabled:opacity-50 relative z-50 cursor-pointer"
                >
                  {isProcessing ? (
                    <Loader2 className="w-12 h-12 animate-spin" />
                  ) : (
                    <Mic className="w-12 h-12" />
                  )}
                </button>
              )}

              {error && (
                <div className="mt-6 p-4 rounded-xl bg-red-500/10 text-red-500 text-center max-w-sm">
                  {error}
                </div>
              )}

              <p className="mt-8 text-sm text-muted-foreground text-center max-w-sm">
                💡 Используйте Chrome или Edge для лучшего распознавания
              </p>
            </div>
          </div>

          {/* Chat History */}
          <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <h2 className="font-semibold">Сөйлесу тарихы / История разговора</h2>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Mic className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Әзірше хабарлама жоқ / Пока нет сообщений</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl ${
                      msg.role === "user"
                        ? "bg-muted/50 ml-8"
                        : "bg-emerald-500/10 mr-8 border border-emerald-500/20"
                    }`}
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      {msg.role === "user" ? "Сіз / Вы" : "AI"}
                    </p>
                    <p className="text-sm">{msg.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-4 text-center">
            <div className="text-2xl mb-2">🇰🇿</div>
            <h3 className="font-medium">Қазақ тілі</h3>
            <p className="text-sm text-muted-foreground">Web Speech API</p>
          </div>
          <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-4 text-center">
            <div className="text-2xl mb-2">🇷🇺</div>
            <h3 className="font-medium">Русский язык</h3>
            <p className="text-sm text-muted-foreground">Полная поддержка</p>
          </div>
          <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-4 text-center">
            <div className="text-2xl mb-2">🧠</div>
            <h3 className="font-medium">AI Assistant</h3>
            <p className="text-sm text-muted-foreground">Powered by Llama 3.1</p>
          </div>
        </div>
      </div>
    </div>
  )
}
