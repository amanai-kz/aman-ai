"use client"

import React, { useRef, useState } from "react"
import Image from "next/image"
import {
  Brain,
  UploadCloud,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  X,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Surface for the SCRUM-7 MRI engine: upload a 2D MRI slice for segmentation or
// a 3D NIfTI study for triage and show the configured model's result. The
// analysis is also persisted and
// lands on the radiologist worklist for sign-off (decision D2 — assistive only).

type EngineResult = {
  findings: string[]
  confidence: number
  risk_level: string
  recommendations: string[]
  processing_time_ms: number
  segmentation?: {
    mask_png_base64: string
    width: number
    height: number
    positive_pixel_count: number
    positive_area_fraction: number
    max_probability: number
    mean_positive_probability: number | null
    threshold: number
  }
}

type AnalyzeResponse = {
  analysis: {
    id: string
    confidence: number | null
    riskLevel: string
    findings: string[]
    result: EngineResult
  }
}

const RISK_STYLES: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700 border-red-200",
  MODERATE: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
}

const RISK_LABEL: Record<string, string> = {
  HIGH: "Высокий риск",
  MODERATE: "Требует проверки клиницистом",
  LOW: "Низкий риск",
}

const ASSISTIVE_MARK = "Assistive output"

type SegmentationMode = "engine" | "static" | "adaptive"

const MODE_COPY: Record<SegmentationMode, { eyebrow: string; detail: string }> = {
  engine: {
    eyebrow: "MRI движок · SCRUM-7",
    detail: "Загрузите срез PNG/JPEG/TIFF для сегментации или 3D-снимок NIfTI.",
  },
  static: {
    eyebrow: "MRI сегментация · Static",
    detail: "Загрузите срез PNG/JPEG/TIFF для сегментации фиксированной настроенной моделью.",
  },
  adaptive: {
    eyebrow: "MRI сегментация · Adaptive",
    detail:
      "Загрузите срез PNG/JPEG/TIFF. Сейчас этот режим использует ту же фиксированную модель и не обучается на загруженных данных.",
  },
}

function parseFinding(line: string): { name: string; prob: number | null } {
  const m = line.match(/^(.*?):\s*([0-9.]+)\s*$/)
  if (!m) return { name: line, prob: null }
  return { name: m[1].trim(), prob: parseFloat(m[2]) }
}

export function MriAnalyzePanel({
  patientId,
  mode = "engine",
}: {
  patientId: string | null
  mode?: SegmentationMode
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResponse["analysis"] | null>(null)

  const pick = (f: File | undefined) => {
    if (!f) return
    const allowed = mode === "engine" ? /\.(nii(\.gz)?|png|jpe?g|tiff?)$/i : /\.(png|jpe?g|tiff?)$/i
    if (!allowed.test(f.name)) {
      setError(
        mode === "engine"
          ? "Нужен срез PNG/JPEG/TIFF или объём NIfTI (.nii/.nii.gz)."
          : "Нужен срез MRI в формате PNG, JPEG или TIFF."
      )
      return
    }
    setError(null)
    setResult(null)
    setFile(f)
  }

  const analyze = async () => {
    if (!file || !patientId) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append("file", file, file.name)
      fd.append("patientId", patientId)
      const res = await fetch("/api/mri/analyze", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 503) {
          throw new Error(
            "Модель сегментации пока недоступна. Для инференса требуется настроенная совместимая модель; результат анализа не создан."
          )
        }
        throw new Error(data?.error || `Ошибка анализа (${res.status})`)
      }
      setResult((data as AnalyzeResponse).analysis)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось проанализировать снимок.")
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  const engine = result?.result
  const findings = (engine?.findings ?? []).filter((f) => !f.startsWith(ASSISTIVE_MARK))
  const assistiveNote = (engine?.findings ?? []).find((f) => f.startsWith(ASSISTIVE_MARK))
  const modeCopy = MODE_COPY[mode]
  const acceptsVolumes = mode === "engine"

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
          <Brain className="w-4 h-4" /> {modeCopy.eyebrow}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Анализ МРТ головного мозга</h1>
        <p className="text-muted-foreground max-w-2xl">
          {modeCopy.detail} Снимок проходит только настроенную модель; при отсутствии
          совместимых весов система не создаёт результат. Вывод ассистивный и требует
          проверки клиницистом.
        </p>
      </div>

      {!patientId && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          В системе нет ни одного пациента, к которому привязать анализ. Войдите под
          пациентом или создайте его в админке.
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          pick(e.dataTransfer.files?.[0])
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
          isDragging ? "border-foreground bg-muted/50" : "border-border hover:border-foreground/40"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={
            acceptsVolumes
              ? ".png,.jpg,.jpeg,.tif,.tiff,.nii,.nii.gz,image/png,image/jpeg,image/tiff,application/gzip,application/octet-stream"
              : ".png,.jpg,.jpeg,.tif,.tiff,image/png,image/jpeg,image/tiff"
          }
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground" />
        <p className="mt-3 font-medium">
          {file ? file.name : "Перетащите снимок сюда или нажмите для выбора"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {file
            ? `${(file.size / 1024 / 1024).toFixed(1)} МБ`
            : acceptsVolumes
              ? "PNG/JPEG/TIFF (срез) или NIfTI (объём) · максимум 10 МБ"
              : "PNG/JPEG/TIFF (срез) · максимум 10 МБ"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={analyze} disabled={!file || !patientId || loading} size="lg">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Выполняется сегментация…
            </>
          ) : (
            <>
              <Activity className="w-4 h-4" /> Запустить анализ
            </>
          )}
        </Button>
        {(file || result) && (
          <Button variant="ghost" onClick={reset} disabled={loading}>
            <X className="w-4 h-4" /> Сбросить
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && engine && (
        <div className="rounded-2xl border bg-card p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Результат анализа
            </div>
            <Badge
              variant="outline"
              className={cn("text-sm px-3 py-1", RISK_STYLES[result.riskLevel] ?? "")}
            >
              {RISK_LABEL[result.riskLevel] ?? result.riskLevel}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Максимальный отклик модели</div>
              <div className="text-2xl font-semibold">{(engine.confidence * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-muted-foreground">Время инференса</div>
              <div className="text-2xl font-semibold">{engine.processing_time_ms} мс</div>
            </div>
            <div>
              <div className="text-muted-foreground">Скан</div>
              <div className="text-2xl font-semibold uppercase">MRI</div>
            </div>
          </div>

          {/* Per-finding probabilities */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Вероятности находок (калиброванные)
            </div>
            {findings.map((line, i) => {
              const { name, prob } = parseFinding(line)
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{name}</span>
                    {prob !== null && <span className="font-mono">{prob.toFixed(2)}</span>}
                  </div>
                  {prob !== null && (
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-foreground transition-all"
                        style={{ width: `${Math.min(prob * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Recommendations */}
          {engine.segmentation && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Маска сегментации (порог {engine.segmentation.threshold})
              </div>
              {/* The mask contains no source pixels; it is still protected patient analysis data. */}
              <Image
                src={`data:image/png;base64,${engine.segmentation.mask_png_base64}`}
                alt="Маска сегментации для проверки радиологом"
                width={engine.segmentation.width}
                height={engine.segmentation.height}
                unoptimized
                className="rounded-lg border bg-black [image-rendering:pixelated]"
              />
              <div className="text-xs text-muted-foreground">
                Выделено {(engine.segmentation.positive_area_fraction * 100).toFixed(2)}% обработанного среза.
              </div>
            </div>
          )}

          {/* Recommendations */}
          {engine.recommendations?.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Рекомендация</div>
              <ul className="list-disc list-inside text-sm space-y-1">
                {engine.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Assistive / sign-off note */}
          <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-muted-foreground" />
            <div>
              {assistiveNote ?? "Ассистивный вывод — требует подписи радиолога (D2)."}
              <div className="text-muted-foreground mt-1">
                Анализ сохранён и добавлен в очередь радиолога (worklist) для верификации.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
