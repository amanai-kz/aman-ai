const DEFAULT_SITE_CONFIG_PATH = ".aman-site-config.json"

export type DeploymentMode = "local" | "cloud"

export type DeploymentConfig = {
  mode: DeploymentMode
  siteConfigPath: string
  usesFileSiteConfig: boolean
}

export function resolveDeploymentConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): DeploymentConfig {
  const mode = env.AMAN_DEPLOYMENT_MODE === "cloud" ? "cloud" : "local"
  const siteConfigPath = env.SITE_CONFIG_PATH?.trim() || DEFAULT_SITE_CONFIG_PATH

  return {
    mode,
    siteConfigPath,
    usesFileSiteConfig: mode === "local",
  }
}
