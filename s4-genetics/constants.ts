import { AnalysisStep, StepConfig } from './types';
import { 
  Database, 
  FileSearch, 
  Activity, 
  Cpu, 
  UserCheck 
} from 'lucide-react';

export const STEPS: StepConfig[] = [
  {
    id: AnalysisStep.COLLECTION,
    title: 'Data Collection',
    description: 'Ingesting genomic sequencing files and blood biomarker panels securely.',
    duration: 3000,
  },
  {
    id: AnalysisStep.EXTRACT,
    title: 'Feature Extraction',
    description: 'Identifying key genetic variants (SNPs) and normalizing biomarker levels.',
    duration: 3500,
  },
  {
    id: AnalysisStep.FOLD,
    title: 'Protein Folding',
    description: 'Simulating 3D protein structures to detect misfolding caused by variants.',
    duration: 4500,
  },
  {
    id: AnalysisStep.ANALYZE,
    title: 'ML Analysis',
    description: 'Running predictive models to calculate comprehensive risk scores.',
    duration: 4000,
  },
  {
    id: AnalysisStep.REVIEW,
    title: 'Doctor Review',
    description: 'Synthesizing findings into a clinical support report for physician approval.',
    duration: 2500,
  },
];

export const STEP_ICONS = {
  [AnalysisStep.COLLECTION]: Database,
  [AnalysisStep.EXTRACT]: FileSearch,
  [AnalysisStep.FOLD]: Activity,
  [AnalysisStep.ANALYZE]: Cpu,
  [AnalysisStep.REVIEW]: UserCheck,
};

export const MOCK_DNA_BASES = ['A', 'C', 'G', 'T'];

export const SAMPLE_METRICS = [
  { label: 'Hemoglobin', value: 13.5, unit: 'g/dL', status: 'normal' },
  { label: 'WBC Count', value: 7.2, unit: 'K/µL', status: 'normal' },
  { label: 'CRP', value: 4.8, unit: 'mg/L', status: 'warning' },
  { label: 'LDL-C', value: 145, unit: 'mg/dL', status: 'warning' },
];