import type { AppLocale } from "@/lib/app-locale"
import { getAppCopy } from "@/lib/app-copy"
import { getLocalizedServices } from "@/lib/services"

type Role = "PATIENT" | "DOCTOR" | "ADMIN"

export function getDashboardNavigation(role: Role, locale: AppLocale) {
  const copy = getAppCopy(locale)

  if (role === "ADMIN") {
    return {
      primary: [
        { name: copy.sidebar.dashboard, href: "/admin/dashboard" },
        { name: copy.sidebar.users, href: "/admin/users" },
        { name: copy.sidebar.stats, href: "/admin/stats" },
        { name: copy.sidebar.services, href: "/admin/services" },
      ],
      profileHref: "/dashboard/profile",
      settingsHref: "/admin/settings",
    }
  }

  if (role === "DOCTOR") {
    return {
      primary: [
        { name: copy.sidebar.dashboard, href: "/doctor/dashboard" },
        { name: copy.sidebar.patients, href: "/doctor/patients" },
        { name: copy.sidebar.worklist, href: "/doctor/worklist" },
        { name: copy.sidebar.reviews, href: "/doctor/reviews" },
        { name: copy.sidebar.reports, href: "/doctor/reports" },
      ],
      profileHref: "/dashboard/profile",
      settingsHref: "/doctor/settings",
    }
  }

  return {
      primary: [
        { name: copy.sidebar.dashboard, href: "/dashboard" },
        ...getLocalizedServices(locale).map((service) => ({
          name: service.title,
          href: service.href,
          iconName: service.iconName,
        })),
        { name: copy.sidebar.history, href: "/dashboard/history" },
      ],
    profileHref: "/dashboard/profile",
    settingsHref: "/dashboard/settings",
  }
}
