import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { DashboardServiceView } from "../src/components/dashboard-service-view"
import { SessionProvider } from "../src/components/providers/session-provider"
import { getLocalizedServices } from "../src/lib/services"


test("MRI classification is native instead of iframe", () => {
  const service =
    getLocalizedServices("en").find(
      (item) =>
        item.id === "mri-classification"
    )

  assert.ok(service)
  assert.equal(service.embedUrl, null)

  const html =
    renderToStaticMarkup(
      <SessionProvider>
        <DashboardServiceView service={service}>
          <div data-testid="native-mri-classification">
            Native MRI classification
          </div>
        </DashboardServiceView>
      </SessionProvider>
    )

  assert.match(
    html,
    /native-mri-classification/
  )

  assert.doesNotMatch(
    html,
    /<iframe/
  )

  assert.doesNotMatch(
    html,
    /classification\.aman-ai\.kz/
  )
})
