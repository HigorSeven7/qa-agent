import { test, expect } from '../../../support/teste'
import { ExemploClientesPage } from '../../../pages/exemplo-clientes.page'
import { Evidencia } from '../../../support/evidencias'
import dadosInvalidos from '../fixtures/exemplo-clientes.json'

/**
 * ⚠️ ARQUIVO DE REFERÊNCIA — ignorado pelo playwright.config.ts (`testIgnore`).
 *
 * Molde para o agente ao gerar `tests/<modulo>/<modulo>.spec.ts`.
 * Cobre os quatro tipos de cenário que o projeto exige:
 * happy path, negativo, data-driven e regressão/persistência.
 */

const TAREFA = 'TSK-00000'

test.describe(`[${TAREFA}] — Cadastro de clientes (exemplo)`, () => {
  let clientes: ExemploClientesPage

  test.beforeEach(async ({ page }) => {
    clientes = new ExemploClientesPage(page)
    await clientes.navegar()
  })

  // ---------- Happy path ----------
  test('CT01 — cadastra cliente com dados válidos', async ({ page }, testInfo) => {
    const ev = new Evidencia(TAREFA, 'CT01', page, testInfo)
    const nome = `QA Teste ${Date.now()}` // massa única: não colide em hmlg

    await clientes.abrirFormulario()
    await ev.capturar('formulario de cadastro aberto')

    await clientes.preencher({ nome, cnpj: '11222333000181', situacao: 'Ativo' })
    await ev.capturar('formulario preenchido')

    const resposta = await clientes.salvar()

    // Asserta a API...
    expect(resposta.status()).toBe(201)
    await ev.passo(`POST /api/clientes retornou ${resposta.status()}`)

    // ...a UI...
    await clientes.validarToastSucesso(/sucesso/i)

    // ...e a persistência. Toast verde não prova que salvou.
    await expect(clientes.linhaDoGrid(nome)).toBeVisible()
    await ev.capturar('registro visivel na listagem')

    ev.finalizar('aprovado')
  })

  // ---------- Negativo ----------
  test('CT02 — bloqueia cadastro com nome vazio', async ({ page }, testInfo) => {
    const ev = new Evidencia(TAREFA, 'CT02', page, testInfo)

    await clientes.abrirFormulario()
    await clientes.btnSalvar.click()

    await clientes.validarErroCampo(/obrigat[óo]rio/i)
    await ev.capturar('erro de campo obrigatorio exibido')

    // Validação funcionou como esperado → cenário aprovado.
    ev.finalizar('aprovado')
  })

  // ---------- Data-driven ----------
  for (const caso of dadosInvalidos.cnpjInvalidos) {
    test(`CT03 — rejeita CNPJ ${caso.descricao}`, async ({ page }, testInfo) => {
      const ev = new Evidencia(TAREFA, `CT03-${caso.id}`, page, testInfo)

      await clientes.abrirFormulario()
      await clientes.preencher({ nome: 'QA CNPJ Invalido', cnpj: caso.valor })
      await clientes.btnSalvar.click()

      await clientes.validarErroCampo(new RegExp(caso.mensagemEsperada, 'i'))
      await ev.capturar(`erro exibido para ${caso.descricao}`)

      ev.finalizar('aprovado')
    })
  }

  // ---------- Regressão de vizinhança ----------
  test('CT04 — busca na listagem continua funcionando', async ({ page }, testInfo) => {
    const ev = new Evidencia(TAREFA, 'CT04', page, testInfo)

    await clientes.buscar('QA')
    await expect(clientes.grid).toBeVisible()
    await ev.capturar('resultado da busca')

    ev.finalizar('aprovado')
  })
})
