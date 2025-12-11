"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { 
  Database, 
  FileSearch, 
  Activity, 
  Cpu, 
  UserCheck,
  Play,
  RefreshCw,
  Download,
  CheckCircle2,
  Dna,
  Upload,
  FileText,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardBackground } from '@/components/dashboard-background'

enum AnalysisStep {
  IDLE = 'idle',
  COLLECTION = 'collection',
  EXTRACT = 'extract',
  FOLD = 'fold',
  ANALYZE = 'analyze',
  REVIEW = 'review',
  COMPLETE = 'complete'
}

interface StepConfig {
  id: AnalysisStep
  title: string
  description: string
  duration: number
  icon: React.ElementType
}

const STEPS: StepConfig[] = [
  { id: AnalysisStep.COLLECTION, title: 'Сбор данных', description: 'Загрузка геномных последовательностей', duration: 2000, icon: Database },
  { id: AnalysisStep.EXTRACT, title: 'Экстракция', description: 'Идентификация генетических вариантов (SNPs)', duration: 2500, icon: FileSearch },
  { id: AnalysisStep.FOLD, title: 'Фолдинг белка', description: 'Симуляция 3D структуры белка (AlphaFold)', duration: 3000, icon: Activity },
  { id: AnalysisStep.ANALYZE, title: 'ML Анализ', description: 'Расчёт риска с помощью моделей', duration: 2500, icon: Cpu },
  { id: AnalysisStep.REVIEW, title: 'Проверка врача', description: 'Формирование клинического отчёта', duration: 2000, icon: UserCheck },
]

const SAMPLE_METRICS = [
  { label: 'Hemoglobin', value: 13.5, unit: 'g/dL', status: 'normal' },
  { label: 'WBC Count', value: 7.2, unit: 'K/µL', status: 'normal' },
  { label: 'CRP', value: 4.8, unit: 'mg/L', status: 'warning' },
  { label: 'LDL-C', value: 145, unit: 'mg/dL', status: 'warning' },
]

export default function GeneticsPage() {
  const [currentStep, setCurrentStep] = useState<AnalysisStep>(AnalysisStep.IDLE)
  const [progress, setProgress] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [dnaSequence, setDnaSequence] = useState<string[]>([])
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

  // Generate DNA sequence animation
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        const bases = ['A', 'C', 'G', 'T']
        const newBase = bases[Math.floor(Math.random() * 4)]
        setDnaSequence(prev => [...prev.slice(-30), newBase])
      }, 100)
      return () => clearInterval(interval)
    }
  }, [isRunning])

  const runSimulation = useCallback(async () => {
    setIsRunning(true)
    setProgress(0)
    setDnaSequence([])

    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i]
      setCurrentStep(step.id)
      
      const startProgress = (i / STEPS.length) * 100
      const endProgress = ((i + 1) / STEPS.length) * 100
      
      const startTime = Date.now()
      
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          const elapsed = Date.now() - startTime
          const percentageComplete = Math.min(elapsed / step.duration, 1)
          
          setProgress(startProgress + (endProgress - startProgress) * percentageComplete)
          
          if (elapsed >= step.duration) {
            clearInterval(interval)
            resolve()
          }
        }, 50)
      })
    }

    setCurrentStep(AnalysisStep.COMPLETE)
    setProgress(100)
    setIsRunning(false)
  }, [])

  const handleReset = () => {
    setCurrentStep(AnalysisStep.IDLE)
    setProgress(0)
    setIsRunning(false)
    setDnaSequence([])
  }

  const handleDownloadReport = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    
    doc.setFontSize(20)
    doc.setTextColor(15, 23, 42)
    doc.text("GenFlow AI Analysis Report", 20, 20)
    
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30)
    
    doc.setFontSize(14)
    doc.setTextColor(15, 23, 42)
    doc.text("Risk Probability Score: 78%", 20, 50)
    doc.text("Category: HIGH RISK", 20, 60)
    
    doc.setFontSize(12)
    doc.text("Key Findings:", 20, 80)
    doc.setFontSize(10)
    doc.text("• Variant detected in MYH7 gene (Exon 12)", 20, 90)
    doc.text("• Protein structure instability observed", 20, 100)
    doc.text("• Elevated CRP levels (4.8 mg/L)", 20, 110)
    
    doc.save("GenFlow_Analysis_Report.pdf")
  }

  const getBaseColor = (base: string) => {
    switch(base) {
      case 'A': return 'text-red-500'
      case 'C': return 'text-blue-500'
      case 'G': return 'text-green-500'
      case 'T': return 'text-amber-500'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <div className="relative min-h-screen">
      <DashboardBackground />
      
      {/* Progress bar */}
      {isRunning && (
        <div className="fixed top-0 left-0 w-full h-1 z-50">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      <div className="relative z-10 p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
            Genetic + Blood ML Analysis
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Комбинирует анализ ДНК и крови с использованием AI для выявления генетических рисков.
            Идентифицирует варианты, анализирует структуры белков и рассчитывает risk scores.
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
                <p className="font-medium mb-1">Загрузить генетические данные</p>
                <p className="text-sm text-muted-foreground mb-4">
                  FASTA, VCF, или CSV файлы (до 50 MB)
                </p>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".fasta,.vcf,.csv,.txt"
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
        <div className="flex items-center gap-4 animate-fade-up stagger-1">
          {isRunning && (
            <span className="px-4 py-2 bg-primary/10 text-primary text-sm font-medium rounded-xl flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Processing Batch #924
            </span>
          )}
          
          <div className="flex-1" />
          
          {currentStep === AnalysisStep.COMPLETE ? (
            <>
              <Button onClick={handleDownloadReport} className="gap-2">
                <Download className="w-4 h-4" />
                Скачать отчёт
              </Button>
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Новый анализ
              </Button>
            </>
          ) : (
            <Button onClick={runSimulation} disabled={isRunning} className="gap-2">
              <Play className="w-4 h-4" />
              {isRunning ? 'Анализ...' : 'Начать анализ'}
            </Button>
          )}
        </div>

        {/* Pipeline Steps */}
        <div className="animate-fade-up stagger-2">
          <h2 className="text-lg font-medium mb-4">Pipeline Workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isActive = currentStep === step.id
              const stepIndex = STEPS.findIndex(s => s.id === step.id)
              const currentIndex = STEPS.findIndex(s => s.id === currentStep)
              const isCompleted = currentStep === AnalysisStep.COMPLETE || (currentIndex > -1 && currentIndex > stepIndex)

              return (
                <div 
                  key={step.id}
                  className={`bg-background/60 backdrop-blur-sm p-4 rounded-2xl border transition-all ${
                    isActive ? 'border-primary shadow-lg ring-1 ring-primary/20' : 
                    isCompleted ? 'border-emerald-500/50' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-xl ${
                      isActive ? 'bg-primary/10 text-primary' : 
                      isCompleted ? 'bg-emerald-500/10 text-emerald-500' : 
                      'bg-muted text-muted-foreground'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className="text-xs text-muted-foreground">Step {index + 1}</span>
                  </div>
                  <h3 className="font-medium text-sm mb-1">{step.title}</h3>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-up stagger-3">
          {/* Visualizer */}
          <div className="lg:col-span-2 bg-background/60 backdrop-blur-sm rounded-2xl border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl ${isRunning ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                <Dna className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium">
                  {currentStep === AnalysisStep.IDLE ? 'Ready' : 
                   currentStep === AnalysisStep.COMPLETE ? 'Complete' :
                   STEPS.find(s => s.id === currentStep)?.title || 'Processing'}
                </h3>
                <p className="text-xs text-muted-foreground">Real-time Visualization</p>
              </div>
            </div>
            
            {/* DNA Sequence Visualization */}
            <div className="h-48 bg-muted/30 rounded-xl flex items-center justify-center overflow-hidden">
              {dnaSequence.length > 0 ? (
                <div className="font-mono text-2xl flex gap-1 flex-wrap justify-center p-4">
                  {dnaSequence.map((base, i) => (
                    <span 
                      key={i} 
                      className={`${getBaseColor(base)} transition-all duration-200`}
                      style={{ opacity: 0.3 + (i / dnaSequence.length) * 0.7 }}
                    >
                      {base}
                    </span>
                  ))}
                </div>
              ) : currentStep === AnalysisStep.COMPLETE ? (
                <div className="text-center">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">Анализ завершён</p>
                  <p className="text-muted-foreground">Risk Score: 78%</p>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Ожидание запуска анализа</p>
                </div>
              )}
            </div>
          </div>

          {/* Metrics */}
          <div className="space-y-4">
            <h3 className="font-medium">Biomarker Panel</h3>
            {SAMPLE_METRICS.map((metric, idx) => (
              <div 
                key={idx} 
                className="bg-background/60 backdrop-blur-sm p-4 rounded-2xl border flex justify-between items-center"
              >
                <div>
                  <span className="text-sm text-muted-foreground">{metric.label}</span>
                  <div className="text-xl font-semibold">
                    {isRunning ? (Math.random() > 0.5 ? metric.value : '...') : metric.value}
                    <span className="text-xs text-muted-foreground ml-1">{metric.unit}</span>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  metric.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                } ${isRunning ? 'animate-pulse' : ''}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

