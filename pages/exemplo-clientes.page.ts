import { Page, Locator } from '@playwright/test'
import { BasePage } from './base.page'

/**
 * ⚠️ ARQUIVO DE REFERÊNCIA — não corresponde a um módulo real.
 *
 * Serve de molde para o agente ao gerar `pages/<modulo>.page.ts`.
 * Mostra: herança de BasePage, locators readonly, getter `rota`,
 * ações com nome de intenção, e método que devolve a resposta da API.
 */
export class ExemploClientesPage extends BasePage {
  readonly btnNovo: Locator
  readonly inputNome: Locator
  readonly inputCnpj: Locator
  readonly selectSituacao: Locator
  readonly btnSalvar: Locator
  readonly grid: Locator

  constructor(page: Page) {
    super(page)
    this.btnNovo = page.getByTestId('btn-novo')
    this.inputNome = page.getByLabel('Nome')
    this.inputCnpj = page.getByLabel('CNPJ')
    this.selectSituacao = page.getByLabel('Situação')
    this.btnSalvar = page.getByTestId('btn-salvar')
    this.grid = page.getByRole('table')
  }

  protected get rota() {
    return '/clientes'
  }

  async abrirFormulario() {
    await this.btnNovo.click()
    await this.aguardarCarregamento()
  }

  async preencher(dados: { nome: string; cnpj: string; situacao?: string }) {
    await this.inputNome.fill(dados.nome)
    await this.inputCnpj.fill(dados.cnpj)
    if (dados.situacao) await this.selectSituacao.selectOption(dados.situacao)
  }

  /** Salva e devolve a resposta da API para o spec assertar o status. */
  async salvar() {
    return this.acaoComApi(() => this.btnSalvar.click(), '/api/clientes', 'POST')
  }

  /** Linha do grid por nome — usada para provar persistência. */
  linhaDoGrid(nome: string): Locator {
    return this.grid.getByRole('row', { name: new RegExp(nome) })
  }

  async buscar(termo: string) {
    const busca = this.page.getByPlaceholder('Buscar')
    await busca.fill(termo)
    await this.acaoComApi(() => busca.press('Enter'), '/api/clientes', 'GET')
  }
}
