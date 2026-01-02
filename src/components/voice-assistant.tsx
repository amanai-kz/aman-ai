"use client"

import { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Mic, MicOff, Volume2, Loader2, MessageSquare } from "lucide-react"
import { buildMessagesWithContext, loadSessionContext } from "@/lib/session-context"

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
  const { data: session } = useSession()
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; text: string }>>([])
  const [error, setError] = useState("")
  const [isSupported, setIsSupported] = useState(true)
  const [sessionContext, setSessionContext] = useState("")

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!session?.user?.id) return

    setSessionContext(loadSessionContext(session.user.id))
  }, [session?.user?.id])

  useEffect(() => {
    // Check if Web Speech API is supported
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
    recognition.lang = "kk-KZ" // Казахский язык
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setIsRecording(true)
    }

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript
      setIsRecording(false)
      
      if (transcript) {
        setMessages(prev => [...prev, { role: "user", text: transcript }])
        await processWithAI(transcript)
      }
    }

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error)
      setIsRecording(false)
      if (event.error === 'no-speech') {
        setError("Речь не обнаружена. Попробуйте ещё раз.")
      } else if (event.error === 'not-allowed') {
        setError("Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.")
      } else {
        setError(`Ошибка распознавания: ${event.error}`)
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
      const latestContext = session?.user?.id ? loadSessionContext(session.user.id) : sessionContext
      if (session?.user?.id) {
        setSessionContext(latestContext)
      }

      const history = [...messages, { role: "user" as const, text }]
      const payloadMessages = buildMessagesWithContext(
        history.map((message) => ({
          role: message.role === "ai" ? "assistant" : "user",
          content: message.text,
        })),
        latestContext
      )

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages, sessionContext: latestContext }),
      })

      if (!response.ok) throw new Error("AI error")
      
      const data = await response.json()
      const aiResponse = data.response || data.message || "Кешіріңіз, жауап ала алмадым."
      
      setMessages(prev => [...prev, { role: "ai", text: aiResponse }])
      
      // Play the assistant reply through the Web Speech API
      speakResponse(aiResponse)
    } catch (err) {
      console.error("AI processing error:", err)
      setError("AI өңдеу қатесі / Ошибка обработки AI")
    } finally {
      setIsProcessing(false)
    }
  }

  const speakResponse = (text: string) => {
    if ('speechSynthesis' in window) {
      setIsSpeaking(true)
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "kk-KZ" // Казахский
      utterance.rate = 0.9
      
      utterance.onend = () => {
        setIsSpeaking(false)
      }
      
      utterance.onerror = () => {
        setIsSpeaking(false)
      }
      
      window.speechSynthesis.speak(utterance)
    }
  }

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="text-red-400 text-lg mb-4">
          ⚠️ Браузер не поддерживает голосовой ввод
        </div>
        <p className="text-gray-400">
          Используйте Google Chrome или Microsoft Edge для голосового ассистента.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-6 max-h-[400px]">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Микрофонды басып, сұрағыңызды қойыңыз</p>
            <p className="text-sm mt-2">Нажмите на микрофон и задайте вопрос</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-2xl ${
              msg.role === "user"
                ? "bg-blue-600/20 border border-blue-500/30 ml-8"
                : "bg-gray-700/50 border border-gray-600/30 mr-8"
            }`}
          >
            <div className="text-xs text-gray-400 mb-1">
              {msg.role === "user" ? "Сіз / Вы" : "AI Көмекші / Ассистент"}
            </div>
            <div className="text-white">{msg.text}</div>
          </div>
        ))}
        
        {isProcessing && (
          <div className="flex items-center gap-2 text-gray-400 p-4">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Өңдеу... / Обработка...</span>
          </div>
        )}
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Кнопка микрофона */}
      <div className="flex justify-center">
        <button
          onClick={handleMicClick}
          disabled={isProcessing}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
            isRecording
              ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/50"
              : isSpeaking
              ? "bg-green-500 shadow-lg shadow-green-500/50"
              : "bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 shadow-lg shadow-blue-500/30"
          } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isRecording ? (
            <MicOff className="w-10 h-10 text-white" />
          ) : isSpeaking ? (
            <Volume2 className="w-10 h-10 text-white animate-pulse" />
          ) : isProcessing ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : (
            <Mic className="w-10 h-10 text-white" />
          )}
        </button>
      </div>
      
      <p className="text-center text-gray-400 text-sm mt-4">
        {isRecording 
          ? "🎤 Тыңдаймын... / Слушаю..." 
          : isSpeaking 
          ? "🔊 Жауап беруде... / Отвечаю..."
          : "Басыңыз / Нажмите"}
      </p>
    </div>
  )
}
