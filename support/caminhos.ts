import fs from 'node:fs'
import path from 'node:path'

/**
 * Onde ficam os arquivos de uma tarefa.
 *
 * Uma tarefa mora numa pasta só:
 *
 *   tarefas/<ID>/
 *     contexto/     01-tarefa.md, 02-codigo.md, 03-mapa-seletores.md,
 *                   03b-inventario-acoes.md, 04-plano.md,
 *                   04b-preparo-ambiente.md, anexos/
 *     specs/        os .spec.ts da tarefa
 *     fixtures/     a massa da tarefa
 *     evidencias/   PNGs, _cenarios/, resultado.json, arquivos/
 *     documento/    o HTML e o PDF finais da evidência
 *     alvo.json     { "cliente": "acme", "sistema": "crm" }
 *
 * `pages/` e `support/` continuam compartilhados na raiz: Page Object é reusado
 * entre tarefas do mesmo sistema, e duplicá-lo por tarefa foi exatamente a
 * dívida apontada no `docs/melhorias/diagnostico-2026-08-31.md`.
 *
 * Todo caminho aqui é RELATIVO à raiz do projeto — é assim que o Playwright e
 * o `support/evidencias.ts` sempre trabalharam, e é o que mantém `resultado.json`
 * e os specs legíveis. Rode sempre a partir da raiz; script que precise de
 * caminho absoluto resolve com `path.resolve(__dirname, '..', <helper>)`.
 *
 * Este módulo é o ÚNICO lugar que sabe montar esses caminhos. Antes eles eram
 * literais espalhados por `support/evidencias.ts`, pelos specs e pelos scripts —
 * três pontos só no coletor de evidências —, e mudar a estrutura significava
 * caçar `path.join('evidencias', tarefa)` no projeto inteiro.
 */

export const RAIZ_TAREFAS = 'tarefas'

/**
 * ─── TRANSITÓRIO — sai quando a migração terminar ──────────────────────────
 *
 * Enquanto o Lote D estiver em andamento, parte das tarefas já mora em
 * `tarefas/<ID>/` e parte ainda está espalhada em `evidencias/<ID>/`,
 * `.contexto/<ID>/` e `docs/evidencias/`. Sem esta resolução por tarefa, mover
 * a primeira quebraria as outras onze de uma vez — e não haveria como validar a
 * migração rodando uma suíte de verdade no meio do caminho.
 *
 * Uma tarefa conta como migrada quando `tarefas/<ID>/` existe. Assim que todas
 * estiverem lá, esta função e os ramos `senão` somem, e cada caminho passa a ter
 * uma forma só.
 */
function migrada(tarefa: string): boolean {
  return fs.existsSync(path.join(RAIZ_TAREFAS, tarefa))
}

/**
 * Pasta de uma tarefa. Não garante que exista — quem grava cria com
 * `mkdirSync({ recursive: true })`.
 */
export function pastaDaTarefa(tarefa: string): string {
  return path.join(RAIZ_TAREFAS, tarefa)
}

/** `tarefas/<ID>/contexto` — o que o agente descobriu sobre a tarefa. */
export function pastaDeContexto(tarefa: string): string {
  return migrada(tarefa)
    ? path.join(pastaDaTarefa(tarefa), 'contexto')
    : path.join('.contexto', tarefa)
}

/** `tarefas/<ID>/specs` — os .spec.ts. */
export function pastaDeSpecs(tarefa: string): string {
  return path.join(pastaDaTarefa(tarefa), 'specs')
}

/** `tarefas/<ID>/fixtures` — a massa. */
export function pastaDeFixtures(tarefa: string): string {
  return path.join(pastaDaTarefa(tarefa), 'fixtures')
}

/**
 * `tarefas/<ID>/contexto/estado.json` — onde a esteira parou, o resumo de cada
 * etapa e as respostas dos gates. Lido e escrito só por `support/estado.ts`.
 */
export function arquivoDeEstado(tarefa: string): string {
  return path.join(pastaDeContexto(tarefa), 'estado.json')
}

/** `tarefas/<ID>/evidencias` — PNGs, parciais e resultado.json. */
export function pastaDeEvidencias(tarefa: string): string {
  return migrada(tarefa)
    ? path.join(pastaDaTarefa(tarefa), 'evidencias')
    : path.join('evidencias', tarefa)
}

/**
 * `tarefas/<ID>/evidencias/_cenarios` — um parcial por cenário.
 *
 * Cada `Evidencia` é dona de UM cenário e grava no próprio arquivo, para que
 * testes em paralelo (AMBIENTE=local) não se sobrescrevam. O `resultado.json`
 * é sempre reconstruído a partir daqui.
 */
export function pastaDeParciais(tarefa: string): string {
  return path.join(pastaDeEvidencias(tarefa), '_cenarios')
}

/** `tarefas/<ID>/evidencias/resultado.json` — insumo único do PDF. */
export function arquivoDeResultado(tarefa: string): string {
  return path.join(pastaDeEvidencias(tarefa), 'resultado.json')
}

/**
 * `tarefas/<ID>/evidencias/arquivos` — o que o teste baixou ou gerou (xlsx,
 * pdf, csv). Separado dos PNGs porque o gerador de evidência varre a pasta de
 * evidências atrás de imagem, e anexo solto no mesmo nível entra na varredura.
 *
 * Vale nos dois modos: anexo solto no mesmo nível dos PNGs entra na varredura
 * do gerador de evidência.
 */
export function pastaDeArquivos(tarefa: string): string {
  return path.join(pastaDeEvidencias(tarefa), 'arquivos')
}

/** `tarefas/<ID>/documento` — HTML e PDF finais entregues no ClickUp. */
export function pastaDeDocumento(tarefa: string): string {
  return migrada(tarefa)
    ? path.join(pastaDaTarefa(tarefa), 'documento')
    : path.join('docs', 'evidencias')
}

/** `tarefas/<ID>/alvo.json` — o par cliente+sistema que a tarefa testa. */
export function arquivoDeAlvo(tarefa: string): string {
  return path.join(pastaDaTarefa(tarefa), 'alvo.json')
}

export interface AlvoDeTeste {
  cliente: string
  sistema: string
}

/**
 * Os IDs de tarefa presentes em `tarefas/`, em ordem.
 *
 * Pasta iniciada por `_` é material de apoio, não tarefa — `_exemplo/` é o
 * modelo que o agente copia ao criar uma tarefa nova, e não pode entrar no
 * recorte por alvo nem na suíte.
 */
export function idsDeTarefas(raiz = RAIZ_TAREFAS): string[] {
  if (!fs.existsSync(raiz)) return []
  return fs
    .readdirSync(raiz, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()
}

/**
 * As tarefas que têm pasta `specs/` — as únicas que a suíte enxerga.
 *
 * Nem toda tarefa vira teste automatizado: várias foram analisadas e têm só
 * `contexto/`. Elas não podem entrar no recorte por alvo, senão o console avisa
 * "tarefa sem alvo declarado" para tarefa que não tem o que rodar, e o aviso —
 * que existe para spec nova não sumir em silêncio — vira ruído que ninguém lê.
 */
export function tarefasComSpecs(raiz = RAIZ_TAREFAS): string[] {
  return idsDeTarefas(raiz).filter((t) => fs.existsSync(path.join(raiz, t, 'specs')))
}

/**
 * Lê o `alvo.json` da tarefa. Devolve `undefined` quando a tarefa não declara
 * alvo — e isso NÃO é erro: tarefa sem alvo declarado roda em qualquer
 * cliente, com aviso. Spec recém-criada não pode sumir da suíte em silêncio só
 * porque ninguém preencheu o arquivo.
 */
export function alvoDaTarefa(tarefa: string, raiz = RAIZ_TAREFAS): AlvoDeTeste | undefined {
  const arquivo = path.join(raiz, tarefa, 'alvo.json')
  if (!fs.existsSync(arquivo)) return undefined

  let bruto: unknown
  try {
    bruto = JSON.parse(fs.readFileSync(arquivo, 'utf-8'))
  } catch (e) {
    throw new Error(`${arquivo} não é um JSON válido: ${(e as Error).message}`)
  }

  const alvo = bruto as Partial<AlvoDeTeste>
  if (typeof alvo?.cliente !== 'string' || typeof alvo?.sistema !== 'string') {
    throw new Error(
      `${arquivo} precisa de "cliente" e "sistema" como texto — ` +
        `ex.: { "cliente": "acme", "sistema": "crm" }`,
    )
  }
  return { cliente: alvo.cliente, sistema: alvo.sistema }
}
