import assert from "node:assert/strict"
import test from "node:test"

import { POST as chatPost } from "../src/app/api/chat/route"
import { POST as sendPdfPost } from "../src/app/api/pdf/send-email/route"
import { POST as sttPost } from "../src/app/api/speech/stt/route"
import { POST as ttsPost } from "../src/app/api/speech/tts/route"

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://test.local${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

test("chat route returns 401 when unauthenticated", async () => {
  const response = await chatPost(jsonRequest("/api/chat", { message: "hi" }) as never)
  assert.equal(response.status, 401)
})

test("speech tts route returns 401 when unauthenticated", async () => {
  const response = await ttsPost(jsonRequest("/api/speech/tts", { text: "hi" }) as never)
  assert.equal(response.status, 401)
})

test("speech stt route returns 401 when unauthenticated", async () => {
  const form = new FormData()
  form.append("audio", new Blob(["audio"], { type: "audio/webm" }), "audio.webm")
  const response = await sttPost(
    new Request("http://test.local/api/speech/stt", {
      method: "POST",
      body: form,
    }) as never
  )
  assert.equal(response.status, 401)
})

test("pdf send-email route returns 401 when unauthenticated", async () => {
  const response = await sendPdfPost(
    jsonRequest("/api/pdf/send-email", {
      recipientEmail: "me@example.com",
      pdfBase64: "abc",
      reportTitle: "Report",
    }) as never
  )
  assert.equal(response.status, 401)
})
