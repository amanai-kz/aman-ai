"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useAppLocale } from "@/components/providers/locale-provider"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardBackground } from "@/components/dashboard-background"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAppCopy } from "@/lib/app-copy"
import { 
  Bell, 
  Shield, 
  Palette, 
  Globe, 
  Smartphone,
  Mail,
  Trash2,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Check,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react"

export default function SettingsPage() {
  const { data: session } = useSession()
  const { locale } = useAppLocale()
  const [activeTab, setActiveTab] = useState("notifications")
  const copy = getAppCopy(locale).patientSettings

  const tabs = [
    { id: "notifications", label: copy.tabs.notifications, icon: Bell },
    { id: "security", label: copy.tabs.security, icon: Shield },
    { id: "appearance", label: copy.tabs.appearance, icon: Palette },
    { id: "language", label: copy.tabs.language, icon: Globe },
    { id: "devices", label: copy.tabs.devices, icon: Smartphone },
  ]

  return (
    <>
      <DashboardHeader title={copy.pageTitle} />
      <div className="flex-1 overflow-auto relative pb-20 lg:pb-0">
        <DashboardBackground />
        
        <div className="relative z-10 p-6 md:p-8 lg:p-10">
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <nav className="border border-border rounded-2xl p-2 bg-background/60 backdrop-blur-sm space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                      activeTab === tab.id
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>

              {/* Danger Zone */}
              <div className="border border-destructive/20 rounded-2xl p-4 bg-destructive/5 mt-6">
                <h3 className="font-medium text-sm text-destructive mb-3">{copy.dangerZone.title}</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {copy.dangerZone.signOut}
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="lg:col-span-3">
              {activeTab === "notifications" && <NotificationsSettings />}
              {activeTab === "security" && <SecuritySettings email={session?.user?.email || ""} />}
              {activeTab === "appearance" && <AppearanceSettings />}
              {activeTab === "language" && <LanguageSettings />}
              {activeTab === "devices" && <DevicesSettings />}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function NotificationsSettings() {
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale).patientSettings.notifications
  const [settings, setSettings] = useState({
    email: true,
    push: false,
    results: true,
    reminders: true,
    news: false,
  })

  return (
    <div className="border border-border rounded-2xl p-6 bg-background/60 backdrop-blur-sm">
      <h2 className="text-lg font-medium mb-6">{copy.title}</h2>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">{copy.email.title}</p>
              <p className="text-xs text-muted-foreground">{copy.email.description}</p>
            </div>
          </div>
          <Toggle checked={settings.email} onChange={(v) => setSettings({ ...settings, email: v })} />
        </div>

        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">{copy.push.title}</p>
              <p className="text-xs text-muted-foreground">{copy.push.description}</p>
            </div>
          </div>
          <Toggle checked={settings.push} onChange={(v) => setSettings({ ...settings, push: v })} />
        </div>

        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">{copy.results.title}</p>
              <p className="text-xs text-muted-foreground">{copy.results.description}</p>
            </div>
          </div>
          <Toggle checked={settings.results} onChange={(v) => setSettings({ ...settings, results: v })} />
        </div>

        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">{copy.reminders.title}</p>
              <p className="text-xs text-muted-foreground">{copy.reminders.description}</p>
            </div>
          </div>
          <Toggle checked={settings.reminders} onChange={(v) => setSettings({ ...settings, reminders: v })} />
        </div>
      </div>
    </div>
  )
}

function SecuritySettings({ email }: { email: string }) {
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale).patientSettings.security
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const loading = false

  return (
    <div className="space-y-6">
      <div className="border border-border rounded-2xl p-6 bg-background/60 backdrop-blur-sm">
        <h2 className="text-lg font-medium mb-6">{copy.title}</h2>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="font-medium text-sm">{copy.email}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
            <Button variant="outline" size="sm">{copy.change}</Button>
          </div>

          <div className="py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{copy.password}</p>
                <p className="text-sm text-muted-foreground">••••••••••</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowChangePassword(!showChangePassword)}>
                {copy.change}
              </Button>
            </div>

            {showChangePassword && (
              <div className="mt-4 p-4 rounded-xl bg-secondary/50 space-y-4 animate-fade-up">
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    placeholder={copy.currentPassword}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showCurrent ? copy.hidePassword : copy.showPassword}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    placeholder={copy.newPassword}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showNew ? copy.hidePassword : copy.showPassword}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button size="sm" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : copy.save}
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-sm">{copy.twoFactorTitle}</p>
              <p className="text-sm text-muted-foreground">{copy.twoFactorDescription}</p>
            </div>
            <Button variant="outline" size="sm">{copy.configure}</Button>
          </div>
        </div>
      </div>

      <div className="border border-destructive/20 rounded-2xl p-6 bg-destructive/5">
        <h3 className="font-medium text-destructive mb-4">{copy.deleteTitle}</h3>
        <p className="text-sm text-muted-foreground mb-4">{copy.deleteDescription}</p>
        <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
          <Trash2 className="w-4 h-4 mr-2" />
          {copy.deleteAction}
        </Button>
      </div>
    </div>
  )
}

function AppearanceSettings() {
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale).patientSettings.appearance
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")

  const themes = [
    { id: "light", label: copy.light, icon: Sun },
    { id: "dark", label: copy.dark, icon: Moon },
    { id: "system", label: copy.system, icon: Monitor },
  ]

  return (
    <div className="border border-border rounded-2xl p-6 bg-background/60 backdrop-blur-sm">
      <h2 className="text-lg font-medium mb-6">{copy.title}</h2>
      
      <div className="space-y-6">
        <div>
          <p className="font-medium text-sm mb-4">{copy.theme}</p>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as "light" | "dark" | "system")}
                className={`p-4 rounded-xl border-2 transition-colors ${
                  theme === t.id
                    ? "border-foreground bg-secondary"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <t.icon className="w-5 h-5 mx-auto mb-2" />
                <p className="text-sm">{t.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function LanguageSettings() {
  const { locale } = useAppLocale()
  const { setLocale } = useAppLocale()
  const copy = getAppCopy(locale).patientSettings.language

  const languages = [
    { id: "ru", label: "Русский", flag: "🇷🇺" },
    { id: "kk", label: "Қазақша", flag: "🇰🇿" },
    { id: "en", label: "English", flag: "🇺🇸" },
  ]

  return (
    <div className="border border-border rounded-2xl p-6 bg-background/60 backdrop-blur-sm">
      <h2 className="text-lg font-medium mb-6">{copy.title}</h2>
      
      <div className="space-y-2">
        {languages.map((lang) => (
          <button
            key={lang.id}
            onClick={() => setLocale(lang.id as "ru" | "en" | "kk")}
            className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
              locale === lang.id
                ? "bg-foreground text-background"
                : "hover:bg-secondary"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{lang.flag}</span>
              <span>{lang.label}</span>
            </div>
            {locale === lang.id && <Check className="w-4 h-4" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function DevicesSettings() {
  const { locale } = useAppLocale()
  const copy = getAppCopy(locale).patientSettings.devices
  return (
    <div className="border border-border rounded-2xl p-6 bg-background/60 backdrop-blur-sm">
      <h2 className="text-lg font-medium mb-6">{copy.title}</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-foreground text-background flex items-center justify-center">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-sm">{copy.currentDevice}</p>
              <p className="text-xs text-muted-foreground">{copy.currentDeviceMeta}</p>
            </div>
          </div>
          <span className="text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded-full">{copy.active}</span>
        </div>

        <p className="text-sm text-muted-foreground text-center py-4">{copy.empty}</p>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-label="Toggle setting"
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? "bg-foreground" : "bg-secondary"
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-background transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  )
}
