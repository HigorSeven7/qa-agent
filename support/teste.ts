import { test as base, expect } from '@playwright/test'
import { ACOMPANHAR, injetarCursor } from './acompanhar'

/**
 * `test` do projeto. Specs importam daqui, não do '@playwright/test',
 * para o modo acompanhamento (ACOMPANHAR=1) valer em todos eles sem
 * nenhuma linha extra dentro do spec.
 *
 *   import { test, expect } from '../../support/teste'
 *
 * Com ACOMPANHAR desligado — o caso normal, inclusive o run oficial de
 * evidência em hmlg — esta fixture não faz absolutamente nada.
 */
export const test = base.extend<{ cursorDeAcompanhamento: void }>({
  cursorDeAcompanhamento: [
    async ({ page }, use) => {
      if (ACOMPANHAR) await injetarCursor(page)
      await use()
    },
    { auto: true },
  ],
})

export { expect }
