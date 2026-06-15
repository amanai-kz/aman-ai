import assert from "node:assert/strict"
import test from "node:test"

import { ServiceType } from "@prisma/client"

import { detectOutOfDistributionStudy } from "../src/lib/ood-detection"

test("supported study passes the OOD check", () => {
  const result = detectOutOfDistributionStudy({
    serviceType: ServiceType.CT_MRI,
    inputData: {
      ingestion: {
        modality: "MR",
        studyDate: "2026-06-12T09:00:00.000Z",
        sourceStudyId: "study-001",
        bodyPart: "BRAIN",
        manufacturer: "Siemens",
        series: [
          {
            seriesInstanceUid: "series-1",
            instanceCount: 42,
            sequenceName: "FLAIR",
          },
        ],
      },
    },
    confidence: 0.93,
  })

  assert.equal(result.isOod, false)
  assert.equal(result.manualReviewRequired, false)
  assert.equal(result.abstain, false)
  assert.deepEqual(result.reasons, [])
  assert.equal(result.severity, "low")
})

test("unsupported modality is flagged as OOD", () => {
  const result = detectOutOfDistributionStudy({
    serviceType: ServiceType.CT_MRI,
    inputData: {
      ingestion: {
        modality: "XR",
        studyDate: "2026-06-12T09:00:00.000Z",
        sourceStudyId: "study-001",
      },
    },
  })

  assert.equal(result.isOod, true)
  assert.equal(result.manualReviewRequired, true)
  assert.equal(result.abstain, true)
  assert.ok(result.reasons.includes("UNSUPPORTED_MODALITY"))
  assert.equal(result.severity, "high")
})

test("missing metadata is flagged as OOD", () => {
  const result = detectOutOfDistributionStudy({
    serviceType: ServiceType.CT_MRI,
    inputData: {
      ingestion: {
        modality: "",
        studyDate: "",
        sourceStudyId: "",
      },
    },
  })

  assert.equal(result.isOod, true)
  assert.ok(result.reasons.includes("MISSING_STUDY_METADATA"))
  assert.equal(result.manualReviewRequired, true)
})

test("low confidence is flagged when a model score is present", () => {
  const result = detectOutOfDistributionStudy({
    serviceType: ServiceType.CT_MRI,
    inputData: {
      ingestion: {
        modality: "MR",
        studyDate: "2026-06-12T09:00:00.000Z",
        sourceStudyId: "study-001",
      },
    },
    confidence: 0.41,
  })

  assert.equal(result.isOod, true)
  assert.ok(result.reasons.includes("LOW_MODEL_CONFIDENCE"))
  assert.equal(result.manualReviewRequired, true)
})
