export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export interface AnalysisStep {
  id: number;
  title: string;
  description: string;
  status: 'waiting' | 'processing' | 'completed';
}

export enum SectionId {
  INTRO = 'intro',
  HOW_IT_WORKS = 'how-it-works',
  TECHNOLOGY = 'technology',
  BENEFITS = 'benefits',
  INTEGRATION = 'integration',
  DEMO = 'demo',
}