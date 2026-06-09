"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAppLocale } from "@/components/providers/locale-provider"
import { APP_DISPLAY_TIME_ZONE, getIntlLocale } from "@/lib/app-locale"
import { getDoctorCopy } from "@/lib/doctor-copy"
import {
  getPriorityClassName,
  getPriorityLabel,
  getStatusLabel,
  getStudyTypeLabel,
} from "@/lib/doctor-worklist"

export interface DoctorCaseDetail {
  id: string
  patientName: string
  patientEmail: string
  studyType: string
  priority: "CRITICAL" | "HIGH" | "NORMAL"
  status: string
  aiSummary: string
  updatedAt: string
}

export function DoctorCaseDetailView({ detail }: { detail: DoctorCaseDetail }) {
  const { locale } = useAppLocale()
  const copy = getDoctorCopy(locale)

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">{detail.patientName || copy.common.unknownPatient}</h2>
          <p className="text-sm text-muted-foreground">{detail.patientEmail}</p>
        </div>

        <Button variant="outline" asChild>
          <Link href="/doctor/worklist">{copy.caseDetail.backToWorklist}</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">{copy.caseDetail.studyType}</p>
          <p className="mt-2 font-medium">{getStudyTypeLabel(detail.studyType, locale)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">{copy.caseDetail.priority}</p>
          <div className="mt-2">
            <Badge variant="outline" className={getPriorityClassName(detail.priority)}>
              {getPriorityLabel(detail.priority, locale)}
            </Badge>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">{copy.caseDetail.status}</p>
          <div className="mt-2">
            <Badge variant="secondary">{getStatusLabel(detail.status, locale)}</Badge>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
        <h3 className="font-medium">{copy.caseDetail.aiSummary}</h3>
        <p className="mt-3 text-sm text-muted-foreground">{detail.aiSummary || copy.worklist.noSummary}</p>
      </div>

      <div className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
        <h3 className="font-medium">{copy.caseDetail.updated}</h3>
        <p className="mt-3 text-sm text-muted-foreground">
          {new Intl.DateTimeFormat(getIntlLocale(locale), {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: APP_DISPLAY_TIME_ZONE,
          }).format(new Date(detail.updatedAt))}
        </p>
      </div>
    </div>
  )
}
