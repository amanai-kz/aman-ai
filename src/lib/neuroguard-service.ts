/**
 * NeuroGuard catalog entry + static route source of truth.
 * Kept in a separate module so /dashboard/neuroguard works even if services.ts
 * on the server is an older deploy (avoids 404 from [serviceId] lookup).
 */
export const neuroguardService = {
  id: "neuroguard",
  title: "NeuroGuard",
  description: "CT ангиография — анализ аневризм и окклюзий",
  longDescription:
    "ИИ-анализ КТ ангиографии: детекция аневризм, окклюзий сосудов и нейрохирургических патологий",
  iconName: "Activity",
  href: "/dashboard/neuroguard",
  embedUrl: "/neuroguard/embed/dashboard?embed_secret=amanai-embed-secret-2024",
  team: ["Alnur"],
  status: "active" as const,
}
