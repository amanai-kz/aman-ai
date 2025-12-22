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
      console.error("Missing YANDEX_FOLDER_ID")
      return NextResponse.json({ error: "Yandex not configured" }, { status: 500 })
    }

    let iamToken: string
    try {
      iamToken = await getIAMToken()
      console.log("IAM token obtained successfully")
    } catch (error) {
      console.error("Failed to get IAM token:", error)
      return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
    }

    const audioBuffer = await audioFile.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')

    // Yandex SpeechKit v3 REST API for Kazakhstan - async recognition
    // Using transcribation (long audio) endpoint which supports REST
    const response = await fetch(
      "https://transcribe.api.cloud.yandex.net/speech/stt/v2/longRunningRecognize",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${iamToken}`,
          "Content-Type": "application/json",
          "x-folder-id": YANDEX_FOLDER_ID,
        },
        body: JSON.stringify({
          config: {
            specification: {
              languageCode: "kk-KZ",
              model: "general",
              profanityFilter: false,
              audioEncoding: "OGG_OPUS",
              sampleRateHertz: 48000,
              audioChannelCount: 1,
            },
            folderId: YANDEX_FOLDER_ID,
          },
          audio: {
            content: audioBase64,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error("Yandex STT error:", response.status, error)
      
      // Try alternative endpoint for Kazakhstan
      const altResponse = await fetch(
        "https://stt.api.ml.yandexcloud.kz/speech/stt/v2/longRunningRecognize",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${iamToken}`,
            "Content-Type": "application/json",
            "x-folder-id": YANDEX_FOLDER_ID,
          },
          body: JSON.stringify({
            config: {
              specification: {
                languageCode: "kk-KZ",
                model: "general",
                audioEncoding: "OGG_OPUS",
                sampleRateHertz: 48000,
              },
              folderId: YANDEX_FOLDER_ID,
            },
            audio: {
              content: audioBase64,
            },
          }),
        }
      )
      
      if (!altResponse.ok) {
        const altError = await altResponse.text()
        console.error("Yandex STT alt error:", altResponse.status, altError)
        return NextResponse.json({ error: "Speech recognition failed", details: altError }, { status: 500 })
      }
      
      const altData = await altResponse.json()
      return handleAsyncRecognition(altData, iamToken)
    }

    const data = await response.json()
    return handleAsyncRecognition(data, iamToken)
  } catch (error) {
    console.error("STT error:", error)
    return NextResponse.json({ error: "Speech recognition failed" }, { status: 500 })
  }
}

async function handleAsyncRecognition(operationData: { id?: string; done?: boolean; response?: { chunks?: Array<{ alternatives?: Array<{ text?: string }> }> } }, iamToken: string) {
  // If operation is already done (short audio)
  if (operationData.done && operationData.response) {
    const text = operationData.response.chunks?.[0]?.alternatives?.[0]?.text || ""
    return NextResponse.json({ text })
  }

  // If we got operation ID, poll for result
  if (operationData.id) {
    const operationId = operationData.id
    let attempts = 0
    const maxAttempts = 30
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const statusResponse = await fetch(
        `https://operation.api.cloud.yandex.net/operations/${operationId}`,
        {
          headers: {
            "Authorization": `Bearer ${iamToken}`,
          },
        }
      )
      
      if (!statusResponse.ok) {
        console.error("Operation status error:", await statusResponse.text())
        break
      }
      
      const statusData = await statusResponse.json()
      
      if (statusData.done) {
        if (statusData.response?.chunks) {
          const text = statusData.response.chunks
            .map((chunk: { alternatives?: Array<{ text?: string }> }) => chunk.alternatives?.[0]?.text || "")
            .join(" ")
          return NextResponse.json({ text })
        }
        if (statusData.error) {
          console.error("Operation error:", statusData.error)
          return NextResponse.json({ error: statusData.error.message }, { status: 500 })
        }
        break
      }
      
      attempts++
    }
  }

  return NextResponse.json({ text: "" })
}
