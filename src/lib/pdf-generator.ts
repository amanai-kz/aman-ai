"use client"

import type { jsPDF as JsPDFType } from "jspdf"
import QRCode from "qrcode"

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
  reportId?: string | null
}

export interface BloodTestData {
  markerName: string
  value: number | string
  unit: string
  referenceRange: string
  status: "normal" | "high" | "low" | "critical"
}

export interface PdfOptions {
  brandName?: string
  logoUrl?: string
  includeQRCode?: boolean
  includePageNumbers?: boolean
  colorMode?: "color" | "grayscale"
  language?: "ru" | "kz" | "en"
}

export interface PdfExportOptions extends PdfOptions {
  includeDialogue?: boolean
  includeCharts?: boolean
  paperSize?: "a4" | "letter"
}

export type ProgressCallback = (progress: number, status: string) => void

// Dev glyph check (keep when validating font): Қ Ә І Ң Ө Ұ Ү Һ қ ә і ң ө ұ ү һ Я Ю Ш Щ Ы Э

const FONT_NAME = "NotoSans"
const FONT_FILE = "NotoSans-Regular.ttf"
const DEFAULT_FONT_PATH = "/fonts/NotoSans-Regular.ttf"
const DEFAULT_LOGO = "/icon.svg"

let fontDataCache: string | null = null
let logoCache: Record<string, string> = {}

const svgToPngDataUrl = (svgText: string, size: number = 128): Promise<string> => {
  return new Promise((resolve, reject) => {
    const svg = svgText
      .replace(/stroke="currentColor"/g, 'stroke="#1e293b"')
      .replace(/width="\d+"/, `width="${size}"`)
      .replace(/height="\d+"/, `height="${size}"`)
    
    const blob = new Blob([svg], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Failed to get canvas context"))
        return
      }
      ctx.drawImage(img, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL("image/png"))
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to load SVG"))
    }
    
    img.src = url
  })
}

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
  
  // Handle SVG files - convert to PNG
  if (url.endsWith(".svg")) {
    const svgText = await response.text()
    const dataUrl = await svgToPngDataUrl(svgText, 128)
    logoCache[url] = dataUrl
    return dataUrl
  }
  
  // Handle other image formats
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

// Generate QR Code for report verification
async function generateQRCode(reportId: string): Promise<string> {
  const verificationUrl = `${window.location.origin}/verify/${reportId}`
  try {
    return await QRCode.toDataURL(verificationUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })
  } catch (error) {
    console.error("Failed to generate QR code:", error)
    throw error
  }
}

// Add page numbering to all pages
function addPageNumbering(doc: JsPDFType, brandName: string) {
  const pageCount = (doc.internal as any).getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(9)
    doc.setTextColor(150, 150, 150)

    // Page number
    doc.text(
      `Страница ${i} из ${pageCount}`,
      pageWidth / 2,
      pageHeight - 15,
      { align: "center" }
    )

    // Add header on subsequent pages
    if (i > 1) {
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text(`${brandName} - Медицинский отчет`, 42, 25)
      doc.setDrawColor(200, 200, 200)
      doc.line(42, 28, pageWidth - 42, 28)
    }
  }
}

// Add chart from HTML element to PDF
export async function addChartToPdf(
  doc: JsPDFType,
  elementId: string,
  x: number,
  y: number,
  maxWidth: number = 500
): Promise<number> {
  try {
    const html2canvas = (await import("html2canvas")).default
    const element = document.getElementById(elementId)
    if (!element) {
      console.warn(`Element with ID ${elementId} not found`)
      return 0
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
    })

    const imgData = canvas.toDataURL("image/png")
    const imgWidth = maxWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    doc.addImage(imgData, "PNG", x, y, imgWidth, imgHeight)
    return imgHeight
  } catch (error) {
    console.error("Failed to add chart to PDF:", error)
    return 0
  }
}

// Generate consultation PDF with all enhancements
export async function generateConsultationPdf(
  data: ConsultationReportData,
  options: PdfExportOptions = {},
  onProgress?: ProgressCallback
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("PDF generation is only available in the browser")
  }

  onProgress?.(5, "Инициализация PDF...")

  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({
    unit: "pt",
    format: options.paperSize || "a4",
    compress: true,
  })

  onProgress?.(10, "Загрузка шрифтов...")
  await ensureFont(doc)

  // Set PDF metadata
  const patientName = data.patientName || "Пациент"
  doc.setProperties({
    title: `Медицинский отчет - ${patientName}`,
    subject: "Консультация",
    author: options.brandName || "AMAN AI",
    keywords: "medical, consultation, report, aman ai",
    creator: "AMAN AI Platform",
  })

  onProgress?.(20, "Подготовка данных...")

  const brandName = options.brandName || "AMAN AI"
  const logoUrl = options.logoUrl || DEFAULT_LOGO
  const includeQRCode = options.includeQRCode !== false
  const includePageNumbers = options.includePageNumbers !== false
  const includeDialogue = options.includeDialogue !== false

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 42
  const contentWidth = pageWidth - margin * 2
  let cursorY = margin

  const addSection = (
    title: string,
    body: string | undefined | null,
    accent: [number, number, number]
  ) => {
    const textContent = body && body.trim() ? body.trim() : "Нет данных"
    const wrapped = splitText(doc, textContent, contentWidth - 16)
    const estimatedHeight = wrapped.length * 16 + 38

    if (cursorY + estimatedHeight > pageHeight - margin - 30) {
      doc.addPage()
      cursorY = 50 // Leave space for header on new pages
    }

    const softened = accent.map((value) =>
      Math.min(255, Math.round(value + (255 - value) * 0.75))
    ) as [number, number, number]
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

  onProgress?.(30, "Добавление заголовка...")

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

  // Add QR Code if report ID exists and option is enabled
  if (includeQRCode && data.reportId) {
    try {
      const qrDataUrl = await generateQRCode(data.reportId)
      doc.addImage(qrDataUrl, "PNG", pageWidth - margin - 60, cursorY, 60, 60)
      doc.setFontSize(7)
      doc.setTextColor(100, 116, 139)
      doc.text("Сканируйте для", pageWidth - margin - 60, cursorY + 68, {
        align: "left",
      })
      doc.text("проверки онлайн", pageWidth - margin - 60, cursorY + 76, {
        align: "left",
      })
    } catch (error) {
      console.error("Failed to add QR code:", error)
    }
  }

  cursorY += 72

  onProgress?.(40, "Добавление информации о пациенте...")

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

  onProgress?.(50, "Добавление основного содержимого...")

  // Sections
  addSection("Резюме / Қорытынды", data.conclusion, [16, 185, 129])
  onProgress?.(60, "Добавление состояния...")
  addSection("Общее состояние", data.generalCondition, [59, 130, 246])
  onProgress?.(70, "Добавление рекомендаций...")
  addSection("Рекомендации / Ұсынымдар", data.recommendations, [251, 191, 36])
  
  if (includeDialogue) {
    onProgress?.(80, "Добавление диалога...")
    addSection("Диалог", data.dialogueProtocol, [139, 92, 246])
  }

  onProgress?.(85, "Добавление метаданных...")

  // Footer on first page
  const footerY = pageHeight - margin / 1.5
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `${brandName} • amanai.kz • Сгенерировано: ${formatDate(new Date())}`,
    margin,
    footerY
  )

  // Add page numbers if enabled
  if (includePageNumbers) {
    onProgress?.(90, "Добавление номеров страниц...")
    addPageNumbering(doc, brandName)
  }

  onProgress?.(100, "Завершение...")

  return doc.output("blob")
}

// Generate blood test PDF with table
export async function generateBloodTestPdf(
  testData: BloodTestData[],
  patientInfo: {
    name?: string
    age?: string | number
    testDate?: string | Date
    labName?: string
  },
  options: PdfOptions = {},
  onProgress?: ProgressCallback
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("PDF generation is only available in the browser")
  }

  onProgress?.(5, "Инициализация PDF...")

  const { jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default

  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    compress: true,
  })

  onProgress?.(15, "Загрузка шрифтов...")
  await ensureFont(doc)

  // Set PDF metadata
  doc.setProperties({
    title: `Анализ крови - ${patientInfo.name || "Пациент"}`,
    subject: "Blood Test Analysis",
    author: options.brandName || "AMAN AI",
    keywords: "blood test, analysis, medical, laboratory",
    creator: "AMAN AI Platform",
  })

  onProgress?.(25, "Подготовка данных...")

  const brandName = options.brandName || "AMAN AI"
  const logoUrl = options.logoUrl || DEFAULT_LOGO
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 42
  let cursorY = margin

  onProgress?.(35, "Добавление заголовка...")

  // Header
  try {
    const dataUrl = await fetchAssetAsDataUrl(logoUrl)
    doc.addImage(dataUrl, "PNG", margin, cursorY, 56, 56)
  } catch {
    // Continue without logo
  }

  doc.setTextColor(27, 36, 48)
  doc.setFontSize(18)
  doc.text(brandName, margin + 64, cursorY + 18)
  doc.setFontSize(11)
  doc.setTextColor(71, 85, 105)
  doc.text("Результаты анализа крови", margin + 64, cursorY + 36)
  doc.text(`Создан: ${formatDate(new Date())}`, margin + 64, cursorY + 52)
  cursorY += 72

  onProgress?.(45, "Добавление информации о пациенте...")

  // Patient info
  doc.setFillColor(240, 253, 250)
  doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 90, 10, 10, "F")
  doc.setTextColor(16, 94, 82)
  doc.setFontSize(13)
  doc.text("Информация о пациенте", margin + 12, cursorY + 20)

  doc.setTextColor(38, 50, 56)
  doc.setFontSize(11)
  doc.text(`Имя: ${patientInfo.name || "Не указано"}`, margin + 12, cursorY + 38)
  if (patientInfo.age) {
    doc.text(`Возраст: ${patientInfo.age}`, margin + 12, cursorY + 54)
  }
  if (patientInfo.labName) {
    doc.text(`Лаборатория: ${patientInfo.labName}`, margin + 12, cursorY + 70)
  }
  cursorY += 100

  onProgress?.(60, "Создание таблицы результатов...")

  // Prepare table data
  const tableData = testData.map((test) => [
    test.markerName,
    String(test.value),
    test.unit,
    test.referenceRange,
    test.status === "normal" ? "Норма" : test.status === "high" ? "Выше" : test.status === "low" ? "Ниже" : "Критично",
  ])

  onProgress?.(75, "Форматирование таблицы...")

  // Add table using autoTable
  autoTable(doc, {
    startY: cursorY,
    head: [["Показатель", "Значение", "Единицы", "Референсный диапазон", "Статус"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 8,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 80, halign: "center" },
      2: { cellWidth: 70, halign: "center" },
      3: { cellWidth: 120, halign: "center" },
      4: { cellWidth: 80, halign: "center" },
    },
    didParseCell: (data) => {
      // Color code status column
      if (data.column.index === 4 && data.section === "body") {
        const status = testData[data.row.index]?.status
        if (status === "high" || status === "critical") {
          data.cell.styles.textColor = [239, 68, 68] // Red
          data.cell.styles.fontStyle = "bold"
        } else if (status === "low") {
          data.cell.styles.textColor = [251, 146, 60] // Orange
          data.cell.styles.fontStyle = "bold"
        } else {
          data.cell.styles.textColor = [16, 185, 129] // Green
        }
      }
    },
    margin: { left: margin, right: margin },
  })

  onProgress?.(90, "Добавление номеров страниц...")

  // Add page numbering
  addPageNumbering(doc, brandName)

  onProgress?.(100, "Завершение...")

  return doc.output("blob")
}
