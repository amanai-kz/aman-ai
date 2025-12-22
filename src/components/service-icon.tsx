"use client"

import { 
  Scan, Activity, ClipboardList, Dna, Droplets, HeartPulse, Brain, Cpu, Eye,
  ScanLine, Radiation, BrainCircuit, FlaskConical, TestTube2, Waves, 
  PersonStanding, Syringe, Dumbbell, Microscope, Stethoscope, Atom, BookOpen,
  Mic, LucideIcon 
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
  Cpu,
  Eye,
  ScanLine,
  Radiation,
  BrainCircuit,
  FlaskConical,
  TestTube2,
  Waves,
  PersonStanding,
  Syringe,
  Dumbbell,
  Microscope,
  Stethoscope,
  Atom,
  BookOpen,
  Mic,
}

interface ServiceIconProps {
  name: string
  className?: string
}

export function ServiceIcon({ name, className }: ServiceIconProps) {
  const Icon = iconMap[name] || Scan
  return <Icon className={cn("w-5 h-5", className)} />
}


