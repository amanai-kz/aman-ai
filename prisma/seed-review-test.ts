import { PrismaClient } from "@prisma/client"

import {
  buildManualUnsignedCriticalMriAnalysis,
  buildManualUnsignedCriticalMriReview,
  MANUAL_UNSIGNED_CRITICAL_MRI_CASE_ID,
  MANUAL_UNSIGNED_CRITICAL_MRI_CASE_URL,
} from "./seed-review-test-data"

const prisma = new PrismaClient()

async function main() {
  console.log("")
  console.log("⚠️  Local/dev-only review seed reset")
  console.log("   This script recreates a manual unsigned doctor review case for browser testing.")
  console.log("   Do not use this as production seed behavior.")
  console.log("")

  const doctorUser = await prisma.user.findUnique({
    where: { email: "daulet@amanai.kz" },
    include: {
      doctor: {
        select: { id: true },
      },
    },
  })

  const patientUser = await prisma.user.findUnique({
    where: { email: "aibek@amanai.kz" },
    include: {
      patient: {
        select: { id: true },
      },
    },
  })

  if (!doctorUser?.doctor || !patientUser?.patient) {
    throw new Error(
      "Required local users are missing. Run `npm run db:seed` first to create daulet@amanai.kz and aibek@amanai.kz."
    )
  }

  await prisma.doctorPatient.upsert({
    where: {
      doctorId_patientId: {
        doctorId: doctorUser.doctor.id,
        patientId: patientUser.patient.id,
      },
    },
    update: {},
    create: {
      doctorId: doctorUser.doctor.id,
      patientId: patientUser.patient.id,
    },
  })

  const analysisData = buildManualUnsignedCriticalMriAnalysis(patientUser.patient.id)

  await prisma.analysis.upsert({
    where: { id: MANUAL_UNSIGNED_CRITICAL_MRI_CASE_ID },
    update: {
      patientId: analysisData.patientId,
      serviceType: analysisData.serviceType,
      status: analysisData.status,
      confidence: analysisData.confidence,
      riskLevel: analysisData.riskLevel,
      findings: analysisData.findings,
      inputData: analysisData.inputData,
      result: analysisData.result,
      completedAt: null,
    },
    create: analysisData,
  })

  const existingReview = await prisma.analysisReview.findUnique({
    where: { analysisId: MANUAL_UNSIGNED_CRITICAL_MRI_CASE_ID },
    select: { id: true },
  })

  if (existingReview) {
    await prisma.analysisReviewAuditLog.deleteMany({
      where: {
        analysisReviewId: existingReview.id,
      },
    })
  }

  const reviewData = buildManualUnsignedCriticalMriReview(doctorUser.doctor.id)

  await prisma.analysisReview.upsert({
    where: { analysisId: MANUAL_UNSIGNED_CRITICAL_MRI_CASE_ID },
    update: reviewData,
    create: {
      analysisId: MANUAL_UNSIGNED_CRITICAL_MRI_CASE_ID,
      ...reviewData,
    },
  })

  console.log("✅ Reset manual unsigned critical MRI review case")
  console.log(`   Case id: ${MANUAL_UNSIGNED_CRITICAL_MRI_CASE_ID}`)
  console.log(`   Test URL: ${MANUAL_UNSIGNED_CRITICAL_MRI_CASE_URL}`)
  console.log("   Expected state: DRAFT, unsigned, unacknowledged, editable")
  console.log("")
}

main()
  .catch((error) => {
    console.error("❌ Failed to reset local review test case")
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
