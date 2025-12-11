"use client"

import React, { useState, useEffect } from 'react'
import { 
  TestTube, 
  UploadCloud, 
  Cpu, 
  TrendingUp,
  Check,
  Activity,
  Scan,
  Download,
  History,
  Brain,
  AlertCircle,
  CheckCircle2,
  Upload,
  FileText,
  X
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

const BIOMARKERS = [
  { name: 'Hs-CRP', value: '3.5', unit: 'mg/L', status: 'High', ref: '< 2.0', desc: 'Inflammation Marker' },
  { name: 'HbA1c', value: '5.7', unit: '%', status: 'Warning', ref: '< 5.7', desc: 'Blood Glucose Avg' },
  { name: 'LDL-P', value: '1100', unit: 'nmol/L', status: 'Normal', ref: '< 1300', desc: 'Lipid Particle Count' },
  { name: 'Vitamin D', value: '28', unit: 'ng/mL', status: 'Low', ref: '30-100', desc: 'Immune Support' },
  { name: 'Homocysteine', value: '11', unit: 'umol/L', status: 'Warning', ref: '< 10', desc: 'Cardio Health' },
]

export default function BloodAnalysisPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'complete'>('idle')
  const [activeStep, setActiveStep] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const removeFile = () => {
    setUploadedFile(null)
  }

  useEffect(() => {
    if (status === 'running') {
      let currentStep = 0
      const stepInterval = setInterval(() => {
        currentStep++
        setActiveStep(currentStep)

        if (currentStep >= STEPS.length + 1) {
          clearInterval(stepInterval)
          setStatus('complete')
        }
      }, 1000)

      return () => clearInterval(stepInterval)
    } else if (status === 'idle') {
      setActiveStep(0)
    }
  }, [status])

  const startDemo = () => setStatus('running')
  const resetDemo = () => setStatus('idle')

  const handleDownloadReport = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    
    doc.setFontSize(20)
    doc.setTextColor(15, 23, 42)
    doc.text("AI Blood Analysis Report", 20, 20)
    
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 28)
    
    doc.setFontSize(14)
    doc.setTextColor(15, 23, 42)
    doc.text("Clinical Summary", 20, 45)
    
    doc.setFontSize(11)
    doc.setTextColor(71, 85, 105)
    const summaryLines = doc.splitTextToSize(
      "Patient shows signs of inflammatory stress (Elevated Hs-CRP). Combined with low Vitamin D, this suggests a need for immune system modulation.", 
      170
    )
    doc.text(summaryLines, 20, 55)
    
    let yPos = 85
    doc.setFontSize(14)
    doc.setTextColor(15, 23, 42)
    doc.text("Biomarker Analysis", 20, yPos)
    
    yPos += 15
    BIOMARKERS.forEach((marker) => {
      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text(`${marker.name}: ${marker.value} ${marker.unit} (${marker.status})`, 20, yPos)
      yPos += 10
    })
    
    doc.save("AmanAI_Blood_Analysis_Report.pdf")
  }

  const getStatusBadgeStyles = (status: string) => {
    switch(status) {
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
            AI анализирует более 50 биомаркеров крови, выявляя скрытые паттерны воспаления, 
            гормональных изменений и метаболических рисков.
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
                  PDF, CSV, или изображения (до 20 MB)
                </p>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf,.csv,.jpg,.jpeg,.png,.txt"
                  onChange={handleFileUpload}
                />
                <span className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  Выбрать файл
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 animate-fade-up stagger-1">
          {status === 'running' && (
            <div className="px-4 py-2 bg-background/80 backdrop-blur-sm border rounded-xl text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Обработка...
            </div>
          )}
          {status === 'complete' && (
            <div className="px-4 py-2 bg-background/80 backdrop-blur-sm border rounded-xl text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
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
          <Button 
            variant={status === 'idle' ? 'default' : 'outline'}
            onClick={startDemo}
            disabled={status === 'running' || status === 'complete'}
            className="gap-2"
          >
            {status === 'running' ? (
              <Activity className="w-4 h-4 animate-spin" />
            ) : (
              <Scan className="w-4 h-4" />
            )}
            {status === 'running' ? 'Анализ...' : status === 'complete' ? 'Завершено' : 'Начать анализ'}
          </Button>
        </div>

        {/* Steps (Idle/Running) */}
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

        {/* Results (Complete) */}
        {status === 'complete' && (
          <div className="space-y-6 animate-fade-up">
            {/* Summary Card */}
            <div className="bg-background/60 backdrop-blur-sm p-6 rounded-2xl border flex flex-col lg:flex-row gap-8 items-center">
              <div className="h-64 w-full lg:w-72 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={RADAR_DATA}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis 
                      dataKey="subject" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} 
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                    <Radar 
                      name="Patient" 
                      dataKey="A" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2} 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.2} 
                    />
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

            {/* Biomarkers List */}
            <div className="grid gap-4">
              {BIOMARKERS.map((marker, i) => (
                <div 
                  key={i} 
                  className="group bg-background/60 backdrop-blur-sm p-6 rounded-2xl border hover:border-primary/50 transition-all flex flex-col md:flex-row gap-6 items-start md:items-center"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${
                    marker.status === 'Normal' ? 'bg-muted text-muted-foreground' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {marker.status === 'Normal' ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <AlertCircle className="w-6 h-6" />
                    )}
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

                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 border text-xs font-bold rounded-full ${getStatusBadgeStyles(marker.status)}`}>
                      {marker.status === 'Normal' ? 'Норма' : 
                       marker.status === 'High' ? 'Высокий' :
                       marker.status === 'Low' ? 'Низкий' : 'Внимание'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

