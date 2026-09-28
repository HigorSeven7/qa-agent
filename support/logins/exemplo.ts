import { Page, expect } from '@playwright/test'
import { Sistema, Credencial } from '../clientes'

/**
 * MOLDE de login — copie para support/logins/<produto>.ts e ajuste.
 *
 * TODO(empresa): todos os seletores e o endpoint abaixo são hipótese. Confirme
 * cada um no código-fonte da tela de login (componente + arquivo de i18n) antes
 * de rodar `npm run auth`. Seletor chutado aqui derruba todas as suítes.
 *
 * Ordem de seletor: data-testid → role + nome → label → placeholder → texto.
 */

/** TODO(empresa): endpoint que a tela chama ao logar. */
const API_LOGIN = '**/auth/login'

export async function loginExemplo(
  page: Page,
  sistema: Sistema,
  { usuario, senha }: Credencial,
  alvo: string,
  filialAlvo?: string,
) {
  await page.goto(sistema.rotaLogin)

  await page.getByLabel('Usuário').fill(usuario)
  await page.getByLabel('Senha').fill(senha)

  const resposta = page.waitForResponse(API_LOGIN)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  const login = await resposta

  if (login.status() >= 400) {
    const corpo = await login.text().catch(() => '')
    throw new Error(`${alvo}: login retornou ${login.status()}. Resposta: ${corpo.slice(0, 300)}`)
  }

  // Produto com segundo passo (filial, empresa, tenant): selecione aqui.
  // A filial vem sempre de FILIAL= ou do catálogo — nunca da opção pré-selecionada.
  if (filialAlvo) {
    // TODO(empresa): seletor do passo de filial.
    await page.getByLabel('Filial').selectOption({ label: filialAlvo })
    await page.getByRole('button', { name: 'Continuar' }).click()
  }

  // Prova de que entrou: saiu da rota de login. Um 200 no endpoint não basta —
  // muita API responde 200 com payload de erro.
  await expect(page).not.toHaveURL(/\/login/i, { timeout: 30_000 })
}
