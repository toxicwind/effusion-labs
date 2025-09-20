import { test, expect } from '@playwright/test'

const REPORT_PATH = '/lv/report/'

const urlFrom = (baseURL, path) => new URL(path, baseURL).toString()

async function gotoReport(page, baseURL) {
  await page.goto(urlFrom(baseURL, REPORT_PATH), { waitUntil: 'networkidle' })
}

test.describe('LV Image Atlas report wiring', () => {
  test('exposes robots cache entries', async ({ page, baseURL }) => {
    await gotoReport(page, baseURL)
    const robotsCards = page.locator('#robotsContainer .robots-card')
    await expect(robotsCards.first()).toBeVisible()
    expect(await robotsCards.count()).toBeGreaterThan(0)
  })

  test('lists cached XML/TXT docs', async ({ page, baseURL }) => {
    await gotoReport(page, baseURL)
    const docRows = page.locator('#docsTable tbody tr')
    await expect(docRows.first()).toBeVisible()
    expect(await docRows.count()).toBeGreaterThan(0)
  })
})
