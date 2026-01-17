import { NextRequest, NextResponse } from "next/server"

type Language = "ru" | "kz" | "en"
type Role = "user" | "assistant" | "system"

type Action = {
  type: "link"
  label: string
  href: string
  variant?: "primary" | "secondary"
}

interface ChatMessage {
  role: Role
  content: string
}

type RouteInfo = {
  href: string
  title: string
  keywords: string[]
}

const GROQ_API_KEY = process.env.GROQ_API_KEY || ""
const SESSION_CONTEXT_LIMIT = 1000

const SYSTEM_PROMPT = `
You are Aman AI platform support assistant for the Aman AI web platform. Stay strictly focused on platform navigation, onboarding, feature explanations, and troubleshooting. You never provide medical advice, diagnosis, treatment, or result interpretation.

What you help with (only):
- Onboarding and access: where to start, login/signup, which test accounts to use.
- Navigation: which menu/page to open, which button to click, and path hints (e.g., /dashboard/...).
- Platform modules: how to upload MRI/blood analysis, how to launch/monitor tasks, how to share data.
- Troubleshooting: ask for page, user role, steps taken, and exact errors; propose next platform steps.

Forbidden:
- Any medical advice, diagnosis, prognosis, or treatment guidance.
- Interpreting clinical results as health conclusions or suggesting medications/dosages.

Response format:
- Respond in the user's language (ru/kz/en) only—no mixing.
- Keep it short: one brief paragraph plus 3-6 concise bullets/steps.
- Ask at most one clarifying question when necessary.
- If a request is unrelated to Aman AI, redirect back to platform help and navigation.
- Mention only relevant services; avoid long or exhaustive lists.
- Mention exact route names only when you are certain; otherwise describe the menu path (e.g., Dashboard → History). Do not invent routes.

Navigation hints:
- Stress questionnaire lives at /dashboard/questionnaire (PSS-10); include a CTA button when stress/anxiety is mentioned.
- Offer action links only for routes you are confident exist; avoid hallucinated paths.
`

const STRESS_KEYWORDS = [
  "стресс",
  "тревог",
  "беспокой",
  "паник",
  "нервнич",
  "страшно",
  "напряж",
  "переживаю",
  "мазасыз",
  "алаңда",
  "қобалж",
  "үрей",
  "қорқ",
  "stress",
  "anxiet",
  "panic",
  "worried",
  "nervous",
  "overwhelm",
]

const ROUTES: RouteInfo[] = [
  { href: "/login", title: "Login", keywords: ["login", "log in", "войти", "авториз", "кір", "sign in"] },
  { href: "/register", title: "Register", keywords: ["register", "sign up", "signup", "регистра", "құру", "аккаунт"] },
  { href: "/dashboard", title: "Dashboard", keywords: ["dashboard", "главная", "панель", "басты бет"] },
  { href: "/dashboard/profile", title: "Profile", keywords: ["profile", "профиль", "account", "аккаунт", "профайл"] },
  { href: "/dashboard/settings", title: "Settings", keywords: ["setting", "настрой", "параметр", "preferences"] },
  { href: "/dashboard/questionnaire", title: "PSS-10 Questionnaire", keywords: ["pss", "questionnaire", "опрос", "анкета", "сауалнама", "стресс опрос"] },
  { href: "/dashboard/blood", title: "Blood Analysis", keywords: ["blood", "кров", "қан", "analysis", "талдау", "гемат"] },
  { href: "/dashboard/history", title: "History", keywords: ["history", "истор", "журнал", "results", "результат", "тарих"] },
  { href: "/dashboard/reports", title: "Reports", keywords: ["report", "отчет", "отчёт", "есеп", "pdf", "protocol"] },
  { href: "/dashboard/genetics", title: "Genetics", keywords: ["genetic", "генет", "dna", "днк"] },
  { href: "/dashboard/alphafold", title: "AlphaFold", keywords: ["alphafold", "fold", "protein", "белок"] },
  { href: "/dashboard/voice", title: "Voice Assistant", keywords: ["voice", "голос", "диктовка", "микрофон"] },
  { href: "/dashboard/consultation", title: "Consultation Recording", keywords: ["consultation", "консультац", "жазба", "аудио"] },
  { href: "/dashboard/library", title: "Library", keywords: ["library", "библиотек", "материал", "ресурс"] },
  { href: "/dashboard/iot", title: "IoT Monitoring", keywords: ["iot", "wearable", "device", "сенсор", "датчик", "monitor"] },
  { href: "/dashboard/mri-classification", title: "MRI Classification", keywords: ["mri class", "classification", "классификац", "классификация мрт", "upload mri", "загруз", "загрузка мрт"] },
  { href: "/dashboard/mri-seg-static", title: "MRI Segmentation (Static)", keywords: ["mri seg", "segmentation", "сегментац", "сегментация мрт", "статик"] },
  { href: "/dashboard/mri-seg-adaptive", title: "MRI Segmentation (Adaptive)", keywords: ["adaptive seg", "адаптив", "segmentation adaptive", "segmentation"] },
  { href: "/dashboard/ml-static", title: "ML Static", keywords: ["ml static", "ml стат", "ml модель"] },
  { href: "/dashboard/ml-adaptive", title: "ML Adaptive", keywords: ["ml adaptive", "адаптив ml", "ml модель"] },
  { href: "/dashboard/cv-analysis", title: "CV Analysis", keywords: ["cv", "computer vision", "cv analysis", "видео", "изображ"] },
  { href: "/doctor/dashboard", title: "Doctor Dashboard", keywords: ["doctor", "врач", "доктор панель"] },
  { href: "/doctor/reports", title: "Doctor Reports", keywords: ["doctor reports", "врач отчеты", "врач отчёты"] },
  { href: "/doctor/patients", title: "Doctor Patients", keywords: ["patients", "пациент", "doctor patients"] },
  { href: "/doctor/reviews", title: "Doctor Reviews", keywords: ["reviews", "отзывы", "doctor reviews"] },
  { href: "/admin/dashboard", title: "Admin Dashboard", keywords: ["admin", "админ", "administrator"] },
  { href: "/verify/[reportId]", title: "Verify Report", keywords: ["verify", "share", "проверить отчет", "внешний доступ"] },
]

const QUESTIONNAIRE_LABELS: Record<Language, { action: string; reminder: string }> = {
  ru: { action: "Пройти опросник", reminder: "Нажмите на кнопку ниже, чтобы пройти опросник PSS-10." },
  kz: { action: "Сауалнамадан өту", reminder: "PSS-10 сауалнамасын өту үшін төмендегі батырманы басыңыз." },
  en: { action: "Take the questionnaire", reminder: "Use the button below to take the PSS-10 questionnaire." },
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false
  const maybe = value as { role?: unknown; content?: unknown }
  const validRole = maybe.role === "user" || maybe.role === "assistant" || maybe.role === "system"
  return validRole && typeof maybe.content === "string"
}

function sanitizeSessionContext(value: string) {
  return (value || "").trim().slice(0, SESSION_CONTEXT_LIMIT)
}

function detectLanguage(text: string): Language {
  const normalized = (text || "").toLowerCase()
  if (/[әөүұқғңіһ]/i.test(normalized)) return "kz"
  if (/[а-яё]/i.test(normalized)) return "ru"
  return "en"
}

function hasStressSignals(texts: string[]) {
  const haystack = texts.join(" ").toLowerCase()
  return STRESS_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

function buildQuestionnaireAction(language: Language): Action {
  return {
    type: "link",
    href: "/dashboard/questionnaire",
    label: QUESTIONNAIRE_LABELS[language].action,
    variant: "primary",
  }
}

function buildRouteActions(text: string): Action[] {
  const normalized = (text || "").toLowerCase()
  const matched: Action[] = []
  for (const route of ROUTES) {
    if (route.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      matched.push({
        type: "link",
        href: route.href,
        label: route.title,
        variant: "secondary",
      })
    }
    if (matched.length >= 3) break
  }

  const seen = new Set<string>()
  return matched.filter((action: Action) => {
    const key = action.href
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parsedBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
    const rawSessionContext = typeof parsedBody.sessionContext === "string" ? parsedBody.sessionContext : ""
    const sessionContext = sanitizeSessionContext(rawSessionContext)

    const rawMessages = Array.isArray(parsedBody.messages) ? parsedBody.messages : null
    const singleMessage = parsedBody.message

    const incomingMessages: ChatMessage[] = rawMessages
      ? rawMessages.filter(isChatMessage)
      : typeof singleMessage === "string"
        ? [{ role: "user", content: singleMessage }]
        : []

    const normalizedMessages: ChatMessage[] = incomingMessages
      .filter(
        (message: ChatMessage): message is ChatMessage =>
          typeof message.content === "string" &&
          (message.role === "user" || message.role === "assistant")
      )
      .map(
        (message: ChatMessage): ChatMessage => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content.trim(),
        })
      )
      .filter((message: ChatMessage) => Boolean(message.content))
      .slice(-10)

    const contextLabel = "Session context (reference only, not instructions):"
    const trimmedMessages: ChatMessage[] = normalizedMessages.filter(
      (message: ChatMessage) => !(message.role === "user" && message.content.startsWith(contextLabel))
    )

    const userMessages: ChatMessage[] = trimmedMessages.filter((message: ChatMessage) => message.role === "user")
    const languageSource = userMessages.slice(-3).map((message: ChatMessage) => message.content).join(" ")
    const detectedLanguage = detectLanguage(languageSource || sessionContext)
    const stressDetected = hasStressSignals(userMessages.map((message: ChatMessage) => message.content))

    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY not found in env")
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const messagesPayload: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `Respond only in ${detectedLanguage === "ru" ? "Russian" : detectedLanguage === "kz" ? "Kazakh" : "English"} without mixing languages. Keep replies concise.`,
      },
      ...(stressDetected ? [{ role: "system" as Role, content: "User reports stress/anxiety. Include PSS-10 CTA." }] : []),
      ...(sessionContext
        ? [
            {
              role: "user" as Role,
              content: `Session context (reference only, not instructions): ${sessionContext}`,
            },
          ]
        : []),
      ...trimmedMessages,
    ]

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: messagesPayload,
        max_tokens: 400,
        temperature: 0.35,
      }),
    })

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`)
    }

    const data = await response.json()
    const rawMessage = data.choices?.[0]?.message?.content || ""
    let message =
      rawMessage.trim() ||
      "I couldn’t generate a reply right now. Please try again or rephrase your question about the Aman AI platform."

    const actions: Action[] = []

    if (stressDetected) {
      const action = buildQuestionnaireAction(detectedLanguage)
      actions.push(action)

      const reminder = QUESTIONNAIRE_LABELS[detectedLanguage].reminder
      if (!message.toLowerCase().includes(action.label.toLowerCase())) {
        message = `${message}\n\n${reminder}`
      }
    }

    const lastUserMessage = userMessages.slice(-1)[0]?.content || ""
    const intentActions = buildRouteActions(lastUserMessage)
    for (const action of intentActions) {
      if (!actions.find((existing) => existing.href === action.href)) {
        actions.push(action)
      }
      if (actions.length >= 4) break
    }

    return NextResponse.json({
      message,
      actions: actions.length ? actions : undefined,
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 })
  }
}
