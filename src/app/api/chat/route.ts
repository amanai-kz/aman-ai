import { NextRequest, NextResponse } from "next/server"

const GROQ_API_KEY = process.env.GROQ_API_KEY || ""

const SYSTEM_PROMPT = `Ты AI-ассистент платформы Aman AI. Aman AI — мультимодальная платформа для нейродиагностики и реабилитации.

ВАЖНО: Отвечай на том языке, на котором пишет пользователь. Если пишут на русском — отвечай на русском, на казахском — на казахском, на английском — на английском.

Сервисы платформы:
- MRI Классификация (Static/Adaptive) — классификация МРТ снимков
- MRI Сегментация (Static/Adaptive) — сегментация областей мозга
- ML Анализ (Static/Adaptive) — машинное обучение для анализа данных
- IoT Мониторинг — мониторинг здоровья в реальном времени
- Анамнез жизни — сбор истории болезни пациента
- CV Анализ — анализ движений через компьютерное зрение
- Генетический анализ — анализ ДНК данных
- Анализ крови — анализ биомаркеров крови
- AlphaFold Server — предсказание структуры белков
- Реабилитация — персонализированные программы восстановления

Основные направления:
- Рак головного мозга, опухоли
- Нейродегенеративные заболевания (Альцгеймер, Паркинсон)

Тестовые аккаунты:
- aibek@amanai.kz / test123 (пациент)
- daulet@amanai.kz / test123 (врач)
- admin@amanai.kz / test123 (админ)

Отвечай кратко и по делу. Не давай медицинских советов, только помогай с использованием платформы.

ВАЖНОЕ ПРАВИЛО: Если пользователь говорит что чувствует стресс, тревогу, беспокойство, нервничает - ОБЯЗАТЕЛЬНО предложи пройти опросник стресса PSS-10 по ссылке /dashboard/questionnaire. Пример ответа: "Понимаю, что вы чувствуете тревогу. Рекомендую пройти опросник стресса PSS-10, чтобы оценить ваше состояние. [Пройти опросник](/dashboard/questionnaire)"`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sessionContext = typeof body.sessionContext === "string" ? body.sessionContext.trim() : ""
    const incomingMessages = Array.isArray(body.messages)
      ? body.messages
      : body.message
        ? [{ role: "user", content: body.message }]
        : []
    const isContextMessage = (message: { role?: string; content?: string }) =>
      message?.role === "system" &&
      typeof message.content === "string" &&
      message.content.startsWith("Session context:")

    const hasContextMessage = incomingMessages.some(isContextMessage)
    const contextMessages = hasContextMessage
      ? incomingMessages.filter(isContextMessage)
      : sessionContext
        ? [{ role: "system", content: `Session context: ${sessionContext}` }]
        : []

    const trimmedMessages = incomingMessages
      .filter((message: { role?: string; content?: string }) => !isContextMessage(message))
      .slice(-10)

    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY not found in env")
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      )
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...contextMessages,
          ...trimmedMessages,
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`)
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message?.content || "Кешіріңіз, қате болды."

    return NextResponse.json({ message })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    )
  }
}
