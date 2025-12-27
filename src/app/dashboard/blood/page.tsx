"use client"

import React, { useState, useEffect, useRef } from 'react'
import { 
  TestTube, 
  UploadCloud, 
  Cpu, 
  TrendingUp,
  Check,
  Download,
  History,
  Brain,
  AlertCircle,
  CheckCircle2,
  Upload,
  FileText,
  X,
  Loader2
} from 'lucide-react'
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  Tooltip,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { DashboardBackground } from '@/components/dashboard-background'

interface BloodTestInput {
  WBC: number
  RBC: number
  HGB: number
  PLT: number
  NEUT: number
  LYMPH: number
  MONO: number
  EO: number
  BASO: number
}

interface AnalysisStep {
  id: number
  title: string
  description: string
  icon: React.ElementType
}

const STEPS: AnalysisStep[] = [
  { id: 1, title: 'Collection', description: 'Sample logged', icon: TestTube },
  { id: 2, title: 'Upload', description: 'Secure transfer', icon: UploadCloud },
  { id: 3, title: 'Analysis', description: 'Pattern check', icon: Cpu },
  { id: 4, title: 'Insights', description: 'Risk stratification', icon: TrendingUp },
]

const RADAR_DATA = [
  { subject: 'Metabolic', A: 120, fullMark: 150 },
  { subject: 'Inflammation', A: 98, fullMark: 150 },
  { subject: 'Hormonal', A: 86, fullMark: 150 },
  { subject: 'Nutrition', A: 99, fullMark: 150 },
  { subject: 'Cardio', A: 85, fullMark: 150 },
  { subject: 'Liver', A: 65, fullMark: 150 },
]

// Field mappings for CSV parsing
const FIELD_MAPPINGS: Record<string, keyof BloodTestInput> = {
  'wbc': 'WBC', 'white blood cell': 'WBC',
  'rbc': 'RBC', 'red blood cell': 'RBC',
  'hgb': 'HGB', 'hemoglobin': 'HGB',
  'plt': 'PLT', 'platelet': 'PLT',
  'neut': 'NEUT', 'neutrophils': 'NEUT',
  'lymph': 'LYMPH', 'lymphocytes': 'LYMPH',
  'mono': 'MONO', 'monocytes': 'MONO',
  'eo': 'EO', 'eosinophils': 'EO',
  'baso': 'BASO', 'basophils': 'BASO',
}

const extractValue = (text: string): number | null => {
  if (!text) return null
  const cleaned = text.toString().replace(/[^\d.]/g, ' ').trim()
  const match = cleaned.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : null
}

const findField = (text: string): keyof BloodTestInput | null => {
  const lower = text.toLowerCase().trim()
  for (const [key, value] of Object.entries(FIELD_MAPPINGS)) {
    if (lower.includes(key)) return value
  }
  return null
}

const parseCSV = (content: string): Partial<BloodTestInput> => {
  const data: Partial<BloodTestInput> = {}
  const lines = content.split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return data

  const headers = lines[0].split(',').map(h => h.trim())
  const values = lines[1].split(',').map(v => v.trim())

  headers.forEach((header, idx) => {
    const field = findField(header)
    if (field && values[idx]) {
      const value = extractValue(values[idx])
      if (value !== null) data[field] = value
    }
  })

  return data
}

const BIOMARKERS = [
  { name: 'Hs-CRP', value: '3.5', unit: 'mg/L', status: 'High', ref: '< 2.0', desc: 'Inflammation Marker' },
  { name: 'HbA1c', value: '5.7', unit: '%', status: 'Warning', ref: '< 5.7', desc: 'Blood Glucose Avg' },
  { name: 'LDL-P', value: '1100', unit: 'nmol/L', status: 'Normal', ref: '< 1300', desc: 'Lipid Particle Count' },
  { name: 'Vitamin D', value: '28', unit: 'ng/mL', status: 'Low', ref: '30-100', desc: 'Immune Support' },
  { name: 'Homocysteine', value: '11', unit: 'umol/L', status: 'Warning', ref: '< 10', desc: 'Cardio Health' },
]

export default function BloodAnalysisPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle')
  const [activeStep, setActiveStep] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [parsedMarkers, setParsedMarkers] = useState<Record<string, number | string> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:8000"

  const transformExtractedMarkers = (extracted: Record<string, any>) => {
    const formatted: Record<string, number | string> = {}
    Object.entries(extracted || {}).forEach(([key, value]) => {
      const val = value?.value
      if (val === null || val === undefined) return
      const unit = value?.unit
      formatted[key.toUpperCase()] = unit ? `${val} ${unit}` : val
    })
    return formatted
  }

  const handlePdfUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("patient_id", "demo")

      const response = await fetch(
        `${backendUrl}/api/v1/services/blood/upload-pdf`,
        {
          method: "POST",
          body: formData,
        }
      )

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        throw new Error(detail?.detail || "Ошибка загрузки PDF")
      }

      const payload = await response.json()
      setParsedMarkers(transformExtractedMarkers(payload.extracted))
      setStatus("complete")
    } catch (err: any) {
      setError(err?.message || "Не удалось обработать PDF")
      setStatus("error")
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    const isCsv = file.name.toLowerCase().endsWith('.csv')
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')

    if (!isCsv && !isPdf) {
      setError('Unsupported file type. Please upload CSV or PDF')
      return
    }

    setUploadedFile(file)
    setError(null)
    setParsedMarkers(null)

    if (isPdf) {
      await handlePdfUpload(file)
      return
    }

    try {
      const content = await file.text()
      const data = parseCSV(content)
      
      const requiredFields: (keyof BloodTestInput)[] = ['WBC', 'RBC', 'HGB', 'PLT']
      const found = requiredFields.filter(f => data[f] !== undefined)
      
      if (found.length === 0) {
        setError('No key markers found in CSV. Include columns like WBC, RBC, HGB, PLT')
        return
      }

      const normalizedData: Record<string, number | string> = {}
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          normalizedData[key] = value as number
        }
      })
      setParsedMarkers(normalizedData)
      setStatus('complete')
    } catch (err) {
      setError('Unable to read file contents')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const removeFile = () => {
    setUploadedFile(null)
    setParsedMarkers(null)
    setError(null)
  }

  useEffect(() => {
    if (status === 'running') {
      let step = 0
      const interval = setInterval(() => {
        step++
        setActiveStep(step)
        if (step >= STEPS.length + 1) {
          clearInterval(interval)
          setStatus('complete')
        }
      }, 1000)
      return () => clearInterval(interval)
    } else if (status === 'idle') {
      setActiveStep(0)
    }
  }, [status])

  const startAnalysis = () => {
    setError(null)
    setStatus('running')
  }

  const resetDemo = () => {
    setStatus('idle')
    setUploadedFile(null)
    setParsedMarkers(null)
    setError(null)
  }

  const handleDownloadReport = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    
    doc.setFontSize(20)
    doc.setTextColor(15, 23, 42)
    doc.text("AI Blood Analysis Report", 20, 20)
    
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 28)
    
    if (parsedMarkers) {
      doc.setFontSize(14)
      doc.setTextColor(15, 23, 42)
      doc.text("Загруженные данные:", 20, 45)
      
      let yPos = 55
      Object.entries(parsedMarkers).forEach(([key, value]) => {
        doc.setFontSize(11)
        doc.text(`${key}: ${value}`, 20, yPos)
        yPos += 8
      })
    }
    
    doc.setFontSize(14)
    doc.text("Biomarker Analysis:", 20, parsedMarkers ? 120 : 50)
    
    let yPos = parsedMarkers ? 130 : 60
    BIOMARKERS.forEach((marker) => {
      doc.setFontSize(11)
      doc.text(`${marker.name}: ${marker.value} ${marker.unit} (${marker.status})`, 20, yPos)
      yPos += 10
    })
    
    doc.save("AmanAI_Blood_Analysis_Report.pdf")
  }

  const getStatusBadgeStyles = (s: string) => {
    switch(s) {
      case 'High': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
      case 'Low': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800'
      case 'Warning': return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800'
      default: return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
    }
  }

  return (
    <div className="relative min-h-screen">
      <DashboardBackground />
      
      <div className="relative z-10 p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
            AI Blood Analysis
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            AI анализирует биомаркеры крови, выявляя паттерны воспаления, 
            гормональных изменений и метаболических рисков. Загрузите CSV файл с результатами анализа.
          </p>
        </div>

        {/* File Upload */}
        <div className="animate-fade-up stagger-1">
          <div 
            className={`relative border-2 border-dashed rounded-2xl p-8 transition-all ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : uploadedFile 
                  ? 'border-emerald-500 bg-emerald-500/5' 
                  : 'border-border hover:border-primary/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {uploadedFile ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl">
                    <FileText className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(uploadedFile.size / 1024).toFixed(1)} KB
                      {parsedMarkers && ` ? ${Object.keys(parsedMarkers).length} markers parsed`}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={removeFile}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer">
                <div className="p-4 bg-muted rounded-2xl mb-4">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="font-medium mb-1">Upload CSV or PDF blood test</p>
                <p className="text-sm text-muted-foreground mb-4">
                  CSV with WBC, RBC, HGB, PLT, NEUT, LYMPH columns or Invivo PDF (RU/KZ).
                </p>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  className="hidden" 
                  accept=".csv,application/pdf"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />
                <span className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  Choose file
                </span>
              </label>
            )}
          </div>

          {isUploading && (
            <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Обработка PDF...
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {parsedMarkers && Object.keys(parsedMarkers).length > 0 && (
            <div className="mt-4 p-4 bg-muted/50 rounded-xl">
              <p className="text-sm font-medium mb-2">Parsed markers:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(parsedMarkers).map(([key, value]) => (
                  <span key={key} className="px-3 py-1 bg-background border rounded-lg text-xs">
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 animate-fade-up stagger-1">
          {status === 'running' && (
            <div className="px-4 py-2 bg-background/80 backdrop-blur-sm border rounded-xl text-sm font-medium flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Обработка...
            </div>
          )}
          {status === 'complete' && (
            <div className="px-4 py-2 bg-background/80 backdrop-blur-sm border rounded-xl text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Анализ завершён
            </div>
          )}
          
          <div className="flex-1" />
          
          {status === 'complete' && (
            <>
              <Button onClick={handleDownloadReport} className="gap-2">
                <Download className="w-4 h-4" />
                Скачать отчёт
              </Button>
              <Button variant="outline" onClick={resetDemo} className="gap-2">
                <History className="w-4 h-4" />
                Сбросить
              </Button>
            </>
          )}
          {status !== 'complete' && (
            <Button 
              onClick={startAnalysis}
              disabled={status === 'running'}
              className="gap-2"
            >
              {status === 'running' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TrendingUp className="w-4 h-4" />
              )}
              {status === 'running' ? 'Анализ...' : 'Начать анализ'}
            </Button>
          )}
        </div>

        {/* Steps */}
        {(status === 'idle' || status === 'running') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up stagger-2">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              const isActive = status === 'running' && activeStep === i + 1
              const isDone = status === 'running' && activeStep > i + 1
              
              return (
                <div 
                  key={i} 
                  className={`bg-background/60 backdrop-blur-sm p-6 rounded-2xl border transition-all duration-300 ${
                    isActive ? 'border-primary shadow-lg ring-1 ring-primary/20' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-xl ${
                      isActive ? 'bg-primary/10 text-primary' : 
                      isDone ? 'bg-emerald-500/10 text-emerald-500' : 
                      'bg-muted text-muted-foreground'
                    }`}>
                      {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className="text-sm text-muted-foreground">{step.title}</span>
                  </div>
                  <div className="text-lg font-medium">{step.description}</div>
                  
                  {status === 'running' && isActive && (
                    <div className="w-full h-1 bg-muted rounded-full mt-4 overflow-hidden">
                      <div className="h-full bg-primary animate-pulse w-2/3 rounded-full" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Results */}
        {status === 'complete' && (
          <div className="space-y-6 animate-fade-up">
            {/* Summary */}
            <div className="bg-background/60 backdrop-blur-sm p-6 rounded-2xl border flex flex-col lg:flex-row gap-8 items-center">
              <div className="h-64 w-full lg:w-72 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={RADAR_DATA}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                    <Radar name="Patient" dataKey="A" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary))" fillOpacity={0.2} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-medium">Клиническое заключение</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Обнаружены признаки воспалительного стресса (повышенный Hs-CRP). 
                  В сочетании с низким уровнем витамина D это указывает на необходимость 
                  модуляции иммунной системы. Остальные метаболические маркеры в норме.
                </p>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-lg">
                    Точность: 94%
                  </span>
                  <span className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-lg">
                    52 биомаркера
                  </span>
                </div>
              </div>
            </div>

            {/* Biomarkers */}
            <div className="grid gap-4">
              {BIOMARKERS.map((marker, i) => (
                <div key={i} className="group bg-background/60 backdrop-blur-sm p-6 rounded-2xl border hover:border-primary/50 transition-all flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${
                    marker.status === 'Normal' ? 'bg-muted text-muted-foreground' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {marker.status === 'Normal' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium mb-1">{marker.name}</h3>
                    <p className="text-muted-foreground text-sm mb-3">{marker.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-lg">
                        Значение: {marker.value} {marker.unit}
                      </span>
                      <span className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-lg">
                        Норма: {marker.ref}
                      </span>
                    </div>
                  </div>

                  <span className={`px-3 py-1 border text-xs font-bold rounded-full ${getStatusBadgeStyles(marker.status)}`}>
                    {marker.status === 'Normal' ? 'Норма' : marker.status === 'High' ? 'Высокий' : marker.status === 'Low' ? 'Низкий' : 'Внимание'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
