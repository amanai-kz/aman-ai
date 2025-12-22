"use client"

import { useState, useRef } from "react"
import { Mic, MicOff, Volume2, Loader2, MessageSquare } from "lucide-react"
import { DashboardBackground } from "@/components/dashboard-background"

export default function VoiceAssistantPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; text: string }>>([])
  const [error, setError] = useState("")

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const startRecording = async () => {
    try {
      setError("")
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        stream.getTracks().forEach(track => track.stop())
        await processAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      setError("Микрофонға қол жеткізу мүмкін емес / Не удалось получить доступ к микрофону")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true)

    try {
      // 1. Speech to Text
      const formData = new FormData()
      formData.append("audio", audioBlob, "recording.webm")

      const sttResponse = await fetch("/api/speech/stt", {
        method: "POST",
        body: formData,
      })

      if (!sttResponse.ok) {
        throw new Error("Speech recognition failed")
      }

      const sttData = await sttResponse.json()
      const recognizedText = sttData.text

      if (!recognizedText) {
        setError("Сөйлеу танылмады. Қайталап көріңіз. / Речь не распознана. Попробуйте снова.")
        setIsProcessing(false)
        return
      }

      setMessages(prev => [...prev, { role: "user", text: recognizedText }])

      // 2. Get AI response
      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: recognizedText }],
        }),
      })

      if (!chatResponse.ok) {
        throw new Error("Chat API failed")
      }

      const chatData = await chatResponse.json()
      const aiResponse = chatData.message

      setMessages(prev => [...prev, { role: "ai", text: aiResponse }])

      // 3. Text to Speech
      await speakResponse(aiResponse)
    } catch {
      setError("Өңдеу қатесі. Қайталап көріңіз. / Ошибка обработки. Попробуйте снова.")
    } finally {
      setIsProcessing(false)
    }
  }

  const speakResponse = async (text: string) => {
    try {
      setIsSpeaking(true)

      // Определяем язык по тексту
      const isRussian = /[а-яё]/i.test(text) && !/[әғқңөұүһі]/i.test(text)
      const lang = isRussian ? "ru-RU" : "kk-KZ"

      const ttsResponse = await fetch("/api/speech/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      })

      if (!ttsResponse.ok) {
        throw new Error("TTS failed")
      }

      const audioBlob = await ttsResponse.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.play()
        audioRef.current.onended = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
        }
      }
    } catch {
      setIsSpeaking(false)
    }
  }

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsSpeaking(false)
    }
  }

  return (
    <div className="min-h-screen relative">
      <DashboardBackground />
      <audio ref={audioRef} className="hidden" />
      
      <div className="relative z-10 p-6 lg:p-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🎤 Дауыстық көмекші / Голосовой ассистент</h1>
          <p className="text-muted-foreground">
            Қазақша немесе орысша сөйлеңіз — AI жауап береді
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left - Voice Control */}
          <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-8">
            <div className="flex flex-col items-center justify-center min-h-[400px]">
              {/* Status */}
              <div className="text-center mb-8">
                {isRecording && (
                  <div className="flex items-center gap-2 text-red-500 animate-pulse">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-lg font-medium">Жазылуда... / Запись...</span>
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
                  className="w-32 h-32 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-2xl hover:shadow-amber-500/50 transition-all duration-300"
                >
                  <Volume2 className="w-12 h-12 animate-pulse" />
                </button>
              ) : isRecording ? (
                <button
                  onClick={stopRecording}
                  className="w-32 h-32 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white flex items-center justify-center shadow-2xl animate-pulse hover:shadow-red-500/50 transition-all duration-300"
                >
                  <MicOff className="w-12 h-12" />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={isProcessing}
                  className="w-32 h-32 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-2xl hover:shadow-emerald-500/50 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isProcessing ? (
                    <Loader2 className="w-12 h-12 animate-spin" />
                  ) : (
                    <Mic className="w-12 h-12" />
                  )}
                </button>
              )}

              {/* Error */}
              {error && (
                <div className="mt-6 p-4 rounded-xl bg-red-500/10 text-red-500 text-center max-w-sm">
                  {error}
                </div>
              )}

              {/* Hint */}
              <p className="mt-8 text-sm text-muted-foreground text-center max-w-sm">
                💡 Кеңес: Анық сөйлеңіз. Қазақша және орысша қолдайды.
                <br />
                Совет: Говорите чётко. Поддерживает казахский и русский.
              </p>
            </div>
          </div>

          {/* Right - Chat History */}
          <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <h2 className="font-semibold">Сөйлесу тарихы / История разговора</h2>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Mic className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Әзірше хабарлама жоқ</p>
                  <p className="text-sm">Пока нет сообщений</p>
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
            <p className="text-sm text-muted-foreground">Толық қолдау</p>
          </div>
          <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-4 text-center">
            <div className="text-2xl mb-2">🇷🇺</div>
            <h3 className="font-medium">Русский язык</h3>
            <p className="text-sm text-muted-foreground">Полная поддержка</p>
          </div>
          <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-4 text-center">
            <div className="text-2xl mb-2">🧠</div>
            <h3 className="font-medium">AI Assistant</h3>
            <p className="text-sm text-muted-foreground">Powered by Yandex</p>
          </div>
        </div>
      </div>
    </div>
  )
}

