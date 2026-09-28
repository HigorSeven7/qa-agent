import { chromium } from '@playwright/test'
import { baseURL, sistema } from '../support/env'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ baseURL })
  await page.goto(sistema.rotaLogin, { waitUntil: 'domcontentloaded' })
  const html = await page.content()
  const versoes = [...new Set(html.match(/\d+\.\d{2,3}\.\d+(-\d+)?/g) || [])]
  console.log('### versoes no HTML da tela de login:', JSON.stringify(versoes))
  const txt = (await page.locator('body').innerText()).replace(/\n{2,}/g, '\n')
  console.log('### texto visivel:\n' + txt.slice(0, 800))
  await browser.close()
}
main()
