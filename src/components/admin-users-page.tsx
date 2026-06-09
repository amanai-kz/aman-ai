"use client"

import { useMemo, useState } from "react"
import { Search, Users } from "lucide-react"
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
          <h2 className="text-2xl font-medium tracking-tight">Пользователи</h2>
          <p className="text-sm text-muted-foreground">
            Управление аккаунтами пациентов, врачей и администраторов
          </p>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по имени, email, роли..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Всего"
          value={initialUsers.length.toString()}
          description="аккаунтов"
        />
        <SummaryCard
          label="Врачей"
          value={initialUsers.filter((user) => user.role === "DOCTOR").length.toString()}
          description="в системе"
        />
        <SummaryCard
          label="Админов"
          value={initialUsers.filter((user) => user.role === "ADMIN").length.toString()}
          description="с доступом"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background/70 backdrop-blur-sm">
        {filteredUsers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead className="px-4">Пользователь</TableHead>
                <TableHead className="px-4">Роль</TableHead>
                <TableHead className="px-4">Детали</TableHead>
                <TableHead className="px-4">Создан</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="px-4 py-4 align-top">
                    <div className="space-y-1">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top">
                    <Badge variant="outline" className={roleBadgeClassName[user.role]}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                    {user.details}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                    {user.createdAt}
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
            <p className="font-medium">Пользователи не найдены</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Измените запрос или проверьте данные в базе.
            </p>
          </div>
        )}
      </div>
    </div>
  )
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
