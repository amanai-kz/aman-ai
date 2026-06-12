"use client"

import { useMemo, useState } from "react"
import { Search, Users } from "lucide-react"
import { useAppLocale } from "@/components/providers/locale-provider"
import { getAppCopy } from "@/lib/app-copy"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface AdminUserRow {
  id: string
  name: string
  email: string
  role: "PATIENT" | "DOCTOR" | "ADMIN"
  createdAt: string
  details: string
}

const roleBadgeClassName: Record<AdminUserRow["role"], string> = {
  PATIENT: "bg-secondary text-secondary-foreground",
  DOCTOR: "bg-blue-500/10 text-blue-700 border-blue-200",
  ADMIN: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
}

export function AdminUsersPage({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale).adminUsers
  const [query, setQuery] = useState("")

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return initialUsers
    }

    return initialUsers.filter((user) =>
      [user.name, user.email, user.role, user.details].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      )
    )
  }, [initialUsers, query])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">{copy.heading}</h2>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label={copy.summary.total.label}
          value={initialUsers.length.toString()}
          description={copy.summary.total.description}
        />
        <SummaryCard
          label={copy.summary.doctors.label}
          value={initialUsers.filter((user) => user.role === "DOCTOR").length.toString()}
          description={copy.summary.doctors.description}
        />
        <SummaryCard
          label={copy.summary.admins.label}
          value={initialUsers.filter((user) => user.role === "ADMIN").length.toString()}
          description={copy.summary.admins.description}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background/70 backdrop-blur-sm">
        {filteredUsers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead className="px-4">{copy.tableHeaders.user}</TableHead>
                <TableHead className="px-4">{copy.tableHeaders.role}</TableHead>
                <TableHead className="px-4">{copy.tableHeaders.details}</TableHead>
                <TableHead className="px-4">{copy.tableHeaders.created}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="px-4 py-4 align-top">
                    <div className="space-y-1">
                      <p className="font-medium">{user.name || copy.defaultRows.unnamed}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top">
                    <Badge variant="outline" className={roleBadgeClassName[user.role]}>
                      {copy.roleLabels[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                    {user.details || fallbackDetailsForRole(user.role, copy)}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : locale === "en" ? "en-US" : "ru-RU", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(user.createdAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-4 rounded-2xl bg-secondary p-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">{copy.empty.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{copy.empty.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function fallbackDetailsForRole(
  role: AdminUserRow["role"],
  copy: ReturnType<typeof getAppCopy>["adminUsers"]
) {
  if (role === "DOCTOR") return copy.defaultRows.doctorProfileMissing
  if (role === "PATIENT") return copy.defaultRows.patientProfileMissing
  return copy.defaultRows.systemAccess
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-5 backdrop-blur-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
