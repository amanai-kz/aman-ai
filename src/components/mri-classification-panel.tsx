"use client"

import {
  AlertCircle,
  Brain,
  Loader2,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react"
import {
  useRef,
  useState,
} from "react"

import {
  Button,
} from "@/components/ui/button"


type Result = {
  predicted_class: string
  scores: Record<string, number>
  score_type: string
  processing_time_ms: number
  assistive_note: string
  score_note: string
}


export function MriClassificationPanel({
  patientId,
}: {
  patientId: string | null
}) {
  const inputRef =
    useRef<HTMLInputElement>(null)

  const [file, setFile] =
    useState<File | null>(null)

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [result, setResult] =
    useState<Result | null>(null)

  const reset = () => {
    setFile(null)
    setResult(null)
    setError(null)

    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  async function classify() {
    if (!file || !patientId) {
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const form =
        new FormData()

      form.append(
        "file",
        file,
        file.name
      )

      form.append(
        "patientId",
        patientId
      )

      const response =
        await fetch(
          "/api/mri/classify",
          {
            method: "POST",
            body: form,
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ??
          "MRI classification failed"
        )
      }

      setResult(
        data as Result
      )

    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "MRI classification failed"
      )

    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="
        max-w-4xl mx-auto
        px-6 py-10
        space-y-8
      "
    >
      <div>
        <div
          className="
            flex items-center
            gap-2
            text-xs uppercase
            tracking-widest
            text-muted-foreground
          "
        >
          <Brain className="w-4 h-4" />
          MRI Classification
        </div>

        <h1
          className="
            mt-2 text-3xl
            font-semibold
          "
        >
          MRI Classification
        </h1>

        <p
          className="
            mt-2 max-w-2xl
            text-muted-foreground
          "
        >
          Upload one PNG, JPEG or TIFF MRI image.
          The configured four-class model provides
          assistive research output only.
          It is not a diagnosis.
        </p>
      </div>

      {!patientId && (
        <div
          className="
            flex gap-3
            rounded-xl
            border border-amber-200
            bg-amber-50
            p-4 text-sm
            text-amber-800
          "
        >
          <AlertCircle className="w-5 h-5" />
          No authorized patient is available.
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          inputRef.current?.click()
        }
        className="
          w-full rounded-2xl
          border-2 border-dashed
          p-10 text-center
          transition-colors
          hover:border-foreground/40
        "
      >
        <UploadCloud
          className="
            w-10 h-10 mx-auto
            text-muted-foreground
          "
        />

        <div className="mt-3 font-medium">
          {file
            ? file.name
            : "Choose MRI image"}
        </div>

        <div
          className="
            mt-1 text-sm
            text-muted-foreground
          "
        >
          PNG / JPEG / TIFF · maximum 10 MB
        </div>
      </button>

      <input
        ref={inputRef}
        hidden
        type="file"
        accept=".png,.jpg,.jpeg,.tif,.tiff,image/png,image/jpeg,image/tiff"
        onChange={(event) => {
          const next =
            event.target.files?.[0]

          if (!next) return

          setFile(next)
          setError(null)
          setResult(null)
        }}
      />

      <div
        className="
          flex items-center gap-3
        "
      >
        <Button
          size="lg"
          disabled={
            !file ||
            !patientId ||
            loading
          }
          onClick={classify}
        >
          {loading ? (
            <>
              <Loader2
                className="
                  w-4 h-4
                  animate-spin
                "
              />
              Classifying…
            </>
          ) : (
            <>
              <Brain className="w-4 h-4" />
              Run classification
            </>
          )}
        </Button>

        {(file || result) && (
          <Button
            variant="ghost"
            disabled={loading}
            onClick={reset}
          >
            <X className="w-4 h-4" />
            Reset
          </Button>
        )}
      </div>

      {error && (
        <div
          className="
            rounded-xl
            border border-red-200
            bg-red-50
            p-4
            text-red-700
          "
        >
          {error}
        </div>
      )}

      {result && (
        <div
          className="
            rounded-2xl
            border bg-card
            p-6 space-y-6
          "
        >
          <div>
            <div
              className="
                text-sm
                text-muted-foreground
              "
            >
              Highest model output
            </div>

            <div
              className="
                mt-1 text-2xl
                font-semibold
              "
            >
              {result.predicted_class}
            </div>
          </div>

          <div className="space-y-2">
            <div
              className="
                text-sm font-medium
                text-muted-foreground
              "
            >
              Model outputs
            </div>

            {Object.entries(
              result.scores
            ).map(
              ([name, score]) => (
                <div
                  key={name}
                  className="
                    flex justify-between
                    rounded-lg
                    border
                    px-4 py-3
                  "
                >
                  <span>{name}</span>

                  <span
                    className="
                      font-mono
                      tabular-nums
                    "
                  >
                    {score.toFixed(6)}
                  </span>
                </div>
              )
            )}

            <p
              className="
                text-xs
                text-muted-foreground
              "
            >
              {result.score_note}
            </p>
          </div>

          <div
            className="
              text-sm
              text-muted-foreground
            "
          >
            Inference time:{" "}
            {result.processing_time_ms} ms
          </div>

          <div
            className="
              flex gap-3
              rounded-xl
              border
              bg-muted/40
              p-4
              text-sm
            "
          >
            <ShieldCheck className="w-5 h-5" />

            <div>
              {result.assistive_note}

              <div
                className="
                  mt-1
                  text-muted-foreground
                "
              >
                Clinical validity has not been
                established by this integration.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
