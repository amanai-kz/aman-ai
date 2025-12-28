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

// Marker display names and descriptions
const MARKER_INFO: Record<string, { name: string; desc: string }> = {
  hemoglobin: { name: 'Гемоглобин', desc: 'Переносчик кислорода' },
  rbc: { name: 'Эритроциты', desc: 'Красные кровяные тельца' },
  wbc: { name: 'Лейкоциты', desc: 'Белые кровяные тельца' },
  platelets: { name: 'Тромбоциты', desc: 'Свертываемость крови' },
  hematocrit: { name: 'Гематокрит', desc: 'Объем эритроцитов' },
  glucose: { name: 'Глюкоза', desc: 'Уровень сахара в крови' },
  cholesterol: { name: 'Холестерин', desc: 'Общий холестерин' },
  hdl: { name: 'ЛПВП', desc: '"Хороший" холестерин' },
  ldl: { name: 'ЛПНП', desc: '"Плохой" холестерин' },
  triglycerides: { name: 'Триглицериды', desc: 'Липидный профиль' },
  alt: { name: 'АЛТ', desc: 'Функция печени' },
  ast: { name: 'АСТ', desc: 'Функция печени' },
  creatinine: { name: 'Креатинин', desc: 'Функция почек' },
  urea: { name: 'Мочевина', desc: 'Функция почек' },
  sodium: { name: 'Натрий', desc: 'Электролит' },
  potassium: { name: 'Калий', desc: 'Электролит' },
  calcium: { name: 'Кальций', desc: 'Электролит' },
  iron: { name: 'Железо', desc: 'Метаболизм' },
  ferritin: { name: 'Ферритин', desc: 'Запасы железа' },
  tsh: { name: 'ТТГ', desc: 'Щитовидная железа' },
  t4_free: { name: 'Св. Т4', desc: 'Щитовидная железа' },
  vitamin_d: { name: 'Витамин D', desc: 'Иммунитет' },
  vitamin_b12: { name: 'Витамин B12', desc: 'Нервная система' },
  crp: { name: 'С-реактивный белок', desc: 'Воспаление' },
  esr: { name: 'СОЭ', desc: 'Скорость оседания' },
  neutrophils: { name: 'Нейтрофилы', desc: 'Лейкоцитарная формула' },
  lymphocytes: { name: 'Лимфоциты', desc: 'Лейкоцитарная формула' },
  estradiol: { name: 'Эстрадиол', desc: 'Гормон' },
  testosterone: { name: 'Тестостерон', desc: 'Гормон' },
  cortisol: { name: 'Кортизол', desc: 'Гормон стресса' },
}

interface NLPResult {
  markers: Record<string, { value: number | null; unit: string | null; status: string | null; confidence: number }>
  summary: { found_markers: number; alerts: Array<{ marker: string; status: string; severity: string }>; critical_count: number; warning_count: number }
  labName?: string
  analysisDate?: string
}

export default function BloodAnalysisPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle')
  const [activeStep, setActiveStep] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [parsedData, setParsedData] = useState<Partial<BloodTestInput> | null>(null)
  const [nlpResult, setNlpResult] = useState<NLPResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isCsv = file.name.toLowerCase().endsWith('.csv')
    
    if (!isPdf && !isCsv) {
      setError('Пожалуйста, загрузите PDF или CSV файл')
      return
    }

    setUploadedFile(file)
    setError(null)

    try {
      if (isPdf) {
        // Use NLP API for PDF extraction
        setStatus('running')
        const formData = new FormData()
        formData.append('file', file)
        formData.append('patient_id', 'current_user') // TODO: Get from session
        formData.append('save_to_profile', 'true')
        
        const response = await fetch('/api/blood/extract', {
          method: 'POST',
          body: formData,
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Ошибка при обработке PDF')
        }
        
        const result = await response.json()
        
        // Convert NLP result to our format
        const extractedData: Partial<BloodTestInput> = {}
        const markers = result.markers || {}
        
        if (markers.wbc?.value) extractedData.WBC = markers.wbc.value
        if (markers.rbc?.value) extractedData.RBC = markers.rbc.value
        if (markers.hemoglobin?.value) extractedData.HGB = markers.hemoglobin.value
        if (markers.platelets?.value) extractedData.PLT = markers.platelets.value
        if (markers.neutrophils?.value) extractedData.NEUT = markers.neutrophils.value
        if (markers.lymphocytes?.value) extractedData.LYMPH = markers.lymphocytes.value
        if (markers.monocytes?.value) extractedData.MONO = markers.monocytes.value
        if (markers.eosinophils?.value) extractedData.EO = markers.eosinophils.value
        if (markers.basophils?.value) extractedData.BASO = markers.basophils.value
        
        setParsedData(extractedData)
        setNlpResult(result)
        setStatus('complete')
        
      } else {
        // CSV parsing (existing logic)
        const content = await file.text()
        const data = parseCSV(content)
        
        const requiredFields: (keyof BloodTestInput)[] = ['WBC', 'RBC', 'HGB', 'PLT']
        const found = requiredFields.filter(f => data[f] !== undefined)
        
        if (found.length === 0) {
          setError('Не найдены данные анализа крови. Убедитесь что CSV содержит колонки: WBC, RBC, HGB, PLT и др.')
          return
        }

        setParsedData(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при чтении файла')
      setStatus('error')
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
    setParsedData(null)
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
    setParsedData(null)
    setNlpResult(null)
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
    
    if (parsedData) {
      doc.setFontSize(14)
      doc.setTextColor(15, 23, 42)
      doc.text("Загруженные данные:", 20, 45)
      
      let yPos = 55
      Object.entries(parsedData).forEach(([key, value]) => {
        doc.setFontSize(11)
        doc.text(`${key}: ${value}`, 20, yPos)
        yPos += 8
      })
    }
    
    doc.setFontSize(14)
    doc.text("Biomarker Analysis:", 20, parsedData ? 120 : 50)
    
    let yPos = parsedData ? 130 : 60
    if (nlpResult?.markers) {
      Object.entries(nlpResult.markers)
        .filter(([, data]) => data && typeof data === 'object' && data.value !== null)
        .forEach(([key, data]) => {
          const markerData = data as { value: number; unit: string; status: string }
          const info = MARKER_INFO[key] || { name: key, desc: '' }
          doc.setFontSize(11)
          doc.text(`${info.name}: ${markerData.value} ${markerData.unit || ''} (${markerData.status || 'normal'})`, 20, yPos)
          yPos += 10
        })
    }
    
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
                      {parsedData && ` • ${Object.keys(parsedData).length} параметров найдено`}
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
                <p className="font-medium mb-1">Загрузить результаты анализа крови</p>
                <p className="text-sm text-muted-foreground mb-4">
                  PDF из Invivo/Олимп или CSV (60+ биомаркеров • RU/KZ/EN)
                </p>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  className="hidden" 
                  accept=".pdf,.csv,application/pdf"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />
                <span className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  Выбрать файл
                </span>
              </label>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {parsedData && Object.keys(parsedData).length > 0 && (
            <div className="mt-4 p-4 bg-muted/50 rounded-xl">
              <p className="text-sm font-medium mb-2">Найденные параметры:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(parsedData).map(([key, value]) => (
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
                  {nlpResult?.summary?.critical_count ? (
                    `Обнаружено ${nlpResult.summary.critical_count} критичных показателей. `
                  ) : ''}
                  {nlpResult?.summary?.warning_count ? (
                    `${nlpResult.summary.warning_count} показателей требуют внимания. `
                  ) : ''}
                  {!nlpResult?.summary?.critical_count && !nlpResult?.summary?.warning_count ? (
                    'Все найденные показатели в пределах нормы.'
                  ) : (
                    'Рекомендуется консультация с врачом.'
                  )}
                </p>
                <div className="flex gap-2">
                  {nlpResult?.labName && (
                    <span className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-lg">
                      Лаборатория: {nlpResult.labName}
                    </span>
                  )}
                  <span className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-lg">
                    {nlpResult?.summary?.found_markers || 0} маркеров найдено
                  </span>
                </div>
              </div>
            </div>

            {/* Biomarkers from NLP */}
            <div className="grid gap-4">
              {nlpResult && Object.entries(nlpResult.markers)
                .filter(([, data]) => data && typeof data === 'object' && data.value !== null)
                .map(([key, data]) => {
                  const markerData = data as { value: number; unit: string; status: string; reference_min?: number; reference_max?: number }
                  const info = MARKER_INFO[key] || { name: key, desc: '' }
                  const status = markerData.status || 'normal'
                  const refRange = markerData.reference_min !== undefined && markerData.reference_max !== undefined 
                    ? `${markerData.reference_min} - ${markerData.reference_max}`
                    : '-'
                  
                  return (
                    <div key={key} className="group bg-background/60 backdrop-blur-sm p-6 rounded-2xl border hover:border-primary/50 transition-all flex flex-col md:flex-row gap-6 items-start md:items-center">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${
                        status === 'normal' ? 'bg-muted text-muted-foreground' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {status === 'normal' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium mb-1">{info.name}</h3>
                        <p className="text-muted-foreground text-sm mb-3">{info.desc}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-lg">
                            Значение: {markerData.value} {markerData.unit || ''}
                          </span>
                          <span className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-lg">
                            Норма: {refRange}
                          </span>
                        </div>
                      </div>

                      <span className={`px-3 py-1 border text-xs font-bold rounded-full ${getStatusBadgeStyles(status === 'normal' ? 'Normal' : status === 'high' ? 'High' : status === 'low' ? 'Low' : 'Warning')}`}>
                        {status === 'normal' ? 'Норма' : status === 'high' ? 'Высокий' : status === 'low' ? 'Низкий' : status === 'critical' ? 'Критичный' : 'Внимание'}
                      </span>
                    </div>
                  )
                })}
              
              {/* Fallback if no NLP data */}
              {(!nlpResult || Object.keys(nlpResult.markers).filter(k => nlpResult.markers[k]?.value !== null).length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Маркеры не найдены в документе</p>
                  <p className="text-sm mt-2">Попробуйте загрузить другой PDF файл</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
