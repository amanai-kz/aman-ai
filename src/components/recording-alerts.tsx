"use client"

import { useEffect, useState, useCallback } from "react"
import { AlertTriangle, Mic, MicOff, Phone, PhoneOff, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface RecordingAlertsProps {
  isRecording: boolean
  onMicrophoneLost?: () => void
  onMicrophoneRestored?: () => void
  onInterruption?: (type: "phone" | "audio_focus") => void
}

interface AlertState {
  type: "microphone_lost" | "phone_interruption" | null
  message: string
  dismissed: boolean
}

export function RecordingAlerts({
  isRecording,
  onMicrophoneLost,
  onMicrophoneRestored,
  onInterruption,
}: RecordingAlertsProps) {
  const [alert, setAlert] = useState<AlertState>({ type: null, message: "", dismissed: false })
  const [microphoneAvailable, setMicrophoneAvailable] = useState(true)

  // Monitor microphone availability
  const checkMicrophoneStatus = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(device => device.kind === "audioinput")
      const hasMicrophone = audioInputs.length > 0

      if (!hasMicrophone && microphoneAvailable) {
        setMicrophoneAvailable(false)
        setAlert({
          type: "microphone_lost",
          message: "Микрофон отключён. Проверьте подключение устройства.",
          dismissed: false
        })
        onMicrophoneLost?.()
      } else if (hasMicrophone && !microphoneAvailable) {
        setMicrophoneAvailable(true)
        setAlert({ type: null, message: "", dismissed: false })
        onMicrophoneRestored?.()
      }
    } catch (error) {
      console.error("Error checking microphone:", error)
    }
  }, [microphoneAvailable, onMicrophoneLost, onMicrophoneRestored])

  // Listen for device changes
  useEffect(() => {
    if (!isRecording) return

    // Initial check
    checkMicrophoneStatus()

    // Listen for device changes
    const handleDeviceChange = () => {
      checkMicrophoneStatus()
    }

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange)

    // Periodic check as fallback
    const interval = setInterval(checkMicrophoneStatus, 2000)

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange)
      clearInterval(interval)
    }
  }, [isRecording, checkMicrophoneStatus])

  // Monitor audio focus / interruptions (phone calls, etc.)
  useEffect(() => {
    if (!isRecording) return

    // Use AudioContext to detect audio focus changes
    let audioContext: AudioContext | null = null
    let checkInterval: NodeJS.Timeout | null = null

    const initAudioMonitoring = async () => {
      try {
        audioContext = new AudioContext()
        
        // Monitor for audio context state changes
        audioContext.onstatechange = () => {
          if (audioContext?.state === "interrupted") {
            // Audio was interrupted (likely by phone call)
            setAlert({
              type: "phone_interruption",
              message: "Запись приостановлена. Возможен входящий звонок.",
              dismissed: false
            })
            onInterruption?.("phone")
          } else if (audioContext?.state === "running" && alert.type === "phone_interruption") {
            // Audio resumed
            setAlert({ type: null, message: "", dismissed: false })
          }
        }

        // Check visibility API for phone app focus
        const handleVisibilityChange = () => {
          if (document.hidden && isRecording) {
            // App went to background - might be a phone call
            setAlert({
              type: "phone_interruption",
              message: "Приложение свёрнуто. Запись может быть прервана.",
              dismissed: false
            })
            onInterruption?.("audio_focus")
          }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)

        return () => {
          document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
      } catch (error) {
        console.error("Error initializing audio monitoring:", error)
      }
    }

    initAudioMonitoring()

    return () => {
      audioContext?.close()
      if (checkInterval) clearInterval(checkInterval)
    }
  }, [isRecording, onInterruption, alert.type])

  // Clear alert when not recording
  useEffect(() => {
    if (!isRecording) {
      setAlert({ type: null, message: "", dismissed: false })
    }
  }, [isRecording])

  const dismissAlert = () => {
    setAlert(prev => ({ ...prev, dismissed: true }))
  }

  if (!alert.type || alert.dismissed || !isRecording) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm",
        "animate-in fade-in duration-300"
      )}
    >
      <div
        className={cn(
          "relative max-w-md w-full mx-4 rounded-2xl p-8 shadow-2xl",
          "animate-in zoom-in-95 duration-300",
          alert.type === "microphone_lost"
            ? "bg-gradient-to-br from-red-900/90 to-red-950/90 border border-red-500/30"
            : "bg-gradient-to-br from-amber-900/90 to-orange-950/90 border border-amber-500/30"
        )}
      >
        {/* Dismiss button */}
        <button
          onClick={dismissAlert}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-white/60" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center",
              "animate-pulse",
              alert.type === "microphone_lost"
                ? "bg-red-500/20"
                : "bg-amber-500/20"
            )}
          >
            {alert.type === "microphone_lost" ? (
              <MicOff className="w-12 h-12 text-red-400" />
            ) : (
              <Phone className="w-12 h-12 text-amber-400" />
            )}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center text-white mb-3">
          {alert.type === "microphone_lost"
            ? "Микрофон отключён"
            : "Прерывание записи"}
        </h2>

        {/* Message */}
        <p className="text-center text-white/80 mb-6">
          {alert.message}
        </p>

        {/* Instructions */}
        <div className="bg-black/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-white/60 text-center">
            {alert.type === "microphone_lost" ? (
              <>
                <span className="block mb-2">Что делать:</span>
                <span className="text-white/80">
                  1. Проверьте подключение микрофона<br />
                  2. Убедитесь, что устройство не отключено<br />
                  3. Перезапустите запись
                </span>
              </>
            ) : (
              <>
                <span className="block mb-2">Запись приостановлена</span>
                <span className="text-white/80">
                  Завершите звонок и вернитесь в приложение для продолжения
                </span>
              </>
            )}
          </p>
        </div>

        {/* Action button */}
        <button
          onClick={dismissAlert}
          className={cn(
            "w-full py-3 rounded-xl font-medium transition-colors",
            alert.type === "microphone_lost"
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-amber-500 hover:bg-amber-600 text-black"
          )}
        >
          Понятно
        </button>
      </div>
    </div>
  )
}

// Hook for audio level monitoring (detect if mic is actually capturing audio)
export function useAudioLevelMonitor(stream: MediaStream | null) {
  const [audioLevel, setAudioLevel] = useState(0)
  const [isSilent, setIsSilent] = useState(false)

  useEffect(() => {
    if (!stream) return

    let animationFrame: number
    let audioContext: AudioContext
    let analyser: AnalyserNode
    let silentFrames = 0
    const SILENT_THRESHOLD = 0.01
    const SILENT_FRAMES_THRESHOLD = 100 // ~3 seconds of silence

    try {
      audioContext = new AudioContext()
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray)
        
        // Calculate average level
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const normalizedLevel = average / 255

        setAudioLevel(normalizedLevel)

        if (normalizedLevel < SILENT_THRESHOLD) {
          silentFrames++
          if (silentFrames >= SILENT_FRAMES_THRESHOLD) {
            setIsSilent(true)
          }
        } else {
          silentFrames = 0
          setIsSilent(false)
        }

        animationFrame = requestAnimationFrame(checkLevel)
      }

      checkLevel()
    } catch (error) {
      console.error("Error setting up audio level monitor:", error)
    }

    return () => {
      cancelAnimationFrame(animationFrame)
      audioContext?.close()
    }
  }, [stream])

  return { audioLevel, isSilent }
}

