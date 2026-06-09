import assert from "node:assert/strict"
import test from "node:test"

import {
  getPriorityLabel,
  sortDoctorWorklistCases,
  type DoctorWorklistCase,
} from "../src/lib/doctor-worklist"

test("sortDoctorWorklistCases sorts by priority first, then newest updatedAt", () => {
  const cases: DoctorWorklistCase[] = [
    {
      id: "normal-new",
      patientId: "p1",
      patientName: "Patient A",
      studyType: "QUESTIONNAIRE",
      priority: "NORMAL",
      status: "COMPLETED",
      aiSummary: "Normal case",
      updatedAt: "2026-06-09T12:00:00.000Z",
    },
    {
      id: "critical-old",
      patientId: "p2",
      patientName: "Patient B",
      studyType: "CT_MRI",
      priority: "CRITICAL",
      status: "PENDING",
      aiSummary: "Critical case",
      updatedAt: "2026-06-09T09:00:00.000Z",
    },
    {
      id: "high-new",
      patientId: "p3",
      patientName: "Patient C",
      studyType: "IOT",
      priority: "HIGH",
      status: "PROCESSING",
      aiSummary: "High case",
      updatedAt: "2026-06-09T13:00:00.000Z",
    },
    {
      id: "critical-new",
      patientId: "p4",
      patientName: "Patient D",
      studyType: "BLOOD",
      priority: "CRITICAL",
      status: "REVIEWED",
      aiSummary: "Newest critical case",
      updatedAt: "2026-06-09T14:00:00.000Z",
    },
  ]

  const result = sortDoctorWorklistCases(cases)

  assert.deepEqual(
    result.map((item) => item.id),
    ["critical-new", "critical-old", "high-new", "normal-new"]
  )
})

test("getPriorityLabel maps canonical priorities to UI labels", () => {
  assert.equal(getPriorityLabel("CRITICAL"), "Critical")
  assert.equal(getPriorityLabel("HIGH"), "High")
  assert.equal(getPriorityLabel("NORMAL"), "Normal")
})

test("getPriorityLabel supports Russian and Kazakh doctor copy", () => {
  assert.equal(getPriorityLabel("CRITICAL", "ru"), "Критический")
  assert.equal(getPriorityLabel("HIGH", "kk"), "Жоғары")
})
