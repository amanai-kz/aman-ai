"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, Loader2, Mail } from "lucide-react"
import { PdfExportOptions } from "@/lib/pdf-generator"
import { Input } from "@/components/ui/input"

interface PdfExportOptionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (options: PdfExportOptions) => Promise<void>
  onEmailShare?: (options: PdfExportOptions, email: string) => Promise<void>
  defaultOptions?: Partial<PdfExportOptions>
  showEmailOption?: boolean
}

export function PdfExportOptionsDialog({
  open,
  onOpenChange,
  onExport,
  onEmailShare,
  defaultOptions = {},
  showEmailOption = false,
}: PdfExportOptionsDialogProps) {
  const [loading, setLoading] = useState(false)
  const [emailMode, setEmailMode] = useState(false)
  const [email, setEmail] = useState("")
  const [options, setOptions] = useState<PdfExportOptions>({
    includeDialogue: defaultOptions.includeDialogue ?? true,
    includeCharts: defaultOptions.includeCharts ?? true,
    includeQRCode: defaultOptions.includeQRCode ?? true,
    includePageNumbers: defaultOptions.includePageNumbers ?? true,
    colorMode: defaultOptions.colorMode || "color",
    paperSize: defaultOptions.paperSize || "a4",
    language: defaultOptions.language || "ru",
  })

  const handleExport = async () => {
    setLoading(true)
    try {
      if (emailMode && email && onEmailShare) {
        await onEmailShare(options, email)
      } else {
        await onExport(options)
      }
      onOpenChange(false)
      setEmailMode(false)
      setEmail("")
    } catch (error) {
      console.error("Export failed:", error)
    } finally {
      setLoading(false)
    }
  }

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {emailMode ? "Отправить PDF по Email" : "Настройки экспорта PDF"}
          </DialogTitle>
          <DialogDescription>
            {emailMode
              ? "Укажите email для отправки отчета"
              : "Выберите параметры для экспорта PDF документа"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {emailMode ? (
            <div className="space-y-2">
              <Label htmlFor="email">Email получателя</Label>
              <Input
                id="email"
                type="email"
                placeholder="patient@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
            </div>
          ) : (
            <>
              {/* Include Options */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Включить в отчет</h4>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="dialogue" className="cursor-pointer">
                    Полный диалог
                  </Label>
                  <Switch
                    id="dialogue"
                    checked={options.includeDialogue}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, includeDialogue: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="charts" className="cursor-pointer">
                    Графики и диаграммы
                  </Label>
                  <Switch
                    id="charts"
                    checked={options.includeCharts}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, includeCharts: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="qrcode" className="cursor-pointer">
                    QR-код для проверки
                  </Label>
                  <Switch
                    id="qrcode"
                    checked={options.includeQRCode}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, includeQRCode: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="pageNumbers" className="cursor-pointer">
                    Номера страниц
                  </Label>
                  <Switch
                    id="pageNumbers"
                    checked={options.includePageNumbers}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, includePageNumbers: checked })
                    }
                  />
                </div>
              </div>

              {/* Format Options */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Формат</h4>

                <div className="space-y-2">
                  <Label htmlFor="paperSize">Размер бумаги</Label>
                  <Select
                    value={options.paperSize}
                    onValueChange={(value: "a4" | "letter") =>
                      setOptions({ ...options, paperSize: value })
                    }
                  >
                    <SelectTrigger id="paperSize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4 (210 × 297 мм)</SelectItem>
                      <SelectItem value="letter">Letter (216 × 279 мм)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="colorMode">Цветовой режим</Label>
                  <Select
                    value={options.colorMode}
                    onValueChange={(value: "color" | "grayscale") =>
                      setOptions({ ...options, colorMode: value })
                    }
                  >
                    <SelectTrigger id="colorMode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="color">Цветной</SelectItem>
                      <SelectItem value="grayscale">Черно-белый</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Язык</Label>
                  <Select
                    value={options.language}
                    onValueChange={(value: "ru" | "kz" | "en") =>
                      setOptions({ ...options, language: value })
                    }
                  >
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">Русский</SelectItem>
                      <SelectItem value="kz">Қазақша</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {!emailMode && showEmailOption && onEmailShare && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmailMode(true)}
              className="gap-2"
            >
              <Mail className="w-4 h-4" />
              Отправить по Email
            </Button>
          )}
          
          {emailMode && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEmailMode(false)
                setEmail("")
              }}
            >
              Назад
            </Button>
          )}

          <Button
            onClick={handleExport}
            disabled={loading || (emailMode && !isEmailValid)}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {emailMode ? "Отправка..." : "Экспорт..."}
              </>
            ) : emailMode ? (
              <>
                <Mail className="w-4 h-4" />
                Отправить
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Скачать PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


