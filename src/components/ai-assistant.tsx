"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useSession } from "next-auth/react"
import { MessageCircle, X, Send, Bot, User, Sparkles, ChevronDown, ChevronUp, Pause, Play, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  SESSION_CONTEXT_MAX_LENGTH,
  buildMessagesWithContext,
  clearSessionContext,
  loadSessionContext,
  sanitizeContext,
  saveSessionContext,
} from "@/lib/session-context"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

type EncounterStatus = "active" | "paused" | "completed" | "cancelled" | null

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "Привет! 👋 Я AI-ассистент Aman AI. Готов ответить на вопросы о платформе. Чем могу помочь?",
  timestamp: new Date(),
}

async function getAIResponse(history: Message[], sessionContext: string): Promise<string> {
  try {
    const payloadMessages = buildMessagesWithContext(
      history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      sessionContext
    )

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: payloadMessages,
        sessionContext,
      }),
    })

    if (!response.ok) {
      throw new Error("API error")
    }

    const data = await response.json()
    return data.message || "Кешіріңіз, қате болды."
  } catch (error) {
    console.error("Chat error:", error)
    return "Байланыс қатесі. Қайталап көріңіз."
  }
}

export function AIAssistant() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState("")
  const [sessionContext, setSessionContext] = useState("")
  const [contextDraft, setContextDraft] = useState("")
  const [isContextOpen, setIsContextOpen] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [encounterId, setEncounterId] = useState<string | null>(null)
  const [encounterStatus, setEncounterStatus] = useState<EncounterStatus>(null)
  const [encounterError, setEncounterError] = useState<string | null>(null)
  const [isEncounterBusy, setIsEncounterBusy] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:8000"

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const mapStateMessages = (stateMessages?: any[]): Message[] => {
    if (!stateMessages?.length) return [WELCOME_MESSAGE]
    return stateMessages.map((msg, idx) => ({
      id: msg?.id || `${idx}-${Date.now()}`,
      role: msg?.role === "assistant" ? "assistant" : "user",
      content: msg?.content || "",
      timestamp: msg?.timestamp ? new Date(msg.timestamp) : new Date(),
    }))
  }

  const buildStatePayload = (stateMessages: Message[]) => ({
    flow_step: "chat",
    messages: stateMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    })),
    context: sessionContext ? { session_context: sessionContext } : {},
  })

  const loadActiveEncounter = async () => {
    if (!session?.user?.id) return
    try {
      setIsEncounterBusy(true)
      const response = await fetch(`${backendUrl}/api/v1/encounters/active`, {
        headers: {
          "X-User-Id": session.user.id,
        },
      })
      if (!response.ok) return

      const data = await response.json()
      setEncounterId(data.id)
      setEncounterStatus(data.status as EncounterStatus)

      if (data.state?.messages?.length) {
        setMessages(mapStateMessages(data.state.messages))
      }
    } catch (error) {
      console.error("Failed to load active encounter", error)
    } finally {
      setIsEncounterBusy(false)
    }
  }

  const ensureEncounterForMessages = async (stateMessages: Message[]): Promise<string | null> => {
    if (!session?.user?.id) return null
    if (encounterStatus === "paused") {
      setEncounterError("Encounter is paused. Resume to continue.")
      return null
    }
    if (encounterStatus === "completed" || encounterStatus === "cancelled") {
      setEncounterId(null)
      setEncounterStatus(null)
    }
    if (encounterId && encounterStatus === "active") {
      return encounterId
    }
    try {
      const response = await fetch(`${backendUrl}/api/v1/encounters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": session.user.id,
        },
        body: JSON.stringify({ state: buildStatePayload(stateMessages) }),
      })

      if (!response.ok) {
        throw new Error("Failed to start encounter")
      }

      const data = await response.json()
      setEncounterId(data.id)
      setEncounterStatus(data.status as EncounterStatus)
      setEncounterError(null)
      return data.id as string
    } catch (error) {
      console.error("Encounter start failed", error)
      setEncounterError("Unable to sync encounter with server.")
      return null
    }
  }

  const persistMessageToBackend = async (stateMessages: Message[], message: Message) => {
    if (!session?.user?.id) return
    const id = await ensureEncounterForMessages(stateMessages)
    if (!id) return

    try {
      await fetch(`${backendUrl}/api/v1/encounters/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": session.user.id,
        },
        body: JSON.stringify({
          content: message.content,
          role: message.role,
          flow_step: "chat",
          context: sessionContext ? { session_context: sessionContext } : undefined,
        }),
      })
      setEncounterError(null)
    } catch (error) {
      console.error("Failed to persist message", error)
      setEncounterError("Could not save conversation progress.")
    }
  }

  const pauseEncounter = async () => {
    if (!session?.user?.id || !encounterId) return
    try {
      setIsEncounterBusy(true)
      const response = await fetch(`${backendUrl}/api/v1/encounters/${encounterId}/pause`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": session.user.id,
        },
        body: JSON.stringify({ state: buildStatePayload(messages) }),
      })
      if (!response.ok) {
        throw new Error("Pause failed")
      }
      const data = await response.json()
      setEncounterStatus(data.status as EncounterStatus)
      setEncounterError(null)
    } catch (error) {
      console.error("Failed to pause encounter", error)
      setEncounterError("Pause failed. Please try again.")
    } finally {
      setIsEncounterBusy(false)
    }
  }

  const resumeEncounter = async (): Promise<boolean> => {
    if (!session?.user?.id || !encounterId) return false
    try {
      setIsEncounterBusy(true)
      const response = await fetch(`${backendUrl}/api/v1/encounters/${encounterId}/resume`, {
        method: "POST",
        headers: {
          "X-User-Id": session.user.id,
        },
      })
      if (!response.ok) {
        throw new Error("Resume failed")
      }
      const data = await response.json()
      setEncounterStatus(data.status as EncounterStatus)
      if (data.state?.messages?.length) {
        setMessages(mapStateMessages(data.state.messages))
      }
      setEncounterError(null)
      return true
    } catch (error) {
      console.error("Failed to resume encounter", error)
      setEncounterError("Resume failed. Please try again.")
      return false
    } finally {
      setIsEncounterBusy(false)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!session?.user?.id) return

    const storedContext = loadSessionContext(session.user.id)
    setSessionContext(storedContext)
    setContextDraft(storedContext)
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id) return
    loadActiveEncounter()
  }, [session?.user?.id])

  const handleApplyContext = () => {
    const sanitizedDraft = sanitizeContext(contextDraft)

    if (!sanitizedDraft && !sessionContext) {
      setContextDraft("")
      return
    }

    if (session?.user?.id) {
      const saved = saveSessionContext(session.user.id, sanitizedDraft)
      setSessionContext(saved)
      setContextDraft(saved)
      return
    }

    setSessionContext(sanitizedDraft)
    setContextDraft(sanitizedDraft)
  }

  const handleClearContext = () => {
    if (session?.user?.id) {
      clearSessionContext(session.user.id)
    }
    setSessionContext("")
    setContextDraft("")
  }

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    if (encounterStatus === "paused") {
      setEncounterError("Encounter is paused. Resume to continue.")
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput("")
    setIsTyping(true)
    setEncounterError(null)

    try {
      await persistMessageToBackend(newMessages, userMessage)

      const responseText = await getAIResponse(newMessages, sessionContext)

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, aiResponse])
      await persistMessageToBackend([...newMessages, aiResponse], aiResponse)
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isApplyDisabled = sanitizeContext(contextDraft) === sessionContext
  const isClearDisabled = !sessionContext && !contextDraft
  const isPaused = encounterStatus === "paused"

  return (
    <>
      {/* Chat Window */}
      <div
        className={cn(
          "fixed bottom-24 right-6 w-[380px] max-h-[600px] bg-background border rounded-2xl shadow-2xl flex flex-col z-50 transition-all duration-300",
          isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <div className="border-b">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Aman AI Assistant</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Онлайн
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {encounterStatus && (
                <span className="text-[11px] text-muted-foreground">
                  Status: {encounterStatus}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={encounterStatus === "paused" ? resumeEncounter : pauseEncounter}
                disabled={!session?.user?.id || !encounterId || isEncounterBusy}
              >
                {encounterStatus === "paused" ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <Pause className="w-4 h-4" />
                )}
                {encounterStatus === "paused" ? "Resume" : "Pause"}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {encounterError && (
            <div className="px-4 pb-2 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{encounterError}</span>
            </div>
          )}
          {isPaused && (
            <div className="px-4 pb-2 text-xs text-amber-600 flex items-center gap-2">
              <Pause className="w-4 h-4" />
              <span>Encounter paused. Resume to continue chatting.</span>
            </div>
          )}

          {/* Session Context */}
          <div className="px-4 pb-4">
            <Collapsible open={isContextOpen} onOpenChange={setIsContextOpen}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Session context</p>
                  <p className="text-xs text-muted-foreground">
                    Session context: affects future responses in this session only.
                  </p>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    {isContextOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isContextOpen ? "Hide" : "Edit"}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="mt-3 space-y-3">
                <Textarea
                  value={contextDraft}
                  onChange={(e) => setContextDraft(e.target.value.slice(0, SESSION_CONTEXT_MAX_LENGTH))}
                  placeholder="Add instructions, preferences, or guardrails for this session..."
                  maxLength={SESSION_CONTEXT_MAX_LENGTH}
                  className="bg-muted/60 border-border"
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Applied per session; clear to reset.</span>
                  <span>
                    {contextDraft.length} / {SESSION_CONTEXT_MAX_LENGTH}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleApplyContext} disabled={isApplyDisabled}>
                    Apply
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleClearContext} disabled={isClearDisabled}>
                    Clear
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "flex-row-reverse" : ""
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  message.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted"
                )}
              >
                {message.role === "user" ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[75%] p-3 rounded-2xl text-sm whitespace-pre-wrap",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted rounded-tl-sm"
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="bg-muted p-3 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Сұрақ жазыңыз..."
              className="flex-1 px-4 py-2 bg-muted rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={isPaused}
            />
            <Button 
              size="icon" 
              onClick={handleSend}
              disabled={!input.trim() || isTyping || isPaused}
              className="rounded-xl"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            AI ассистент демо режимінде жұмыс істейді
          </p>
        </div>
      </div>

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-50 transition-all duration-300 hover:scale-110",
          isOpen && "rotate-90"
        )}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>
    </>
  )
}
