import { test as setup } from './teste'
import fs from 'node:fs'
import {
  sistema,
  alvo,
  credenciaisDe,
  arquivoAuth,
  filialAlvo,
  nomesDasVariaveis,
  resumoExecucao,
} from './env'
import { autenticar } from './logins'

/**
 * Login por perfil do sistema selecionado. Salva o storageState em
 * support/.auth/<cliente>-<sistema>-<perfil>[-<filial>].json para as suítes
 * reaproveitarem.
 *
 * Roda pelo project "setup" do playwright.config.ts:
 *   CLIENTE=acme SISTEMA=crm npm run auth
 *   CLIENTE=acme SISTEMA=portal npm run auth
 *
 * O fluxo de tela por produto mora em support/logins/ (um arquivo por
 * produto, com ou sem passo de filial). Qual usar vem de
 * `clientes.<c>.sistemas.<s>.produto` em config/clientes.json.
 */
for (const perfil of sistema.perfis) {
  setup(`autenticar ${sistema.clienteId}/${sistema.id}/${perfil}`, async ({ page }) => {
    // Perfil catalogado sem credencial no `.env` **pula**, não quebra: o
    // project `setup` é dependência do project de teste, então um perfil que
    // nenhuma tarefa da vez usa (um `aprovador`, por exemplo)
    // derrubava a suíte inteira com "did not run" — falha de configuração
    // vestida de falha de teste.
    const variaveis = nomesDasVariaveis(perfil)
    const temCredencial = Boolean(process.env[variaveis.usuario] && process.env[variaveis.senha])
    setup.skip(
      !temCredencial,
      `sem credencial para o perfil '${perfil}': defina ${variaveis.usuario} e ${variaveis.senha} no .env`,
    )

    const destino = arquivoAuth(perfil)
    fs.mkdirSync('support/.auth', { recursive: true })

    // Loga contexto, nunca credencial.
    console.log(`[auth] ${JSON.stringify(resumoExecucao())} perfil=${perfil}`)

    await autenticar(page, sistema, credenciaisDe(perfil), alvo, filialAlvo())

    await page.context().storageState({ path: destino })
    console.log(`[auth] ${alvo} · storageState salvo em ${destino}`)
  })
}
