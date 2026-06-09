import assert from "node:assert/strict"
import test from "node:test"

import { getDoctorCopy } from "../src/lib/doctor-copy"

test("getDoctorCopy returns localized worklist labels for ru, en, and kk", () => {
  assert.equal(getDoctorCopy("ru").worklist.pageTitle, "Список врача")
  assert.equal(getDoctorCopy("en").worklist.pageTitle, "Doctor worklist")
  assert.equal(getDoctorCopy("kk").worklist.pageTitle, "Дәрігер тізімі")
})

test("getDoctorCopy falls back to russian for unknown locale input", () => {
  assert.equal(getDoctorCopy("unknown").worklist.open, "Открыть")
})
