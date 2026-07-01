import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getRouteSession } from "@/lib/security-scrum-62"
import { getIAMToken } from "@/lib/yandex-iam"

const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID || ""

export async function POST(req: NextRequest) {
  try {
    const session = await getRouteSession(auth)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { text, lang = "kk-KZ" } = await req.json()

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 })
    }

    if (!YANDEX_FOLDER_ID) {
      console.error("Missing YANDEX_FOLDER_ID")
      return NextResponse.json({ error: "Yandex not configured" }, { status: 500 })
    }

    let iamToken: string
    try {
      iamToken = await getIAMToken()
    } catch (error) {
      console.error("Failed to get IAM token:", error)
      return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
    }

    // Выбор голоса в зависимости от языка
    let voice = "amira" // казахский женский голос
    if (lang === "ru-RU") {
      voice = "alena" // русский женский голос
    }

    // Yandex SpeechKit TTS API v3 for Kazakhstan
    const response = await fetch(
      "https://tts.api.ml.yandexcloud.kz/speech/v1/tts:synthesize",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${iamToken}`,
          "x-folder-id": YANDEX_FOLDER_ID,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          text,
          lang,
          voice,
          folderId: YANDEX_FOLDER_ID,
          format: "mp3",
          sampleRateHertz: "48000",
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error("Yandex TTS error:", response.status, error)
      return NextResponse.json({ error: "Speech synthesis failed", details: error }, { status: 500 })
    }

    const audioBuffer = await response.arrayBuffer()
    
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("TTS error:", error)
    return NextResponse.json({ error: "Speech synthesis failed" }, { status: 500 })
  }
}
