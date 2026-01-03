"use client"

import { useState, useCallback, useEffect } from "react"

export interface EncounterState {
  step?: string
  transcript?: string
  recordingTime?: number
  audioChunks?: string[] // base64 encoded chunks
  speakerLabels?: Record<string, string>
  [key: string]: unknown
}

export interface Encounter {
  id: string
  user_id: string
  status: "active" | "paused" | "completed"
  state: EncounterState | null
  created_at: string
  updated_at: string
  paused_at: string | null
  resumed_at: string | null
  last_activity_at: string
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ""

export function useEncounter(userId: string | null) {
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null)
  const [pausedEncounters, setPausedEncounters] = useState<Encounter[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch paused encounters on mount
  const fetchPausedEncounters = useCallback(async () => {
    if (!userId) return
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/encounters?status=paused`, {
        headers: { "X-User-Id": userId }
      })
      
      if (response.ok) {
        const data = await response.json()
        setPausedEncounters(data)
      }
    } catch (err) {
      console.error("Failed to fetch paused encounters:", err)
    }
  }, [userId])

  useEffect(() => {
    fetchPausedEncounters()
  }, [fetchPausedEncounters])

  // Start a new encounter
  const startEncounter = useCallback(async (initialState?: EncounterState) => {
    if (!userId) {
      setError("User ID required")
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/encounters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId
        },
        body: JSON.stringify({ state: initialState || {} })
      })

      if (!response.ok) {
        throw new Error("Failed to start encounter")
      }

      const encounter = await response.json()
      setCurrentEncounter(encounter)
      return encounter
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start encounter"
      setError(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Pause current encounter
  const pauseEncounter = useCallback(async (state: EncounterState) => {
    if (!userId || !currentEncounter) {
      setError("No active encounter to pause")
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/v1/encounters/${currentEncounter.id}/pause`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": userId
          },
          body: JSON.stringify({ state })
        }
      )

      if (!response.ok) {
        throw new Error("Failed to pause encounter")
      }

      const encounter = await response.json()
      setCurrentEncounter(null)
      await fetchPausedEncounters()
      return encounter
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to pause encounter"
      setError(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [userId, currentEncounter, fetchPausedEncounters])

  // Resume a paused encounter
  const resumeEncounter = useCallback(async (encounterId: string) => {
    if (!userId) {
      setError("User ID required")
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/v1/encounters/${encounterId}/resume`,
        {
          method: "POST",
          headers: { "X-User-Id": userId }
        }
      )

      if (!response.ok) {
        throw new Error("Failed to resume encounter")
      }

      const encounter = await response.json()
      setCurrentEncounter(encounter)
      setPausedEncounters(prev => prev.filter(e => e.id !== encounterId))
      return encounter
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resume encounter"
      setError(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Complete current encounter
  const completeEncounter = useCallback(async () => {
    if (!userId || !currentEncounter) {
      setError("No active encounter to complete")
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/v1/encounters/${currentEncounter.id}/complete`,
        {
          method: "POST",
          headers: { "X-User-Id": userId }
        }
      )

      if (!response.ok) {
        throw new Error("Failed to complete encounter")
      }

      const encounter = await response.json()
      setCurrentEncounter(null)
      return encounter
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete encounter"
      setError(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [userId, currentEncounter])

  // Get active or paused encounter
  const getActiveEncounter = useCallback(async () => {
    if (!userId) return null

    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/encounters/active`, {
        headers: { "X-User-Id": userId }
      })

      if (response.ok) {
        const encounter = await response.json()
        setCurrentEncounter(encounter)
        return encounter
      }
      return null
    } catch {
      return null
    }
  }, [userId])

  return {
    currentEncounter,
    pausedEncounters,
    isLoading,
    error,
    startEncounter,
    pauseEncounter,
    resumeEncounter,
    completeEncounter,
    getActiveEncounter,
    fetchPausedEncounters
  }
}

