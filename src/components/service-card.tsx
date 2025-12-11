"use client"

import Link from "next/link"
import { 
  ArrowRight, Scan, Activity, ClipboardList, Dna, Droplets, HeartPulse,
  Brain, ScanLine, Radiation, BrainCircuit, FlaskConical, TestTube2, 
  Waves, PersonStanding, Syringe, Dumbbell, Atom, BookOpen,
  LucideIcon 
} from "lucide-react"
import { cn } from "@/lib/utils"

const iconMap: Record<string, LucideIcon> = {
  Scan,
  Activity,
  ClipboardList,
  Dna,
  Droplets,
  HeartPulse,
  Brain,
  ScanLine,
  Radiation,
  BrainCircuit,
  FlaskConical,
  TestTube2,
  Waves,
  PersonStanding,
  Syringe,
  Dumbbell,
  Atom,
  BookOpen,
}

interface ServiceCardProps {
  title: string
  description: string
  iconName: string
  href: string
  index?: number
}

export function ServiceCard({ title, description, iconName, href, index = 0 }: ServiceCardProps) {
  const Icon = iconMap[iconName] || Scan
  
  return (
    <Link
      href={href}
      className={cn(
        "group relative block p-5 rounded-2xl border border-border bg-background/60 backdrop-blur-sm",
        "transition-all duration-300 hover:border-foreground/20 hover:bg-background/80 hover:shadow-lg hover:shadow-black/5",
        "opacity-0 animate-fade-up"
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-colors">
          <Icon className="w-5 h-5" />
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
      </div>
      <h3 className="font-medium mb-1 text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
    </Link>
  )
}
