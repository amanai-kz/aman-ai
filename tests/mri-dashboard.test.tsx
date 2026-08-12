import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { SessionProvider } from "../src/components/providers/session-provider"

import { DashboardServiceView } from "../src/components/dashboard-service-view"
import { getLocalizedServices } from "../src/lib/services"


for (const serviceId of ["mri-seg-static", "mri-seg-adaptive"] as const) {
  test(`${serviceId} renders native Aman content instead of its unavailable iframe`, () => {
    const service = getLocalizedServices("en").find((item) => item.id === serviceId)
    assert.ok(service)

    const html = renderToStaticMarkup(
      <SessionProvider>
        <DashboardServiceView service={service}>
          <div data-testid="native-mri-segmentation">Native MRI segmentation</div>
        </DashboardServiceView>
      </SessionProvider>
    )

    assert.match(html, /data-testid="native-mri-segmentation"/)
    assert.doesNotMatch(html, /<iframe/)
    assert.doesNotMatch(html, /seg-(stat|adap)\.aman-ai\.kz/)
  })
}

test("MRI service catalog no longer treats native segmentation as an external embed", () => {
  const services = getLocalizedServices("en")
  assert.equal(services.find((item) => item.id === "mri-seg-static")?.embedUrl, null)
  assert.equal(services.find((item) => item.id === "mri-seg-adaptive")?.embedUrl, null)
})
