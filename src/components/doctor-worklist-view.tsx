"use client"

import Link from "next/link"
import { ClipboardCheck, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAppLocale } from "@/components/providers/locale-provider"
import { APP_DISPLAY_TIME_ZONE, getIntlLocale } from "@/lib/app-locale"
import { getDoctorCopy } from "@/lib/doctor-copy"
import {
  getPriorityClassName,
  getPriorityLabel,
  getStatusLabel,
  getStudyTypeLabel,
  type DoctorWorklistCase,
} from "@/lib/doctor-worklist"

export function DoctorWorklistView({
  cases,
  source,
}: {
  cases: DoctorWorklistCase[]
  source: "db" | "mock"
}) {
  const { locale } = useAppLocale()
  const copy = getDoctorCopy(locale)

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">{copy.worklist.pageTitle}</h2>
          <p className="text-sm text-muted-foreground">{copy.worklist.subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
            {cases.length} {copy.worklist.casesLabel}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/doctor/reviews">{copy.worklist.reviewQueue}</Link>
          </Button>
        </div>
      </div>

      {source === "mock" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          {copy.worklist.fallbackBanner}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-background/60 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/40">
              <TableHead className="px-4">{copy.worklist.patient}</TableHead>
              <TableHead className="px-4">{copy.worklist.studyType}</TableHead>
              <TableHead className="px-4">{copy.worklist.priority}</TableHead>
              <TableHead className="px-4">{copy.worklist.status}</TableHead>
              <TableHead className="px-4">{copy.worklist.aiSummary}</TableHead>
              <TableHead className="px-4">{copy.worklist.updated}</TableHead>
              <TableHead className="px-4 text-right">{copy.worklist.open}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="px-4 py-4 font-medium">{item.patientName || copy.common.unknownPatient}</TableCell>
                <TableCell className="px-4 py-4 text-muted-foreground">
                  {getStudyTypeLabel(item.studyType, locale)}
                </TableCell>
                <TableCell className="px-4 py-4">
                  <Badge variant="outline" className={getPriorityClassName(item.priority)}>
                    {getPriorityLabel(item.priority, locale)}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-4">
                  <Badge variant="secondary">{getStatusLabel(item.status, locale)}</Badge>
                </TableCell>
                <TableCell className="max-w-[320px] px-4 py-4 text-sm text-muted-foreground whitespace-normal">
                  {item.aiSummary || copy.worklist.noSummary}
                </TableCell>
                <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                  {new Intl.DateTimeFormat(getIntlLocale(locale), {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: APP_DISPLAY_TIME_ZONE,
                  }).format(new Date(item.updatedAt))}
                </TableCell>
                <TableCell className="px-4 py-4 text-right">
                  <Button size="sm" className="gap-2" asChild>
                    <Link href={`/doctor/cases/${item.id}`}>
                      <ExternalLink className="h-4 w-4" />
                      {copy.worklist.open}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {cases.length === 0 && (
        <div className="rounded-2xl border border-border bg-background/60 p-12 text-center backdrop-blur-sm">
          <ClipboardCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="font-medium">{copy.worklist.emptyTitle}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{copy.worklist.emptyDescription}</p>
        </div>
      )}
    </div>
  )
}
