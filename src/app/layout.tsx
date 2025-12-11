import type React from "react"
import type { Metadata } from "next"
import { Manrope, JetBrains_Mono } from "next/font/google"
import { SessionProvider } from "@/components/providers/session-provider"
import "./globals.css"

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope" })
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Aman AI — AI платформа для нейродиагностики",
  description:
    "Объединяем передовые технологии искусственного интеллекта для комплексной диагностики неврологических заболеваний",
  icons: {
    icon: [
      {
        url: "/favicon-light.svg",
        media: "(prefers-color-scheme: light)",
        type: "image/svg+xml",
      },
      {
        url: "/favicon-dark.svg",
        media: "(prefers-color-scheme: dark)",
        type: "image/svg+xml",
      },
    ],
    apple: "/icon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${jetBrainsMono.variable} font-sans antialiased`}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
