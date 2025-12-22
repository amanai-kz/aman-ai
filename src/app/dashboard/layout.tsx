import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { AIAssistant } from "@/components/ai-assistant"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen flex">
      <DashboardSidebar user={session.user} />
      <main className="flex-1 flex flex-col lg:ml-64">
        {children}
      </main>
      <AIAssistant />
    </div>
  )
}
