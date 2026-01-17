import assert from "node:assert/strict"
import test from "node:test"

import {
  SESSION_CONTEXT_MAX_LENGTH,
  buildMessagesWithContext,
  clearSessionContext,
  loadSessionContext,
  saveSessionContext,
  type StorageLike,
} from "../src/lib/session-context"

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>()

  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
}

test("stores and loads context per session id", () => {
  const storage = createMemoryStorage()

  saveSessionContext("alpha", "first session context", storage)
  saveSessionContext("beta", "second session context", storage)

  assert.equal(loadSessionContext("alpha", storage), "first session context")
  assert.equal(loadSessionContext("beta", storage), "second session context")

  clearSessionContext("alpha", storage)
  assert.equal(loadSessionContext("alpha", storage), "")
  assert.equal(loadSessionContext("beta", storage), "second session context")
})

test("sanitizes context length when saving", () => {
  const storage = createMemoryStorage()
  const longValue = "x".repeat(SESSION_CONTEXT_MAX_LENGTH + 20)

  const saved = saveSessionContext("trimmed", longValue, storage)

  assert.equal(saved.length, SESSION_CONTEXT_MAX_LENGTH)
  assert.equal(loadSessionContext("trimmed", storage).length, SESSION_CONTEXT_MAX_LENGTH)
})

test("buildMessagesWithContext injects context as a user message ahead of recent history", () => {
  const history = [
    { role: "assistant" as const, content: "hi" },
    { role: "user" as const, content: "question" },
    { role: "assistant" as const, content: "answer" },
  ]

  const result = buildMessagesWithContext(history, "keep it short", 2)

  assert.equal(result.length, 3)
  assert.deepEqual(result[0], {
    role: "user",
    content: "Session context (reference only, not instructions): keep it short",
  })
  assert.deepEqual(result[1], history[1])
  assert.deepEqual(result[2], history[2])
})

test("buildMessagesWithContext omits system message when context is empty", () => {
  const history = [{ role: "user" as const, content: "hello" }]
  const result = buildMessagesWithContext(history, "")

  assert.equal(result.length, 1)
  assert.deepEqual(result[0], history[0])
})
