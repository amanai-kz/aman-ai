import { NextRequest, NextResponse } from "next/server"
import { getIAMToken } from "@/lib/yandex-iam"

const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID || ""

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get("audio") as File
    
    if (!audioFile) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 })
    }

    if (!YANDEX_FOLDER_ID) {
      return NextResponse.json({ error: "Yandex not configured" }, { status: 500 })
    }

    let iamToken: string
    try {
      iamToken = await getIAMToken()
      console.log("IAM token obtained")
    } catch (error) {
      console.error("Failed to get IAM token:", error)
      return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
    }

    const audioBuffer = await audioFile.arrayBuffer()
    const audioData = Buffer.from(audioBuffer)
    console.log("Audio data size:", audioData.length)

    // Try sync recognition endpoint for Kazakhstan
    // According to docs: stt.api.ml.yandexcloud.kz
    const endpoints = [
      "https://stt.api.ml.yandexcloud.kz/speech/v1/stt:recognize",
      "https://stt.api.yandexcloud.kz/speech/v1/stt:recognize",
    ]
    
    for (const endpoint of endpoints) {
      console.log("Trying endpoint:", endpoint)
      
      try {
        const response = await fetch(
          endpoint + "?" + new URLSearchParams({
            folderId: YANDEX_FOLDER_ID,
            lang: "kk-KZ",
            format: "oggopus",
          }),
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${iamToken}`,
              "Content-Type": "audio/ogg",
            },
            body: audioData,
          }
        )

        console.log("Response status:", response.status)

        if (response.ok) {
          const data = await response.json()
          console.log("STT result:", data)
          return NextResponse.json({ text: data.result || "" })
        }

        const errorText = await response.text()
        console.log("Error from", endpoint, ":", response.status, errorText)
      } catch (err) {
        console.error("Error with endpoint", endpoint, ":", err)
      }
    }
    
    // If none worked, return error
    return NextResponse.json({ 
      error: "Speech recognition not available in Kazakhstan region",
      details: "Yandex SpeechKit v1 REST API is not available. gRPC v3 required."
    }, { status: 500 })

  } catch (error) {
    console.error("STT error:", error)
    return NextResponse.json({ error: "Speech recognition failed" }, { status: 500 })
  }
}
