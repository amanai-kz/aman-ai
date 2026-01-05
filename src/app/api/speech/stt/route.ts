import { NextRequest, NextResponse } from "next/server"

const GROQ_API_KEY = process.env.GROQ_API_KEY || ""

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get("audio") as File
    // Support language parameter: "kk" (Kazakh), "ru" (Russian), or omit for auto-detect
    const language = formData.get("language") as string | null
    
    if (!audioFile) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 })
    }

    if (!GROQ_API_KEY) {
      console.error("Missing GROQ_API_KEY")
      return NextResponse.json({ error: "Groq not configured" }, { status: 500 })
    }

    console.log("Audio file size:", audioFile.size, "type:", audioFile.type, "language:", language || "auto")

    // Send to Groq Whisper API
    const groqFormData = new FormData()
    groqFormData.append("file", audioFile, "audio.webm")
    groqFormData.append("model", "whisper-large-v3")
    // Only set language if explicitly provided, otherwise Whisper auto-detects
    if (language && language !== "auto") {
      groqFormData.append("language", language)
    }
    groqFormData.append("response_format", "json")

    console.log("Sending to Groq Whisper...")
    
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: groqFormData,
    })

    console.log("Groq response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Groq Whisper error:", errorText)
      return NextResponse.json({ error: "Speech recognition failed", details: errorText }, { status: 500 })
    }

    const data = await response.json()
    console.log("Whisper result:", data)
    
    return NextResponse.json({ text: data.text || "" })

  } catch (error) {
    console.error("STT error:", error)
    return NextResponse.json({ error: "Speech recognition failed" }, { status: 500 })
  }
}
