import { test, expect } from '@playwright/test'

const HOMEPAGE = '/' // root path to verify

async function waitForFont(page, fontFamily, timeout = 10_000) {
  await page.waitForFunction(
    async fam => {
      if (typeof document.fonts === 'undefined') return false
      try {
        await document.fonts.load(`1em ${fam}`)
      } catch {}
      return document.fonts.check(`1em ${fam}`)
    },
    fontFamily,
    { timeout },
  )
}

test.describe('Effusion Labs visual primitives', () => {
  test('lucide icons render vector paths', async ({ page, baseURL }) => {
    await page.goto(new URL(HOMEPAGE, baseURL).toString(), { waitUntil: 'networkidle' })
    const svgCount = await page.locator('svg[aria-hidden="true"]').count()
    expect(svgCount).toBeGreaterThan(0)
    const pathCount = await page.locator('svg[aria-hidden="true"] path[d]').count()
    expect(pathCount).toBeGreaterThan(0)
    const emptyPaths = await page
      .locator('svg[aria-hidden="true"] path')
      .evaluateAll(nodes => nodes.filter(node => !node.getAttribute('d')?.trim()).length)
    expect(emptyPaths).toBe(0)
  })

  test('iconify custom element is registered and upgrades', async ({ page, baseURL }) => {
    await page.goto(new URL(HOMEPAGE, baseURL).toString(), { waitUntil: 'networkidle' })
    const defined = await page.evaluate(async () => {
      if (window.customElements?.get('iconify-icon')) return true
      if (window.customElements?.whenDefined) {
        await window.customElements.whenDefined('iconify-icon')
        return !!window.customElements.get('iconify-icon')
      }
      return false
    })
    expect(defined).toBeTruthy()
  })

  test('Manrope font loads and applies to body copy', async ({ page, baseURL }) => {
    await page.goto(new URL(HOMEPAGE, baseURL).toString(), { waitUntil: 'networkidle' })
    await waitForFont(page, 'Manrope')
    const bodyFontFamily = await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily)
    expect(bodyFontFamily).toMatch(/Manrope/i)
  })
})
