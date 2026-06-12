export type JobStatus = "queued" | "running" | "completed" | "failed"

export type JobDefinition<TPayload> = {
  id: string
  type: string
  payload: TPayload
}

export type JobRecord<TPayload = unknown, TResult = unknown> = {
  id: string
  type: string
  payload: TPayload
  status: JobStatus
  result: TResult | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export class InMemoryJobQueue {
  private readonly jobs = new Map<string, JobRecord>()

  enqueue<TPayload>(definition: JobDefinition<TPayload>): JobRecord<TPayload, null> {
    const existing = this.get<TPayload, null>(definition.id)
    if (existing) {
      return existing
    }

    const now = new Date().toISOString()
    const record: JobRecord<TPayload, null> = {
      id: definition.id,
      type: definition.type,
      payload: definition.payload,
      status: "queued",
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    }

    this.jobs.set(definition.id, record)
    return record
  }

  get<TPayload = unknown, TResult = unknown>(id: string): JobRecord<TPayload, TResult> | null {
    const record = this.jobs.get(id)
    return (record as JobRecord<TPayload, TResult> | undefined) ?? null
  }

  async run<TPayload, TResult>(
    id: string,
    handler: (job: JobRecord<TPayload, TResult | null>) => Promise<TResult>
  ): Promise<JobRecord<TPayload, TResult>> {
    const existing = this.get<TPayload, TResult | null>(id)
    if (!existing) {
      throw new Error(`Job ${id} not found`)
    }

    if (existing.status === "completed" && existing.result !== null) {
      return existing as JobRecord<TPayload, TResult>
    }

    const running: JobRecord<TPayload, TResult | null> = {
      ...existing,
      status: "running",
      updatedAt: new Date().toISOString(),
    }
    this.jobs.set(id, running)

    try {
      const result = await handler(running)
      const completed: JobRecord<TPayload, TResult> = {
        ...running,
        status: "completed",
        result,
        error: null,
        updatedAt: new Date().toISOString(),
      }
      this.jobs.set(id, completed)
      return completed
    } catch (error) {
      const failed: JobRecord<TPayload, TResult | null> = {
        ...running,
        status: "failed",
        error: error instanceof Error ? error.message : "Unexpected job error",
        updatedAt: new Date().toISOString(),
      }
      this.jobs.set(id, failed)
      throw error
    }
  }
}

export function createInMemoryJobQueue() {
  return new InMemoryJobQueue()
}
