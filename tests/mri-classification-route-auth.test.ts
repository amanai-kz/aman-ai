import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"


test("MRI classification route authorizes before backend inference", () => {
  const source =
    readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/mri/classify/route.ts"
      ),
      "utf8"
    )

  const authIndex =
    source.indexOf(
      "const session = await auth()"
    )

  const accessIndex =
    source.indexOf(
      "await assertPatientAccess"
    )

  const fetchIndex =
    source.indexOf(
      "const response ="
    )

  assert.ok(authIndex >= 0)
  assert.ok(accessIndex > authIndex)
  assert.ok(fetchIndex > accessIndex)

  assert.doesNotMatch(
    source,
    /db\.analysis\.create/
  )
})


test("MRI classification dashboard wires native panel", () => {
  const source =
    readFileSync(
      resolve(
        process.cwd(),
        "src/app/dashboard/[serviceId]/page.tsx"
      ),
      "utf8"
    )

  assert.match(
    source,
    /serviceId === "mri-classification"/
  )

  assert.match(
    source,
    /<MriClassificationPanel/
  )
})
