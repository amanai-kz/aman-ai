"use client"

import {
  Activity,
  Brain,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"

import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardBackground } from "@/components/dashboard-background"
import { useAppLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { getDoctorReviewsPageData } from "@/lib/doctor-reviews"

const typeIcons: Record<string, React.ElementType> = {
  CT_MRI: Brain,
  IOT: Activity,
  QUESTIONNAIRE: ClipboardList,
}

export function DoctorReviewsView() {
  const { locale } = useAppLocale()
  const copy = getDoctorReviewsPageData(locale)

  return (
    <>
      <DashboardHeader title={copy.pageTitle} />
      <div className="relative flex-1 overflow-auto pb-20 lg:pb-0">
        <DashboardBackground />

        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="mb-1 text-2xl font-medium tracking-tight">{copy.pendingHeading}</h2>
              <p className="text-sm text-muted-foreground">
                {copy.reviews.length} {copy.attentionSummary}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-red-500" /> {copy.priorityLegend.high}
              </span>
              <span className="flex items-center gap-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-yellow-500" /> {copy.priorityLegend.medium}
              </span>
              <span className="flex items-center gap-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" /> {copy.priorityLegend.low}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {copy.reviews.map((review, index) => {
              const Icon = typeIcons[review.type] || Activity

              return (
                <div
                  key={review.id}
                  className="overflow-hidden rounded-2xl border border-border bg-background/60 opacity-0 backdrop-blur-sm animate-fade-up"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: "forwards" }}
                >
                  <div className="border-b border-border p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            review.priority === "high"
                              ? "bg-red-500"
                              : review.priority === "medium"
                                ? "bg-yellow-500"
                                : "bg-green-500"
                          }`}
                        />
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-medium">{review.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {review.patient.name}, {review.patient.age} {copy.ageSuffix}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {review.date}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-secondary/30 p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{copy.aiConclusion}</span>
                          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                            {Math.round(review.aiConfidence * 100)}% {copy.confidence}
                          </span>
                        </div>
                        <p className="mb-3 font-medium">{review.aiResult}</p>
                        <div className="flex flex-wrap gap-2">
                          {review.findings.map((finding, i) => (
                            <span
                              key={i}
                              className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                            >
                              {finding}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Eye className="h-4 w-4" />
                      {copy.details}
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <MessageSquare className="h-4 w-4" />
                        {copy.comment}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-red-500 hover:border-red-200 hover:text-red-600"
                      >
                        <ThumbsDown className="h-4 w-4" />
                        {copy.reject}
                      </Button>
                      <Button size="sm" className="gap-2">
                        <ThumbsUp className="h-4 w-4" />
                        {copy.confirm}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {copy.reviews.length === 0 && (
            <div className="rounded-2xl border border-border bg-background/60 p-12 text-center backdrop-blur-sm">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h3 className="mb-2 font-medium">{copy.allReviewedTitle}</h3>
              <p className="text-sm text-muted-foreground">{copy.allReviewedDescription}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
