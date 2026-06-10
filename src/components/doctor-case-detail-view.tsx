"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, Search, ZoomIn, ZoomOut } from "lucide-react"

import {
  getDoctorCaseAiPresentation,
  type DoctorCaseDetail,
} from "@/lib/doctor-case-detail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppLocale } from "@/components/providers/locale-provider"
import { APP_DISPLAY_TIME_ZONE, getIntlLocale, type AppLocale } from "@/lib/app-locale"
import { getDoctorCopy } from "@/lib/doctor-copy"
import {
  getPriorityClassName,
  getPriorityLabel,
  getStatusLabel,
  getStudyTypeLabel,
} from "@/lib/doctor-worklist"
import { useIsHydrated } from "@/components/use-is-hydrated"

function formatCaseDate(value: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: APP_DISPLAY_TIME_ZONE,
  }).format(new Date(value))
}

export function DoctorCaseDetailView({ detail }: { detail: DoctorCaseDetail }) {
  const { locale } = useAppLocale()
  const copy = getDoctorCopy(locale)
  const aiPresentation = getDoctorCaseAiPresentation(detail, locale)
  const initialSequence = detail.viewer.sequences[0]?.id ?? "t1"
  const isHydrated = useIsHydrated()
  const [activeSequence, setActiveSequence] = useState(initialSequence)
  const [sliceValue, setSliceValue] = useState([detail.viewer.controls.slice.value])
  const [windowValue, setWindowValue] = useState([detail.viewer.controls.window])
  const [levelValue, setLevelValue] = useState([detail.viewer.controls.level])

  const activeSequenceLabel =
    activeSequence === "t2"
      ? copy.caseDetail.sequenceLabels.t2
      : activeSequence === "flair"
        ? copy.caseDetail.sequenceLabels.flair
        : activeSequence === "swi"
          ? copy.caseDetail.sequenceLabels.swi
          : copy.caseDetail.sequenceLabels.t1

  const studyMetadata = [
    { label: copy.caseDetail.metadata.accession, value: detail.viewer.metadata.accession },
    {
      label: copy.caseDetail.metadata.modality,
      value:
        detail.viewer.mode === "radiology"
          ? detail.viewer.metadata.modality
          : getStudyTypeLabel(detail.studyType, locale),
    },
    {
      label: copy.caseDetail.metadata.studyDate,
      value: isHydrated ? formatCaseDate(detail.viewer.metadata.studyDate, locale) : "",
    },
    { label: copy.caseDetail.metadata.series, value: String(detail.viewer.metadata.seriesCount) },
    { label: copy.caseDetail.metadata.slices, value: String(detail.viewer.metadata.sliceCount) },
    {
      label: copy.caseDetail.metadata.source,
      value: copy.caseDetail.metadata.sourceValues[detail.viewer.metadata.sourceKey],
    },
  ]

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div>
            <h2 className="text-2xl font-medium tracking-tight">
              {detail.patientName || copy.common.unknownPatient}
            </h2>
            <p className="text-sm text-muted-foreground">{detail.patientEmail}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={getPriorityClassName(detail.priority)}>
              {getPriorityLabel(detail.priority, locale)}
            </Badge>
            <Badge variant="secondary">{getStatusLabel(detail.status, locale)}</Badge>
            <Badge variant="outline" className="border-sky-200 bg-sky-500/10 text-sky-700">
              {getStudyTypeLabel(detail.studyType, locale)}
            </Badge>
          </div>
        </div>

        <Button variant="outline" asChild>
          <Link href="/doctor/worklist">{copy.caseDetail.backToWorklist}</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,1fr)]">
        <section aria-labelledby="study-viewer-title" className="space-y-6">
          <Card className="border-border bg-background/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle id="study-viewer-title">{copy.caseDetail.viewerTitle}</CardTitle>
              <CardDescription>{copy.caseDetail.viewerDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {detail.viewer.mode === "radiology" ? (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium">{copy.caseDetail.sequences}</h3>
                      <p className="text-xs text-muted-foreground">
                        {copy.caseDetail.sliceControl}: {sliceValue[0]} / {detail.viewer.controls.slice.max}
                      </p>
                    </div>

                    <Tabs value={activeSequence} onValueChange={(value) => setActiveSequence(value as typeof activeSequence)}>
                      <TabsList aria-label={copy.caseDetail.sequences} className="grid h-auto w-full grid-cols-4">
                        <TabsTrigger value="t1">{copy.caseDetail.sequenceLabels.t1}</TabsTrigger>
                        <TabsTrigger value="t2">{copy.caseDetail.sequenceLabels.t2}</TabsTrigger>
                        <TabsTrigger value="flair">{copy.caseDetail.sequenceLabels.flair}</TabsTrigger>
                        <TabsTrigger value="swi">{copy.caseDetail.sequenceLabels.swi}</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-950 text-slate-100">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.2),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.85),rgba(2,6,23,0.96))]" />
                    <div className="relative min-h-[26rem] p-6 sm:p-8">
                      <div className="flex items-start justify-between gap-4 text-xs uppercase tracking-[0.24em] text-slate-300/80">
                        <span>{activeSequenceLabel}</span>
                        <span>
                          {copy.caseDetail.sliceControl} {sliceValue[0]}
                        </span>
                      </div>

                      <div className="mt-10 flex items-center justify-center">
                        <div className="relative aspect-square w-full max-w-[27rem] overflow-hidden rounded-[2rem] border border-slate-700/70 bg-slate-900/70 shadow-2xl">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(248,250,252,0.95) 0%,rgba(203,213,225,0.18) 26%,rgba(15,23,42,0.08) 54%,rgba(2,6,23,0.94) 72%)]" />
                          <div className="absolute inset-x-[14%] top-[18%] h-[30%] rounded-[48%] border border-slate-300/20 bg-slate-200/10 blur-[1px]" />
                          <div className="absolute inset-x-[20%] top-[26%] h-[22%] rounded-[50%] border border-slate-100/20 bg-slate-50/10" />
                          <div className="absolute left-[22%] top-[54%] h-[16%] w-[22%] rounded-full border border-slate-300/15 bg-slate-200/10" />
                          <div className="absolute right-[22%] top-[54%] h-[16%] w-[22%] rounded-full border border-slate-300/15 bg-slate-200/10" />
                          <div className="absolute inset-x-[25%] bottom-[14%] h-[12%] rounded-[40%] border border-slate-200/10 bg-slate-300/10" />

                          <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_0,transparent_49.7%,rgba(148,163,184,0.35)_50%,transparent_50.3%,transparent_100%),linear-gradient(to_bottom,transparent_0,transparent_49.7%,rgba(148,163,184,0.35)_50%,transparent_50.3%,transparent_100%)]" />
                          <div className="absolute inset-4 rounded-[1.6rem] border border-slate-500/20" />

                          <div className="absolute bottom-4 left-4 rounded-full border border-slate-600/70 bg-slate-950/80 px-3 py-1 text-xs text-slate-200">
                            MRI / DICOM
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{copy.caseDetail.sliceControl}</span>
                        <span className="text-muted-foreground">{sliceValue[0]}</span>
                      </div>
                      <Slider
                        aria-label={copy.caseDetail.sliceControl}
                        min={detail.viewer.controls.slice.min}
                        max={detail.viewer.controls.slice.max}
                        step={detail.viewer.controls.slice.step}
                        value={sliceValue}
                        onValueChange={setSliceValue}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{copy.caseDetail.windowControl}</span>
                        <span className="text-muted-foreground">{windowValue[0]}</span>
                      </div>
                      <Slider
                        aria-label={copy.caseDetail.windowControl}
                        min={0}
                        max={100}
                        step={1}
                        value={windowValue}
                        onValueChange={setWindowValue}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{copy.caseDetail.levelControl}</span>
                        <span className="text-muted-foreground">{levelValue[0]}</span>
                      </div>
                      <Slider
                        aria-label={copy.caseDetail.levelControl}
                        min={0}
                        max={100}
                        step={1}
                        value={levelValue}
                        onValueChange={setLevelValue}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{copy.caseDetail.zoomControls}</span>
                    <Button type="button" variant="outline" size="sm" className="gap-2">
                      <ZoomOut className="h-4 w-4" />
                      {copy.caseDetail.zoomOut}
                    </Button>
                    <Button type="button" variant="outline" size="sm">
                      {copy.caseDetail.zoomReset}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="gap-2">
                      <ZoomIn className="h-4 w-4" />
                      {copy.caseDetail.zoomIn}
                    </Button>
                    <span className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">
                      {detail.viewer.controls.zoom}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/25 p-8">
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <div className="rounded-full border border-amber-200 bg-amber-500/10 p-3 text-amber-700">
                      <Search className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium">{copy.caseDetail.viewerUnavailable}</h3>
                      <p className="max-w-2xl text-sm text-muted-foreground">
                        {copy.caseDetail.viewerUnavailableHint}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-background/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{copy.caseDetail.metadataTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {studyMetadata.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-border bg-secondary/30 p-4">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                    <dd className="mt-2 text-sm font-medium break-words">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="ai-panel-title" className="space-y-6">
          <Card className="border-border bg-background/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle id="ai-panel-title">{copy.caseDetail.aiPanelTitle}</CardTitle>
              <CardDescription>{copy.caseDetail.aiSummary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {copy.caseDetail.aiGeneratedLabel}
                  </p>
                  <p className="mt-2 text-sm font-medium">{aiPresentation.generatedLabel}</p>
                </div>

                <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {copy.caseDetail.confidenceScore}
                  </p>
                  <span className="mt-2 block text-lg font-semibold">{detail.ai.confidenceScore}%</span>
                </div>

                <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {copy.caseDetail.priority}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className={getPriorityClassName(detail.ai.priority)}>
                      {getPriorityLabel(detail.ai.priority, locale)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium">{copy.caseDetail.draftFindings}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{aiPresentation.draftFindings}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium">{copy.caseDetail.draftImpression}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{aiPresentation.draftImpression}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium">{copy.caseDetail.structuredFindings}</h3>
                <div className="mt-3 space-y-3">
                  {aiPresentation.structuredFindings.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border bg-secondary/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                      <p className="mt-2 text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium">{copy.caseDetail.evidenceList}</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {aiPresentation.evidence.map((item) => (
                    <li key={item} className="rounded-2xl border border-border bg-secondary/20 px-4 py-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-500/10 p-4 text-amber-950">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-semibold">{copy.caseDetail.aiWarningTitle}</h3>
                    <p className="mt-1 text-sm text-amber-900/80">{copy.caseDetail.doctorReviewWarning}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="button" variant="outline">
                  {copy.caseDetail.actionButtons.editReport}
                </Button>
                <Button type="button" variant="secondary">
                  {copy.caseDetail.actionButtons.approve}
                </Button>
                <Button type="button">
                  {copy.caseDetail.actionButtons.signOff}
                </Button>
              </div>

              <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{copy.caseDetail.updated}</p>
                <time dateTime={detail.updatedAt} className="mt-2 block text-sm" suppressHydrationWarning>
                  {isHydrated ? formatCaseDate(detail.updatedAt, locale) : ""}
                </time>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
