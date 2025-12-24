"use client"

import type { jsPDF as JsPDFType } from "jspdf"

export interface ConsultationReportData {
  patientName?: string | null
  patientAge?: string | number | null
  recordingDuration?: number | null
  title?: string | null
  generalCondition?: string | null
  dialogueProtocol?: string | null
  recommendations?: string | null
  conclusion?: string | null
  createdAt?: string | Date | null
}

interface PdfOptions {
  brandName?: string
  logoUrl?: string
}

// Dev glyph check (keep when validating font): Қ Ә І Ң Ө Ұ Ү Һ қ ә і ң ө ұ ү һ Я Ю Ш Щ Ы Э

const FONT_NAME = "NotoSans"
const FONT_FILE = "NotoSans-Regular.ttf"
const DEFAULT_FONT_PATH = "/fonts/NotoSans-Regular.ttf"
const DEFAULT_LOGO = "/placeholder-logo.png"

let fontDataCache: string | null = null
let logoCache: Record<string, string> = {}

const bufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

const fetchAssetAsDataUrl = async (url: string) => {
  if (logoCache[url]) return logoCache[url]
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to load asset for PDF")
  const blob = await response.blob()
  const reader = new FileReader()
  const dataUrlPromise = new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
      } else {
        reject(new Error("Failed to read asset"))
      }
    }
    reader.onerror = () => reject(new Error("Failed to read asset"))
  })
  reader.readAsDataURL(blob)
  const dataUrl = await dataUrlPromise
  logoCache[url] = dataUrl
  return dataUrl
}

const ensureFont = async (doc: JsPDFType, fontPath = DEFAULT_FONT_PATH) => {
  if (fontDataCache) {
    doc.addFileToVFS(FONT_FILE, fontDataCache)
    doc.addFont(FONT_FILE, FONT_NAME, "normal")
    doc.setFont(FONT_NAME)
    return
  }

  const response = await fetch(fontPath)
  if (!response.ok) throw new Error("Failed to load PDF font")
  const buffer = await response.arrayBuffer()
  fontDataCache = bufferToBase64(buffer)

  doc.addFileToVFS(FONT_FILE, fontDataCache)
  doc.addFont(FONT_FILE, FONT_NAME, "normal")
  doc.setFont(FONT_NAME)
}

const formatDuration = (seconds?: number | null) => {
  if (!seconds && seconds !== 0) return "—"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins} мин ${secs.toString().padStart(2, "0")} c`
}

const formatDate = (value?: string | Date | null) => {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleString("ru-RU")
}

const splitText = (doc: JsPDFType, text: string, width: number) =>
  doc.splitTextToSize(text || "Нет данных", width)

export async function generateConsultationPdf(
  data: ConsultationReportData,
  options: PdfOptions = {}
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("PDF generation is only available in the browser")
  }

  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "pt", format: "a4" })

  await ensureFont(doc)

  const brandName = options.brandName || "AMAN AI"
  const logoUrl = options.logoUrl || DEFAULT_LOGO

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 42
  const contentWidth = pageWidth - margin * 2
  let cursorY = margin

const addSection = (title: string, body: string | undefined | null, accent: [number, number, number]) => {
    const textContent = (body && body.trim()) ? body.trim() : "Нет данных"
    const wrapped = splitText(doc, textContent, contentWidth - 16)
    const estimatedHeight = wrapped.length * 16 + 38

    if (cursorY + estimatedHeight > pageHeight - margin) {
      doc.addPage()
      cursorY = margin
    }

    const softened = accent.map(value => Math.min(255, Math.round(value + (255 - value) * 0.75))) as [
      number,
      number,
      number
    ]
    doc.setFillColor(softened[0], softened[1], softened[2])
    doc.roundedRect(margin, cursorY, contentWidth, estimatedHeight, 10, 10, "F")
    doc.setTextColor(27, 36, 48)
    doc.setFontSize(13)
    doc.text(title, margin + 12, cursorY + 20)
    doc.setFontSize(11)
    doc.setTextColor(71, 85, 105)
    doc.text(wrapped, margin + 12, cursorY + 38)
    cursorY += estimatedHeight + 12
  }

  const safeText = (value?: string | null, fallback = "—") =>
    value && value.trim().length > 0 ? value.trim() : fallback

  // Header
  try {
    const dataUrl = await fetchAssetAsDataUrl(logoUrl)
    doc.addImage(dataUrl, "PNG", margin, cursorY, 56, 56)
  } catch {
    // If logo load fails, continue with text-only header
  }

  doc.setTextColor(27, 36, 48)
  doc.setFontSize(18)
  doc.text(brandName, margin + 64, cursorY + 18)
  doc.setFontSize(11)
  doc.setTextColor(71, 85, 105)
  doc.text("Отчет по консультации", margin + 64, cursorY + 36)
  doc.text(`Создан: ${formatDate(data.createdAt)}`, margin + 64, cursorY + 52)
  cursorY += 72

  // Patient info block
  const infoHeight = 84
  doc.setFillColor(240, 253, 250)
  doc.roundedRect(margin, cursorY, contentWidth, infoHeight, 10, 10, "F")
  doc.setTextColor(16, 94, 82)
  doc.setFontSize(13)
  doc.text("Информация о пациенте", margin + 12, cursorY + 20)

  doc.setTextColor(38, 50, 56)
  doc.setFontSize(11)
  const patientLine = `Имя: ${safeText(data.patientName, "Не указано")}`
  const ageLine = data.patientAge ? `Возраст: ${data.patientAge}` : ""
  const durationLine = `Длительность записи: ${formatDuration(data.recordingDuration)}`

  doc.text(patientLine, margin + 12, cursorY + 38)
  if (ageLine) doc.text(ageLine, margin + 12, cursorY + 54)
  doc.text(durationLine, margin + 12, cursorY + (ageLine ? 70 : 54))
  cursorY += infoHeight + 16

  // Sections
  addSection("Резюме / Қорытынды", data.conclusion, [16, 185, 129])
  addSection("Общее состояние", data.generalCondition, [59, 130, 246])
  addSection("Рекомендации / Ұсынымдар", data.recommendations, [251, 191, 36])
  addSection("Диалог", data.dialogueProtocol, [139, 92, 246])

  // Footer
  const footerY = pageHeight - margin / 1.5
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `${brandName} • amanai.kz • Сгенерировано: ${formatDate(new Date())}`,
    margin,
    footerY
  )

  return doc.output("blob")
}
