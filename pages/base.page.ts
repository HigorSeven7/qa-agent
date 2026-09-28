import { Page, Locator, expect } from '@playwright/test'

/**
 * Base de todos os Page Objects.
 * Concentra o que é comum ao design system do sistema (PrimeVue) e as
 * esperas corretas — para nenhum Page Object precisar de wait fixo.
 */
export abstract class BasePage {
  readonly page: Page

  // Elementos globais do design system
  readonly toastSucesso: Locator
  readonly toastErro: Locator
  readonly loader: Locator
  readonly mensagemErroCampo: Locator

  constructor(page: Page) {
    this.page = page
    this.toastSucesso = page.locator('.p-toast-message-success')
    this.toastErro = page.locator('.p-toast-message-error')
    this.loader = page.locator('[data-pc-name="progressspinner"], .p-progress-spinner')
    this.mensagemErroCampo = page.locator('.p-error, small.p-invalid')
  }

  /** Rota da página, sem host. Ex: '/clientes' */
  protected abstract get rota(): string

  async navegar() {
    await this.page.goto(this.rota)
    await this.aguardarCarregamento()
  }

  /** Espera o spinner sumir. Nunca use sleep fixo. */
  async aguardarCarregamento() {
    const loader = this.loader.first()
    if (await loader.isVisible().catch(() => false)) {
      await expect(loader).toBeHidden({ timeout: 30_000 })
    }
  }

  /**
   * Executa uma ação e espera a resposta da API correspondente.
   * Substitui qualquer wait fixo após clique que dispara requisição.
   */
  async acaoComApi(
    acao: () => Promise<void>,
    filtroUrl: string | RegExp,
    metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    // O `actionTimeout` global (15 s) é curto para gravação pesada em hmlg:
    // salvar item dispara auditoria, recálculo de total e, às vezes, e-mail de
    // alçada. Timeout de espera virando "falha do sistema" é falso reprovado.
    timeout = 60_000,
  ) {
    const promessa = this.page.waitForResponse((r) => {
      const casaUrl =
        typeof filtroUrl === 'string' ? r.url().includes(filtroUrl) : filtroUrl.test(r.url())
      const casaMetodo = !metodo || r.request().method() === metodo
      return casaUrl && casaMetodo
    }, { timeout })
    await acao()
    return promessa
  }

  async validarToastSucesso(textoEsperado?: string | RegExp) {
    await expect(this.toastSucesso).toBeVisible()
    if (textoEsperado) await expect(this.toastSucesso).toContainText(textoEsperado)
  }

  async validarErroCampo(textoEsperado: string | RegExp) {
    await expect(this.mensagemErroCampo.filter({ hasText: textoEsperado }).first()).toBeVisible()
  }
}
