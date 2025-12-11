"use client"

import { useState } from "react"
import { DashboardBackground } from "@/components/dashboard-background"
import { Button } from "@/components/ui/button"
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Download,
  RefreshCw,
  Brain,
  AlertTriangle,
  ThumbsUp,
  TrendingDown
} from "lucide-react"
import { cn } from "@/lib/utils"

const PSS_QUESTIONS = [
  "За последний месяц, как часто вы расстраивались из-за неожиданных событий?",
  "За последний месяц, как часто вам казалось, что вы не можете контролировать важные вещи в жизни?",
  "За последний месяц, как часто вы чувствовали нервозность и стресс?",
  "За последний месяц, как часто вы успешно справлялись с раздражающими жизненными проблемами?",
  "За последний месяц, как часто вы чувствовали, что эффективно справляетесь с важными изменениями?",
  "За последний месяц, как часто вы были уверены в своей способности справляться с личными проблемами?",
  "За последний месяц, как часто вы чувствовали, что всё идёт по вашему плану?",
  "За последний месяц, как часто вы обнаруживали, что не можете справиться со всеми делами?",
  "За последний месяц, как часто вам удавалось контролировать раздражение?",
  "За последний месяц, как часто вы чувствовали, что справляетесь со всем?"
]

const OPTIONS = [
  { value: 0, label: "Никогда" },
  { value: 1, label: "Почти никогда" },
  { value: 2, label: "Иногда" },
  { value: 3, label: "Довольно часто" },
  { value: 4, label: "Очень часто" },
]

// Questions 4, 5, 6, 7, 9, 10 are reverse scored
const REVERSE_SCORED = [3, 4, 5, 6, 8, 9] // 0-indexed

function getStressLevel(score: number) {
  if (score <= 13) return { level: "low", label: "Низкий", color: "text-emerald-500", bgColor: "bg-emerald-500", icon: ThumbsUp }
  if (score <= 26) return { level: "moderate", label: "Умеренный", color: "text-amber-500", bgColor: "bg-amber-500", icon: TrendingDown }
  return { level: "high", label: "Высокий", color: "text-red-500", bgColor: "bg-red-500", icon: AlertTriangle }
}

export default function QuestionnairePage() {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(PSS_QUESTIONS.length).fill(null))
  const [isComplete, setIsComplete] = useState(false)

  const handleAnswer = (value: number) => {
    const newAnswers = [...answers]
    newAnswers[currentQuestion] = value
    setAnswers(newAnswers)
  }

  const handleNext = () => {
    if (currentQuestion < PSS_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      setIsComplete(true)
    }
  }

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleReset = () => {
    setCurrentQuestion(0)
    setAnswers(new Array(PSS_QUESTIONS.length).fill(null))
    setIsComplete(false)
  }

  const calculateScore = () => {
    let total = 0
    answers.forEach((answer, index) => {
      if (answer !== null) {
        if (REVERSE_SCORED.includes(index)) {
          total += (4 - answer)
        } else {
          total += answer
        }
      }
    })
    return total
  }

  const score = calculateScore()
  const stressInfo = getStressLevel(score)
  const progress = ((currentQuestion + 1) / PSS_QUESTIONS.length) * 100

  if (isComplete) {
    const StressIcon = stressInfo.icon
    return (
      <div className="relative min-h-screen">
        <DashboardBackground />
        <div className="relative z-10 p-6 md:p-8 flex items-center justify-center min-h-[80vh]">
          <div className="max-w-lg w-full bg-background/80 backdrop-blur-sm border rounded-3xl p-8 text-center animate-fade-up">
            <div className={cn("w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center", stressInfo.bgColor + "/20")}>
              <StressIcon className={cn("w-10 h-10", stressInfo.color)} />
            </div>
            
            <h2 className="text-2xl font-semibold mb-2">Опросник завершён!</h2>
            <p className="text-muted-foreground mb-6">Ваш уровень стресса по шкале PSS-10</p>
            
            <div className="mb-8">
              <div className={cn("text-6xl font-bold mb-2", stressInfo.color)}>{score}</div>
              <div className="text-sm text-muted-foreground">из 40 баллов</div>
              <div className={cn("inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-medium", stressInfo.bgColor + "/20", stressInfo.color)}>
                {stressInfo.label} уровень стресса
              </div>
            </div>

            <div className="bg-muted/50 rounded-2xl p-4 mb-6 text-left">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Рекомендации AI
              </h3>
              <p className="text-sm text-muted-foreground">
                {stressInfo.level === "low" && "Отличный результат! Продолжайте поддерживать здоровый баланс. Рекомендуем регулярные проверки раз в месяц."}
                {stressInfo.level === "moderate" && "Умеренный уровень стресса. Рекомендуем техники релаксации, достаточный сон и физическую активность. Повторите опросник через 2 недели."}
                {stressInfo.level === "high" && "Высокий уровень стресса требует внимания. Рекомендуем консультацию специалиста, медитацию и снижение нагрузки. Обратитесь к врачу."}
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <Button onClick={handleReset} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Пройти заново
              </Button>
              <Button className="gap-2">
                <Download className="w-4 h-4" />
                Скачать отчёт
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <DashboardBackground />
      
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="relative z-10 p-6 md:p-8">
        {/* Header */}
        <div className="max-w-2xl mx-auto mb-8 animate-fade-up">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">
            Шкала воспринимаемого стресса (PSS-10)
          </h1>
          <p className="text-muted-foreground">
            Ответьте на 10 вопросов о вашем состоянии за последний месяц
          </p>
        </div>

        {/* Question Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-background/80 backdrop-blur-sm border rounded-3xl p-6 md:p-8 animate-fade-up">
            {/* Question counter */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-muted-foreground">
                Вопрос {currentQuestion + 1} из {PSS_QUESTIONS.length}
              </span>
              <span className="text-sm font-medium">
                {Math.round(progress)}%
              </span>
            </div>

            {/* Question */}
            <h2 className="text-xl md:text-2xl font-medium mb-8">
              {PSS_QUESTIONS[currentQuestion]}
            </h2>

            {/* Options */}
            <div className="space-y-3 mb-8">
              {OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(option.value)}
                  className={cn(
                    "w-full p-4 rounded-2xl border text-left transition-all",
                    answers[currentQuestion] === option.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border hover:border-primary/50 hover:bg-secondary/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      answers[currentQuestion] === option.value
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    )}>
                      {answers[currentQuestion] === option.value && (
                        <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="font-medium">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={handlePrev}
                disabled={currentQuestion === 0}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </Button>
              
              <Button
                onClick={handleNext}
                disabled={answers[currentQuestion] === null}
                className="gap-2"
              >
                {currentQuestion === PSS_QUESTIONS.length - 1 ? "Завершить" : "Далее"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

