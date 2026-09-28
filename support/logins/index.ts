import { Page } from '@playwright/test'
import { Sistema, Credencial, PRODUTO_PADRAO, exigeFilial } from '../clientes'
import { loginExemplo } from './exemplo'

/**
 * Um cliente pode rodar produtos diferentes, e cada produto tem a sua tela de
 * login. O produto vem de `clientes.<c>.sistemas.<s>.produto` em
 * config/clientes.json; sem ele, assume-se PRODUTO_PADRAO (support/clientes.ts).
 *
 * Encher o auth.setup.ts de `if` foi exatamente o que este arquivo evita.
 *
 * TODO(empresa): um arquivo por produto em support/logins/<produto>.ts, um
 * `case` por produto aqui, e o nome do produto no tipo `Produto`. Use
 * `exemplo.ts` como molde e apague-o quando tiver o primeiro login real.
 */
export type Produto = 'exemplo'

export async function autenticar(
  page: Page,
  sistema: Sistema,
  credencial: Credencial,
  alvo: string,
  filialAlvo?: string,
) {
  const produto = (sistema.produto ?? PRODUTO_PADRAO) as Produto

  switch (produto) {
    case 'exemplo':
      return loginExemplo(page, sistema, credencial, alvo, filialAlvo)
    default:
      throw new Error(
        `Produto "${produto}" não tem fluxo de login implementado em support/logins/. ` +
          `Corrija clientes.${sistema.clienteId}.sistemas.${sistema.id}.produto ` +
          `em config/clientes.json, ou implemente o login desse produto.`,
      )
  }
}

export { exigeFilial }
