"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAppLocale } from "@/components/providers/locale-provider"
import { getDoctorCopy } from "@/lib/doctor-copy"

export interface DoctorPatientDetail {
  id: string
  name: string
  email: string
  phone: string
  analysesCount: number
  source: "db" | "mock"
  noteKey?: "localMock" | "assignments" | "history" | "safePlaceholder"
}

export function DoctorPatientDetailView({ patient }: { patient: DoctorPatientDetail }) {
  const { locale } = useAppLocale()
  const copy = getDoctorCopy(locale)

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">{patient.name || copy.common.unknownPatient}</h2>
          <p className="text-sm text-muted-foreground">{patient.email}</p>
        </div>

        <Button variant="outline" asChild>
          <Link href="/doctor/patients">{copy.patientDetail.backToPatients}</Link>
        </Button>
      </div>

      {patient.source === "mock" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
          {copy.patientDetail.mockBanner}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">{copy.patientDetail.phone}</p>
          <p className="mt-2 font-medium">{patient.phone}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">{copy.patientDetail.analyses}</p>
          <p className="mt-2 font-medium">{patient.analysesCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">{copy.patientDetail.source}</p>
          <div className="mt-2">
            <Badge variant="secondary">
              {patient.source === "db" ? copy.patientDetail.sourcePrisma : copy.patientDetail.sourceMock}
            </Badge>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-background/60 p-6 backdrop-blur-sm">
        <h3 className="font-medium">{copy.patientDetail.notes}</h3>
        <p className="mt-3 text-sm text-muted-foreground">
          {patient.source === "db"
            ? copy.patientDetail.dbNote
            : copy.patientDetail.mockNotes[patient.noteKey || "safePlaceholder"]}
        </p>
      </div>
    </div>
  )
}
