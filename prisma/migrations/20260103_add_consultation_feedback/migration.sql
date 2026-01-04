-- Add feedback and rating fields to consultation_reports table
ALTER TABLE "consultation_reports" ADD COLUMN "rating" INTEGER;
ALTER TABLE "consultation_reports" ADD COLUMN "feedback_text" TEXT;
ALTER TABLE "consultation_reports" ADD COLUMN "feedback_categories" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "consultation_reports" ADD COLUMN "feedback_submitted_at" TIMESTAMP(3);


