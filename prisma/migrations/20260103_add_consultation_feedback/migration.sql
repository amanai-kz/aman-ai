-- Add feedback and rating fields to consultation_reports table
ALTER TABLE "consultation_reports" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
ALTER TABLE "consultation_reports" ADD COLUMN IF NOT EXISTS "feedback_text" TEXT;
ALTER TABLE "consultation_reports" ADD COLUMN IF NOT EXISTS "feedback_categories" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "consultation_reports" ADD COLUMN IF NOT EXISTS "feedback_submitted_at" TIMESTAMP(3);


