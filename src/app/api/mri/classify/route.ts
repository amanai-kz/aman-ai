import {
  NextRequest,
  NextResponse,
} from "next/server"

import { auth } from "@/lib/auth"
import { assertPatientAccess } from "@/lib/authz"
import { createBackendAccessToken } from "@/lib/backend-auth"
import { toErrorResponse } from "@/lib/privileged-api"


const BACKEND_URL =
  process.env.ML_BACKEND_URL ??
  "http://localhost:8000"

const MAX_BYTES =
  10 * 1024 * 1024


export async function POST(
  req: NextRequest
) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const form = await req.formData()

  const file = form.get("file")
  const patientId = form.get("patientId")

  if (
    !(file instanceof File) ||
    typeof patientId !== "string" ||
    !patientId
  ) {
    return NextResponse.json(
      {
        error:
          "file and patientId are required",
      },
      { status: 400 }
    )
  }

  try {
    await assertPatientAccess(
      session,
      patientId
    )
  } catch (error) {
    const { status, body } =
      toErrorResponse(error)

    return NextResponse.json(
      body,
      { status }
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error:
          "MRI image exceeds the upload limit",
      },
      { status: 413 }
    )
  }

  try {
    const upstream =
      new FormData()

    const bytes =
      await file.arrayBuffer()

    upstream.append(
      "file",
      new Blob(
        [bytes],
        { type: file.type }
      ),
      file.name
    )

    const token =
      createBackendAccessToken(
        session.user.id
      )

    const endpoint =
      new URL(
        "/api/v1/services/ct-mri/classify",
        BACKEND_URL
      )

    endpoint.searchParams.set(
      "patient_id",
      patientId
    )

    const response =
      await fetch(
        endpoint,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
          body: upstream,
        }
      )

    const data =
      await response
        .json()
        .catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.detail ??
            "MRI classification service failed",
        },
        {
          status:
            response.status,
        }
      )
    }

    return NextResponse.json(
      data,
      { status: 200 }
    )

  } catch {
    return NextResponse.json(
      {
        error:
          "MRI classification service is unavailable",
      },
      { status: 502 }
    )
  }
}
