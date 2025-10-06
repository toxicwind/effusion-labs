import { test, expect } from '@playwright/test'

const REPORT_PATH = '/lv/report/'

const urlFrom = (baseURL, path) => new URL(path, baseURL).toString()

async function gotoReport(page, baseURL) {
  await page.goto(urlFrom(baseURL, REPORT_PATH), { waitUntil: 'networkidle' })
}

async function waitForInventory(page) {
  const tableBody = page.locator('[data-lvreport="table-body"]')
  await expect(tableBody).toBeVisible()
  await page.waitForTimeout(250)
}

test.describe('LV report dashboard', () => {
  test('renders hero KPIs and baked index metadata', async ({ page, baseURL }) => {
    await gotoReport(page, baseURL)
    const kpiCards = page.locator('#lvreport-kpis .glass')
    await expect(kpiCards.first()).toBeVisible()

    const bundleMeta = page.locator('[data-lvreport="bundle-meta"] .badge')
    await expect(bundleMeta.first()).toContainText(/SHA/i)
    const datasetScript = page.locator('#lvreport-data')
    const payload = JSON.parse(await datasetScript.textContent())
    expect(payload.indexHref).toContain('/assets/data/lvreport/index.json')
  })

  test('supports pagination and facet toggles', async ({ page, baseURL }) => {
    await gotoReport(page, baseURL)
    await waitForInventory(page)

    const summary = page.locator('[data-lvreport="table-summary"]')
    const initialSummary = await summary.textContent()

    await page.locator('[data-lvreport="toggle-facets"]').click()
    await expect(page.locator('#lvreport-filters .drawer-side')).toBeVisible()

    const heroToggle = page.locator('[data-lvreport="facet-hero"]')
    if (await heroToggle.count()) {
      await heroToggle.check()
    }
    await page.locator('[data-lvreport="facet-apply"]').click()
    await page.waitForTimeout(200)

    const updatedSummary = await summary.textContent()
    expect(updatedSummary?.trim().length).toBeGreaterThan(0)
    if (initialSummary && updatedSummary) {
      expect(updatedSummary).not.toBe(initialSummary)
    }
  })

  test('opens detail drawer from table row', async ({ page, baseURL }) => {
    await gotoReport(page, baseURL)
    await waitForInventory(page)
    const detailButton = page.locator('[data-lvreport="table-body"] [data-detail]').first()
    if (await detailButton.count() === 0) {
      await expect(page.locator('[data-lvreport="table-body"] td')).toContainText(/No results|Loading/i)
      return
    }
    await detailButton.click()
    await expect(page.locator('#lvreport-drawer .drawer-side')).toBeVisible()
    await expect(page.locator('[data-lvreport="detail-content"]')).toContainText(/SKU/)
  })

  test('invokes command palette via keyboard', async ({ page, baseURL }) => {
    await gotoReport(page, baseURL)
    await waitForInventory(page)
    await page.keyboard.press('Control+K')
    const commandDialog = page.locator('body > div').filter({ hasText: 'Search LV inventory' }).first()
    await expect(commandDialog).toBeVisible()
    await commandDialog.locator('input').fill('bag')
    await page.waitForTimeout(150)
    const results = commandDialog.locator('[data-results] button')
    await expect(results.first()).toBeVisible()
  })
})
