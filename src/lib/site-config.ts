import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { z } from "zod"

import { resolveDeploymentConfig } from "@/lib/deployment-config"
import {
  ok,
  requireAdminActor,
  toErrorResponse,
  type PrivilegedApiResponse,
  type PrivilegedSession,
  PrivilegedApiError,
} from "@/lib/privileged-api"

const siteConfigSchema = z.object({
  siteName: z.string().min(1),
  dicomEndpoint: z.string().url(),
  fhirEndpoint: z.string().url(),
  inferenceEndpoint: z.string().url(),
  oidcIssuer: z.string().url(),
  oidcClientId: z.string().min(1),
  oidcRedirectUri: z.string().url(),
})

type SiteConfig = z.infer<typeof siteConfigSchema>

type SiteConfigResponse = PrivilegedApiResponse<{
  config: SiteConfig
}>

type SiteConfigStore = {
  isReadOnly(): boolean
  read(): Promise<SiteConfig>
  write(config: SiteConfig): Promise<SiteConfig>
}

type SiteConfigStoreOptions = {
  filePath: string
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
}

export function createFileSiteConfigStore(options: SiteConfigStoreOptions): SiteConfigStore {
  const envConfig = getEnvSiteConfig(options.env ?? process.env)
  const filePath = resolve(options.filePath)

  return {
    isReadOnly() {
      return false
    },
    async read() {
      const saved = await readConfigFile(filePath)
      return siteConfigSchema.parse({
        ...envConfig,
        ...saved,
      })
    },
    async write(config) {
      const parsed = siteConfigSchema.parse(config)
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8")
      return parsed
    },
  }
}

export function createSiteConfigStore(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): SiteConfigStore {
  const deployment = resolveDeploymentConfig(env)
  if (deployment.usesFileSiteConfig) {
    return createFileSiteConfigStore({
      filePath: deployment.siteConfigPath,
      env,
    })
  }

  const config = siteConfigSchema.parse(getEnvSiteConfig(env))
  return {
    isReadOnly() {
      return true
    },
    async read() {
      return config
    },
    async write() {
      throw new PrivilegedApiError(
        "SITE_CONFIG_READ_ONLY",
        "Site configuration is read-only in this deployment mode",
        409
      )
    },
  }
}

export async function getSiteConfigResponse(
  store: SiteConfigStore,
  session: PrivilegedSession
): Promise<SiteConfigResponse> {
  try {
    await requireAdminActor(session)
    return ok({
      config: await store.read(),
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function updateSiteConfigResponse(
  store: SiteConfigStore,
  session: PrivilegedSession,
  input: unknown
): Promise<SiteConfigResponse> {
  try {
    await requireAdminActor(session)

    const parsed = siteConfigSchema.safeParse(input)
    if (!parsed.success) {
      throw new PrivilegedApiError("INVALID_BODY", "Invalid request body", 400)
    }

    return ok({
      config: await store.write(parsed.data),
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

function getEnvSiteConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): SiteConfig {
  return siteConfigSchema.parse({
    siteName: env.SITE_NAME ?? "Aman AI",
    dicomEndpoint: env.DICOM_ENDPOINT ?? "http://localhost:8042/dicom-web",
    fhirEndpoint: env.FHIR_ENDPOINT ?? "http://localhost:8080/fhir",
    inferenceEndpoint: env.INFERENCE_ENDPOINT ?? "http://localhost:3000/api/inference/jobs",
    oidcIssuer: env.OIDC_ISSUER ?? "http://localhost:5556",
    oidcClientId: env.OIDC_CLIENT_ID ?? "aman-local",
    oidcRedirectUri: env.OIDC_REDIRECT_URI ?? "http://localhost:3000/api/auth/callback/oidc",
  })
}

async function readConfigFile(filePath: string) {
  try {
    const contents = await readFile(filePath, "utf8")
    const parsed = JSON.parse(contents) as unknown
    return siteConfigSchema.partial().parse(parsed)
  } catch (error) {
    if (isMissingFileError(error)) {
      return {}
    }

    throw new PrivilegedApiError("SITE_CONFIG_READ_ERROR", "Unable to read site configuration", 500)
  }
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  )
}
