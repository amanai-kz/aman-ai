import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test from "node:test"

import {
  createFileSiteConfigStore,
  getSiteConfigResponse,
  updateSiteConfigResponse,
} from "../src/lib/site-config"
import { resolveDeploymentConfig } from "../src/lib/deployment-config"
import { createInMemoryJobQueue } from "../src/lib/job-queue"

const adminSession = {
  user: {
    id: "admin-1",
    role: "ADMIN",
    name: "Admin User",
  },
} as const

const doctorSession = {
  user: {
    id: "doctor-1",
    role: "DOCTOR",
    name: "Dr. Test",
  },
} as const

const patientSession = {
  user: {
    id: "patient-1",
    role: "PATIENT",
    name: "Patient User",
  },
} as const

function getSuccessData<T>(response: { status: number; body: { data?: T; error?: string } }): T {
  if (!("data" in response.body)) {
    assert.fail(`expected success response, got ${response.status} ${response.body.error ?? "error"}`)
  }

  return response.body.data as T
}

test("site config update succeeds for admins and persists safe endpoint fields", async () => {
  const root = await mkdtemp(join(tmpdir(), "aman-site-config-"))
  const store = createFileSiteConfigStore({
    filePath: join(root, "site-config.json"),
    env: {
      SITE_NAME: "Aman AI",
      DICOM_ENDPOINT: "https://dicom.example",
      FHIR_ENDPOINT: "https://fhir.example",
      INFERENCE_ENDPOINT: "https://inference.example",
      OIDC_ISSUER: "https://issuer.example",
      OIDC_CLIENT_ID: "aman-web",
      OIDC_REDIRECT_URI: "https://app.example/api/auth/callback/oidc",
    },
  })

  const response = await updateSiteConfigResponse(store, adminSession, {
    siteName: "Aman Radiology",
    dicomEndpoint: "https://dicom.internal",
    fhirEndpoint: "https://fhir.internal",
    inferenceEndpoint: "https://inference.internal",
    oidcIssuer: "https://issuer.internal",
    oidcClientId: "aman-clinic",
    oidcRedirectUri: "https://clinic.example/api/auth/callback/oidc",
  })

  assert.equal(response.status, 200)
  const data = getSuccessData(response)
  assert.equal(data.config.siteName, "Aman Radiology")
  assert.equal(data.config.oidcClientId, "aman-clinic")

  const saved = JSON.parse(await readFile(join(root, "site-config.json"), "utf8")) as Record<string, string>
  assert.equal(saved.siteName, "Aman Radiology")
  assert.ok(!("oidcClientSecret" in saved))
})

test("site config reads persisted values for admins", async () => {
  const root = await mkdtemp(join(tmpdir(), "aman-site-config-"))
  const store = createFileSiteConfigStore({
    filePath: join(root, "site-config.json"),
    env: {
      SITE_NAME: "Aman AI",
      DICOM_ENDPOINT: "https://dicom.example",
      FHIR_ENDPOINT: "https://fhir.example",
      INFERENCE_ENDPOINT: "https://inference.example",
      OIDC_ISSUER: "https://issuer.example",
      OIDC_CLIENT_ID: "aman-web",
      OIDC_REDIRECT_URI: "https://app.example/api/auth/callback/oidc",
    },
  })

  await updateSiteConfigResponse(store, adminSession, {
    siteName: "Aman Admin",
    dicomEndpoint: "https://dicom.override",
    fhirEndpoint: "https://fhir.override",
    inferenceEndpoint: "https://inference.override",
    oidcIssuer: "https://issuer.override",
    oidcClientId: "aman-admin",
    oidcRedirectUri: "https://admin.example/api/auth/callback/oidc",
  })

  const response = await getSiteConfigResponse(store, adminSession)

  assert.equal(response.status, 200)
  const data = getSuccessData(response)
  assert.equal(data.config.siteName, "Aman Admin")
  assert.equal(data.config.dicomEndpoint, "https://dicom.override")
})

test("site config returns 401 for unauthenticated requests", async () => {
  const store = createFileSiteConfigStore({
    filePath: join(tmpdir(), "aman-site-config-401.json"),
    env: {},
  })

  const response = await getSiteConfigResponse(store, null)

  assert.equal(response.status, 401)
  assert.deepEqual(response.body, {
    error: "Authentication required",
    errorKey: "UNAUTHENTICATED",
  })
})

test("site config returns 403 for non-admin roles", async () => {
  const store = createFileSiteConfigStore({
    filePath: join(tmpdir(), "aman-site-config-403.json"),
    env: {},
  })

  const doctorResponse = await getSiteConfigResponse(store, doctorSession)
  const patientResponse = await getSiteConfigResponse(store, patientSession)

  assert.equal(doctorResponse.status, 403)
  assert.equal(patientResponse.status, 403)
  assert.deepEqual(doctorResponse.body, {
    error: "Forbidden",
    errorKey: "FORBIDDEN",
  })
})

test("site config returns 400 for invalid request bodies", async () => {
  const store = createFileSiteConfigStore({
    filePath: join(tmpdir(), "aman-site-config-400.json"),
    env: {},
  })

  const response = await updateSiteConfigResponse(store, adminSession, {
    siteName: "",
    dicomEndpoint: "not-a-url",
  })

  assert.equal(response.status, 400)
  assert.deepEqual(response.body, {
    error: "Invalid request body",
    errorKey: "INVALID_BODY",
  })
})

test("deployment config resolves cloud and local modes safely", () => {
  const local = resolveDeploymentConfig({
    AMAN_DEPLOYMENT_MODE: "local",
    SITE_CONFIG_PATH: "/tmp/site-config.json",
  })
  const cloud = resolveDeploymentConfig({
    AMAN_DEPLOYMENT_MODE: "cloud",
  })

  assert.equal(local.mode, "local")
  assert.equal(local.siteConfigPath, "/tmp/site-config.json")
  assert.equal(local.usesFileSiteConfig, true)
  assert.equal(cloud.mode, "cloud")
  assert.equal(cloud.usesFileSiteConfig, false)
})

test("in-memory job queue tracks queued and completed jobs", async () => {
  const queue = createInMemoryJobQueue()

  const queued = queue.enqueue<{ analysisId: string }>({
    id: "job-1",
    type: "inference",
    payload: { analysisId: "analysis-1" },
  })

  assert.equal(queued.status, "queued")

  const completed = await queue.run<{ analysisId: string }, { analysisId: string; finished: boolean }>(
    "job-1",
    async (job) => {
    assert.equal(job.status, "running")
    return {
      analysisId: job.payload.analysisId,
      finished: true,
    }
    }
  )

  assert.equal(completed.status, "completed")
  assert.deepEqual(completed.result, {
    analysisId: "analysis-1",
    finished: true,
  })
  assert.equal(queue.get("job-1")?.status, "completed")
})

test("in-memory job queue records failed jobs", async () => {
  const queue = createInMemoryJobQueue()
  queue.enqueue<{ analysisId: string }>({
    id: "job-2",
    type: "inference",
    payload: { analysisId: "analysis-2" },
  })

  await assert.rejects(
    () =>
      queue.run<{ analysisId: string }, never>("job-2", async () => {
        throw new Error("boom")
      }),
    /boom/
  )

  const failed = queue.get("job-2")
  assert.equal(failed?.status, "failed")
  assert.equal(failed?.error, "boom")
})
