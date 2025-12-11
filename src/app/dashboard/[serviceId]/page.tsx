import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { ServiceIcon } from "@/components/service-icon"
import { services } from "@/lib/services"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function ServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { serviceId } = await params
  const service = services.find((s) => s.id === serviceId)

  if (!service) {
    notFound()
  }

  return (
    <>
      <DashboardHeader title={service.title} />
      <div className="flex-1 flex flex-col">
        {/* Service header */}
        <div className="px-8 md:px-12 py-6 border-b border-border">
          <div className="flex items-center justify-between max-w-6xl">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Назад
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <ServiceIcon name={service.iconName} />
                </div>
                <div>
                  <h2 className="font-medium">{service.title}</h2>
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                </div>
              </div>
            </div>
            {(service.status as string) === "coming" && (
              <span className="px-3 py-1 text-xs rounded-full bg-secondary text-muted-foreground">
                Скоро
              </span>
            )}
          </div>
        </div>

        {/* Service content */}
        <div className="flex-1 p-8 md:p-12">
          {service.embedUrl ? (
            <div className="h-full min-h-[600px] border border-border rounded-2xl overflow-hidden bg-background">
              <iframe
                src={service.embedUrl}
                className="w-full h-full border-0"
                title={service.title}
                allow="camera; microphone"
              />
            </div>
          ) : (
            <div className="h-full min-h-[400px] border border-border rounded-2xl flex items-center justify-center">
              <div className="text-center max-w-md px-8">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-6">
                  <ServiceIcon name={service.iconName} className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-medium mb-3">
                  {(service.status as string) === "coming" ? "Сервис в разработке" : "Сервис не подключен"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {service.longDescription}
                </p>
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">Команда разработки:</p>
                  <p className="font-medium text-foreground">
                    {service.team.join(", ")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export function generateStaticParams() {
  return services.map((service) => ({
    serviceId: service.id,
  }))
}
