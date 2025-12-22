"use client"

import { useState, useEffect, useRef } from "react"
import { Phone, PhoneOff, Volume2, Loader2, MessageSquare, Mic, MicOff } from "lucide-react"
import { DashboardBackground } from "@/components/dashboard-background"
import Vapi from "@vapi-ai/web"

const VAPI_PUBLIC_KEY = "77dcbf9a-c62f-4d95-966e-e943c5785890"
const VAPI_ASSISTANT_ID = "e4be2d3f-64c4-4d4c-b368-aab247474824"

export default function VoiceAssistantPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; text: string }>>([])
  const [error, setError] = useState("")
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt">("prompt")

  const vapiRef = useRef<Vapi | null>(null)

  // Check microphone permission on mount
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: "microphone" as PermissionName })
        setMicPermission(result.state as "granted" | "denied" | "prompt")
        
        result.onchange = () => {
          setMicPermission(result.state as "granted" | "denied" | "prompt")
        }
      } catch (err) {
        console.log("Permission API not supported, will request on start")
      }
    }
    checkMicPermission()
  }, [])

  useEffect(() => {
    // Initialize Vapi
    const vapi = new Vapi(VAPI_PUBLIC_KEY)
    vapiRef.current = vapi

    // Event listeners
    vapi.on("call-start", () => {
      console.log("✅ Call started - connection established")
      setIsConnected(true)
      setIsConnecting(false)
      setIsListening(true)
    })

    vapi.on("call-end", () => {
      console.log("📞 Call ended")
      setIsConnected(false)
      setIsSpeaking(false)
      setIsListening(false)
    })

    vapi.on("speech-start", () => {
      console.log("🎙️ Assistant started speaking")
      setIsSpeaking(true)
      setIsListening(false)
    })

    vapi.on("speech-end", () => {
      console.log("🔇 Assistant stopped speaking")
      setIsSpeaking(false)
      setIsListening(true)
    })

    vapi.on("message", (message) => {
      console.log("📨 Message:", message)
      
      if (message.type === "transcript") {
        if (message.transcriptType === "final") {
          if (message.role === "user") {
            setMessages(prev => [...prev, { role: "user", text: message.transcript }])
          } else if (message.role === "assistant") {
            setMessages(prev => [...prev, { role: "ai", text: message.transcript }])
          }
        }
      }
      
      // Log conversation updates
      if (message.type === "conversation-update") {
        console.log("🔄 Conversation update:", message)
      }
    })

    vapi.on("volume-level", (level) => {
      setVolumeLevel(level)
    })

    vapi.on("error", (error) => {
      console.error("❌ Vapi error:", error)
      setError(`Қате: ${error.message || "Байланыс үзілді"} / Ошибка: ${error.message || "Соединение потеряно"}`)
      setIsConnecting(false)
      setIsConnected(false)
    })

    return () => {
      vapi.stop()
    }
  }, [])

  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      console.log("🎤 Requesting microphone permission...")
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop())
      
      console.log("✅ Microphone permission granted")
      setMicPermission("granted")
      return true
    } catch (err) {
      console.error("❌ Microphone permission denied:", err)
      setMicPermission("denied")
      setError("Микрофонға рұқсат жоқ / Нет доступа к микрофону. Разрешите доступ в настройках браузера.")
      return false
    }
  }

  const startCall = async () => {
    if (!vapiRef.current) {
      console.error("VAPI not initialized")
      return
    }
    
    setError("")
    
    // First, request microphone permission
    const hasPermission = await requestMicrophonePermission()
    if (!hasPermission) {
      return
    }
    
    setIsConnecting(true)
    setMessages([])
    
    try {
      console.log("📞 Starting VAPI call with assistant:", VAPI_ASSISTANT_ID)
      
      await vapiRef.current.start(VAPI_ASSISTANT_ID)
      
      console.log("✅ VAPI call started successfully")
    } catch (err: unknown) {
      console.error("❌ Failed to start call:", err)
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(`Қоңырауды бастау мүмкін болмады / Не удалось начать: ${errorMessage}`)
      setIsConnecting(false)
    }
  }

  const endCall = () => {
    console.log("📞 Ending call...")
    if (vapiRef.current) {
      vapiRef.current.stop()
    }
    setIsConnected(false)
    setIsSpeaking(false)
    setIsListening(false)
  }

  const toggleMute = () => {
    if (vapiRef.current && isConnected) {
      const isMuted = vapiRef.current.isMuted()
      vapiRef.current.setMuted(!isMuted)
      setIsListening(isMuted) // If was muted, now listening
    }
  }

  return (
    <div className="min-h-screen relative">
      <DashboardBackground />
      
      <div className="relative z-10 p-6 lg:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🎤 AI Дауыстық Ассистент</h1>
          <p className="text-muted-foreground">
            Қазақша немесе орысша сөйлесіңіз — AI нақты уақытта жауап береді
          </p>
          {micPermission === "denied" && (
            <p className="text-red-500 mt-2">
              ⚠️ Микрофон бұғатталған. Браузер параметрлерінен рұқсат беріңіз.
            </p>
          )}
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Voice Control */}
          <div className="bg-background/60 backdrop-blur-sm rounded-2xl border p-8">
            <div className="flex flex-col items-center justify-center min-h-[400px]">
              {/* Status indicator */}
              <div className="text-center mb-8 h-8">
                {isConnecting && (
                  <div className="flex items-center gap-2 text-blue-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-lg font-medium">Қосылуда... / Подключение...</span>
                  </div>
                )}
                {isConnected && isListening && !isSpeaking && (
                  <div className="flex items-center gap-2 text-emerald-500 animate-pulse">
                    <Mic className="w-5 h-5" />
                    <span className="text-lg font-medium">Сізді тыңдап тұрмын... / Слушаю вас...</span>
                  </div>
                )}
                {isSpeaking && (
                  <div className="flex items-center gap-2 text-amber-500">
                    <Volume2 className="w-5 h-5 animate-pulse" />
                    <span className="text-lg font-medium">AI сөйлеуде... / AI говорит...</span>
                  </div>
                )}
                {!isConnected && !isConnecting && (
                  <span className="text-lg text-muted-foreground">
                    Сөйлесуді бастаңыз / Начните разговор
                  </span>
                )}
              </div>

              {/* Live volume indicator */}
              {isConnected && (
                <div className="w-48 h-3 bg-gray-700/50 rounded-full mb-6 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-75 ${
                      isSpeaking 
                        ? "bg-gradient-to-r from-amber-500 to-orange-500" 
                        : "bg-gradient-to-r from-emerald-500 to-teal-500"
                    }`}
                    style={{ width: `${Math.min(volumeLevel * 150, 100)}%` }}
                  />
                </div>
              )}

              {/* Main Call Button */}
              <div className="relative">
                {isConnected && (
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                )}
                
                {isConnected ? (
                  <button
                    onClick={endCall}
                    className="relative w-36 h-36 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center shadow-2xl shadow-red-500/30 hover:shadow-red-500/50 hover:scale-105 transition-all duration-300 cursor-pointer z-50"
                  >
                    <PhoneOff className="w-14 h-14" />
                  </button>
                ) : (
                  <button
                    onClick={startCall}
                    disabled={isConnecting || micPermission === "denied"}
                    className="relative w-36 h-36 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer z-50"
                  >
                    {isConnecting ? (
                      <Loader2 className="w-14 h-14 animate-spin" />
                    ) : (
                      <Phone className="w-14 h-14" />
                    )}
                  </button>
                )}
              </div>

              {/* Mute button when connected */}
              {isConnected && (
                <button
                  onClick={toggleMute}
                  className="mt-6 px-6 py-3 rounded-full bg-muted/50 hover:bg-muted transition-colors flex items-center gap-2"
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-5 h-5" />
                      <span>Дыбысты өшіру / Выкл. микрофон</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      <span>Дыбысты қосу / Вкл. микрофон</span>
                    </>
                  )}
                </button>
              )}

              {error && (
                <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-center max-w-sm">
                  {error}
                </div>
              )}

              <p className="mt-8 text-sm text-muted-foreground text-center max-w-sm">
                💡 Жасыл батырманы басыңыз, микрофонға рұқсат беріңіз және сөйлеңіз.
                <br />
                <span className="text-xs">
                  Нажмите зелёную кнопку, разрешите микрофон и говорите.
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-4 text-center">
            <div className="text-2xl mb-2">🎙️</div>
            <h3 className="font-medium">Real-time</h3>
            <p className="text-sm text-muted-foreground">Нақты уақытта сөйлесу</p>
          </div>
          <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-4 text-center">
            <div className="text-2xl mb-2">🧠</div>
            <h3 className="font-medium">AI Powered</h3>
            <p className="text-sm text-muted-foreground">GPT негізінде</p>
          </div>
          <div className="bg-background/60 backdrop-blur-sm rounded-xl border p-4 text-center">
            <div className="text-2xl mb-2">🌍</div>
            <h3 className="font-medium">Көптілді</h3>
            <p className="text-sm text-muted-foreground">Қазақ, Орыс, Ағылшын</p>
          </div>
        </div>
      </div>
    </div>
  )
}
