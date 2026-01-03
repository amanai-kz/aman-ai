export type ChatMessageRole = "user" | "assistant" | "system"

export interface ChatMessage {
  role: ChatMessageRole
  content: string
}

export interface HistoryMessage {
  role: "user" | "assistant"
  content: string
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export const SESSION_CONTEXT_MAX_LENGTH = 2000

const STORAGE_PREFIX = "aman-session-context:"
const DEFAULT_SESSION_KEY = "default"

function getStorage(storage?: StorageLike | null) {
  if (storage) return storage
  if (typeof window === "undefined") return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getContextStorageKey(sessionId?: string) {
  return `${STORAGE_PREFIX}${sessionId || DEFAULT_SESSION_KEY}`
}

export function sanitizeContext(value: string) {
  return value.trim().slice(0, SESSION_CONTEXT_MAX_LENGTH)
}

export function loadSessionContext(sessionId?: string, storage?: StorageLike | null) {
  const resolvedStorage = getStorage(storage)
  if (!resolvedStorage) return ""

  return resolvedStorage.getItem(getContextStorageKey(sessionId)) ?? ""
}

export function saveSessionContext(
  sessionId: string | undefined,
  value: string,
  storage?: StorageLike | null
) {
  const resolvedStorage = getStorage(storage)
  const sanitized = sanitizeContext(value)

  if (!resolvedStorage) return sanitized

  resolvedStorage.setItem(getContextStorageKey(sessionId), sanitized)
  return sanitized
}

export function clearSessionContext(sessionId?: string, storage?: StorageLike | null) {
  const resolvedStorage = getStorage(storage)
  resolvedStorage?.removeItem(getContextStorageKey(sessionId))
}

export function buildMessagesWithContext(
  history: HistoryMessage[],
  sessionContext: string,
  limit = 10
): ChatMessage[] {
  const trimmedContext = sanitizeContext(sessionContext)
  const contextMessages: ChatMessage[] = trimmedContext
    ? [{ role: "system", content: `Session context: ${trimmedContext}` }]
    : []

  const recentHistory = history.slice(-limit).map((message) => ({
    role: message.role,
    content: message.content,
  }))

  return [...contextMessages, ...recentHistory]
}
