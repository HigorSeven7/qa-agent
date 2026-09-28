import { defineConfig, devices } from '@playwright/test'
import {
  AMBIENTE,
  sistema,
  alvo,
  baseURL,
  apiURL,
  arquivoAuth,
  resumoExecucao,
  validarSelecao,
} from './support/env'
import { opcoesAcompanhar, avisarAcompanhamento } from './support/acompanhar'
import { RAIZ_TAREFAS, tarefasComSpecs, alvoDaTarefa } from './support/caminhos'

/**
 * Um config, N clientes × N sistemas × 2 ambientes.
 *
 *   CLIENTE=acme SISTEMA=crm npm test                → em HOMOLOGAÇÃO
 *   CLIENTE=acme SISTEMA=crm npm run test:local      → em localhost
 *
 * O alvo de um teste é sempre um par cliente+sistema: URL, credencial e
 * repositório mudam em cada um. URLs vêm de config/clientes.json; credenciais
 * vêm do .env. Regra do projeto: a evidência oficial sai de hmlg.
 */

validarSelecao()
console.log(`[playwright] ${JSON.stringify(resumoExecucao())}`)
avisarAcompanhamento()

/** `playwright test --list` só enumera os testes — nenhum artefato deve ser gravado. */
const SOMENTE_LISTAGEM = process.argv.includes('--list')

// Carimbo desta execução. Este arquivo roda uma vez no processo pai, e o
// Playwright propaga o `process.env` para os workers — então todos os cenários
// do mesmo run compartilham o valor, inclusive em paralelo. É o que permite a
// `support/evidencias.ts` distinguir cenário desta rodada de parcial órfão
// deixado por uma rodada anterior.
process.env.QA_RUN_ID ||= new Date().toISOString()

/**
 * Recorte por cliente+sistema.
 *
 * `tarefas/` guarda tarefas de clientes diferentes lado a lado, e o alvo de um
 * teste é um par cliente+sistema — URL, credencial e banco mudam em cada um.
 * Sem este recorte, `npm test` sem caminho dispara **tudo** contra um único
 * `baseURL`: a maioria falha por motivo nenhum, e o pior caso é um spec de
 * outro sistema passar validando a tela errada.
 *
 * O alvo de cada tarefa mora no `alvo.json` DELA — não num catálogo central.
 * Registrar uma tarefa nova deixa de exigir mexer em arquivo compartilhado, e o
 * alvo não tem como ficar apontando para uma pasta que já foi renomeada.
 *
 * Tarefa **sem `alvo.json`** roda em qualquer alvo, com aviso no console: spec
 * recém-criada não pode sumir em silêncio só porque ninguém preencheu o
 * arquivo. Só entram no recorte as tarefas que têm `specs/` — tarefa analisada
 * mas não automatizada não tem o que rodar e não vira aviso.
 * `TODOS_OS_ALVOS=1` desliga o recorte (útil para enxergar a suíte inteira com
 * `--list`).
 */
const desteAlvo: string[] = []
const deOutroAlvo: string[] = []
const semAlvo: string[] = []

for (const tarefa of tarefasComSpecs()) {
  const alvoDela = alvoDaTarefa(tarefa)
  if (!alvoDela) semAlvo.push(tarefa)
  else if (alvoDela.cliente === sistema.clienteId && alvoDela.sistema === sistema.id)
    desteAlvo.push(tarefa)
  else deOutroAlvo.push(tarefa)
}

const RECORTE_LIGADO = !process.env.TODOS_OS_ALVOS

if (semAlvo.length) {
  console.warn(
    `[playwright] tarefa(s) sem alvo declarado, rodando em qualquer cliente: ` +
      `${semAlvo.join(', ')}. Crie ${RAIZ_TAREFAS}/<ID>/alvo.json.`,
  )
}

if (RECORTE_LIGADO && deOutroAlvo.length) {
  console.log(
    `[playwright] recorte ${sistema.clienteId}/${sistema.id}: ` +
      `${desteAlvo.concat(semAlvo).join(', ') || '(nenhuma tarefa declarada para este alvo)'} ` +
      `· fora: ${deOutroAlvo.join(', ')} (TODOS_OS_ALVOS=1 desliga)`,
  )
}

export default defineConfig({
  testDir: `./${RAIZ_TAREFAS}`,
  outputDir: './.playwright-artifacts',

  // tarefas/_exemplo/ é material de referência para o agente copiar — não roda.
  // `explorar.spec.ts` é sonda de exploração: navega, imprime e não asserta
  // nada. Fora do run oficial, senão ela entra na suíte de evidência e ainda
  // navega no sistema de outro cliente quando o alvo selecionado é outro.
  // …e as tarefas de outro cliente+sistema (ver o recorte no topo do arquivo).
  // tarefas/<ID>/scripts/ e tarefas/<ID>/pages/ são apoio (sonda, massa, page
  // object) — nunca suíte, mesmo que alguém nomeie um arquivo como *.spec.ts.
  testIgnore: [
    '**/_exemplo/**',
    '**/explorar.spec.ts',
    '**/scripts/**',
    '**/pages/**',
    ...(RECORTE_LIGADO ? deOutroAlvo.map((t) => `**/${t}/**`) : []),
  ],

  // Em hmlg nunca rode em paralelo contra dados compartilhados sem isolamento de massa.
  fullyParallel: AMBIENTE === 'local',
  workers: AMBIENTE === 'local' ? undefined : 1,

  // Retry só absorve instabilidade de rede/ambiente.
  // Teste que só passa no retry é suspeito — investigue, não comemore.
  retries: AMBIENTE === 'hmlg' ? 1 : 0,

  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // `--list` não executa nada, mas o reporter json grava assim mesmo — e o
  // arquivo saía com `{"expected":0,"skipped":97}`, apagando o registro da
  // última execução real. `npm run list` é comando de conferência: não pode
  // destruir evidência de run.
  reporter: SOMENTE_LISTAGEM
    ? [['list']]
    : [
        ['list'],
        ['html', { outputFolder: '.playwright-report', open: 'never' }],
        // Artefato de diagnóstico do run, não de tarefa: fica junto dos outros
        // artefatos do Playwright, que já são gitignored.
        ['json', { outputFile: '.playwright-artifacts/ultima-execucao.json' }],
      ],

  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    // Artefatos de diagnóstico — complementam as evidências, não substituem.
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    ignoreHTTPSErrors: AMBIENTE === 'local',

    // ACOMPANHAR=1 → headed + slowMo, para você assistir ao run.
    // Desligado (default) devolve {} e não muda nada — inclusive no run oficial.
    ...opcoesAcompanhar,
  },

  projects: [
    // Faz login de cada perfil do cliente e salva o storageState.
    {
      // auth.setup.ts mora em support/, fora do testDir global ('./tests').
      // Sem este testDir por projeto o Playwright não acha o setup e o
      // `npm run auth` morre com "No tests found".
      name: 'setup',
      testDir: './support',
      testMatch: /.*\.setup\.ts/,
      // Login errado não melhora no retry — só gasta tentativa e aproxima o
      // bloqueio por Lockout da conta. Falhou, falhou: leia a mensagem.
      retries: 0,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 900 },
        // Perfil default. Um spec que precise de outro perfil usa:
        //   test.use({ storageState: arquivoAuth('operador') })
        storageState: arquivoAuth('admin'),
      },
      dependencies: ['setup'],
    },
  ],

  metadata: {
    ...resumoExecucao(),
    alvo,
    apiURL,
    requerVpn: sistema.requerVpn ?? false,
  },
})
