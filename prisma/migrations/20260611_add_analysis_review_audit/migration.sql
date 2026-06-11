-- Add durable doctor review workflow fields and audit logs for analysis reviews

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewWorkflowStatus') THEN
    CREATE TYPE "ReviewWorkflowStatus" AS ENUM ('DRAFT', 'EDITED', 'SIGNED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewAuditAction') THEN
    CREATE TYPE "ReviewAuditAction" AS ENUM (
      'AI_DRAFT_VIEWED',
      'REPORT_EDITED',
      'DRAFT_SAVED',
      'AI_DRAFT_ACCEPTED',
      'AI_DRAFT_REJECTED',
      'REPORT_SIGNED_OFF',
      'CRITICAL_FINDING_ACKNOWLEDGED'
    );
  END IF;
END $$;

ALTER TABLE "analysis_reviews" ADD COLUMN IF NOT EXISTS "findingsDraft" TEXT;
ALTER TABLE "analysis_reviews" ADD COLUMN IF NOT EXISTS "impressionDraft" TEXT;
ALTER TABLE "analysis_reviews" ADD COLUMN IF NOT EXISTS "workflowStatus" "ReviewWorkflowStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "analysis_reviews" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);
ALTER TABLE "analysis_reviews" ADD COLUMN IF NOT EXISTS "signedById" TEXT;
ALTER TABLE "analysis_reviews" ADD COLUMN IF NOT EXISTS "criticalAcknowledgedAt" TIMESTAMP(3);
ALTER TABLE "analysis_reviews" ADD COLUMN IF NOT EXISTS "criticalAcknowledgedById" TEXT;

CREATE TABLE IF NOT EXISTS "analysis_review_audit_logs" (
  "id" TEXT NOT NULL,
  "analysisReviewId" TEXT NOT NULL,
  "action" "ReviewAuditAction" NOT NULL,
  "actorId" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analysis_review_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analysis_review_audit_logs_analysisReviewId_createdAt_idx"
  ON "analysis_review_audit_logs"("analysisReviewId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'analysis_review_audit_logs_analysisReviewId_fkey'
  ) THEN
    ALTER TABLE "analysis_review_audit_logs"
      ADD CONSTRAINT "analysis_review_audit_logs_analysisReviewId_fkey"
      FOREIGN KEY ("analysisReviewId")
      REFERENCES "analysis_reviews"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
