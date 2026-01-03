import assert from "node:assert/strict"
import test from "node:test"

import { computeDurationSeconds, formatDuration } from "../src/lib/duration"

test("computeDurationSeconds returns diff when both dates exist", () => {
  const start = new Date("2024-01-01T10:00:00Z")
  const end = new Date("2024-01-01T10:05:10Z")

  assert.equal(computeDurationSeconds(start, end, null), 310)
})

test("computeDurationSeconds falls back to explicit duration", () => {
  assert.equal(computeDurationSeconds(null, null, 125), 125)
  assert.equal(computeDurationSeconds(undefined, undefined, -5), 0)
})

test("computeDurationSeconds returns null when no usable data", () => {
  assert.equal(computeDurationSeconds("bad-date", null, null), null)
  assert.equal(computeDurationSeconds(new Date("2024-01-01"), null, null), null)
})

test("formatDuration handles hours, minutes, and null", () => {
  assert.equal(formatDuration(65), "1:05")
  assert.equal(formatDuration(3661), "1:01:01")
  assert.equal(formatDuration(null), "—")
  assert.equal(formatDuration(undefined), "—")
  assert.equal(formatDuration(-30), "0:00")
})
