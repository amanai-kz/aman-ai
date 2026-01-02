export function computeDurationSeconds(
  start?: string | number | Date | null,
  end?: string | number | Date | null,
  explicitSeconds?: number | null
): number | null {
  const parseDate = (value?: string | number | Date | null) => {
    if (value === null || value === undefined) return null
    const date = value instanceof Date ? value : new Date(value)
    return isNaN(date.getTime()) ? null : date
  }

  const startDate = parseDate(start)
  const endDate = parseDate(end)

  if (startDate && endDate) {
    const diffSeconds = Math.floor((endDate.getTime() - startDate.getTime()) / 1000)
    return Math.max(0, diffSeconds)
  }

  if (typeof explicitSeconds === "number") {
    return Math.max(0, Math.floor(explicitSeconds))
  }

  return null
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—"

  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(safeSeconds / 3600)
  const mins = Math.floor((safeSeconds % 3600) / 60)
  const secs = safeSeconds % 60

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return `${mins}:${secs.toString().padStart(2, "0")}`
}
