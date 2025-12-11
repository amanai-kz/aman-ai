export enum AnalysisStep {
  IDLE = 'IDLE',
  COLLECTION = 'COLLECTION',
  EXTRACT = 'EXTRACT',
  FOLD = 'FOLD',
  ANALYZE = 'ANALYZE',
  REVIEW = 'REVIEW',
  COMPLETE = 'COMPLETE'
}

export interface StepConfig {
  id: AnalysisStep;
  title: string;
  description: string;
  duration: number; // in ms
}

export interface Metric {
  label: string;
  value: number | string;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface DNAFragment {
  id: number;
  sequence: string;
  hasAnomaly: boolean;
}