-- Add SOAP format columns to consultation_reports table
-- Subjective, Objective, Assessment, Plan

-- Add SOAP format fields
ALTER TABLE consultation_reports ADD COLUMN IF NOT EXISTS subjective TEXT;
ALTER TABLE consultation_reports ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE consultation_reports ADD COLUMN IF NOT EXISTS assessment TEXT;
ALTER TABLE consultation_reports ADD COLUMN IF NOT EXISTS differential_diagnosis TEXT;
ALTER TABLE consultation_reports ADD COLUMN IF NOT EXISTS plan TEXT;

-- Add speaker labels for speaker identification
ALTER TABLE consultation_reports ADD COLUMN IF NOT EXISTS speaker_labels JSONB;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_consultation_reports_created_at ON consultation_reports(created_at DESC);

