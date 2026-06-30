import assert from "node:assert/strict"
import test from "node:test"

import { buildPatientScopedReportWhere } from "../src/lib/report-list-scope"

const admin = { user: { id: "admin-1", role: "ADMIN" } }
const doctor = { user: { id: "doctor-user-1", role: "DOCTOR" } }
const patient = { user: { id: "patient-user-1", role: "PATIENT" } }

test("consultation listing: ADMIN has no patient filter", () => {
  assert.deepEqual(buildPatientScopedReportWhere(admin), {
    whereSql: "",
    params: [],
  })
})

test("consultation listing: PATIENT is scoped to their own patient row", () => {
  assert.deepEqual(buildPatientScopedReportWhere(patient), {
    whereSql: ` WHERE patient_id IN (SELECT id FROM patients WHERE "userId" = $1)`,
    params: ["patient-user-1"],
  })
})

test("consultation listing: DOCTOR is scoped to assigned patients only", () => {
  assert.deepEqual(buildPatientScopedReportWhere(doctor), {
    whereSql: ` WHERE patient_id IN (
        SELECT dp."patientId"
        FROM doctor_patients dp
        JOIN doctors d ON d.id = dp."doctorId"
        WHERE d."userId" = $1
      )`,
    params: ["doctor-user-1"],
  })
})

test("voice reports listing: DOCTOR uses the same assigned-patient filter", () => {
  assert.deepEqual(buildPatientScopedReportWhere(doctor), {
    whereSql: ` WHERE patient_id IN (
        SELECT dp."patientId"
        FROM doctor_patients dp
        JOIN doctors d ON d.id = dp."doctorId"
        WHERE d."userId" = $1
      )`,
    params: ["doctor-user-1"],
  })
})
