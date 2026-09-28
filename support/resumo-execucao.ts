import fs from 'node:fs'

/**
 * Resumo do relatório JSON do Playwright (`.playwright-artifacts/ultima-execucao.json`)
 * para o `qa-executor`: uma linha por teste, com o status final, a 1ª linha do
 * erro e o caminho do `error-context.md` de quem falhou.
 *
 * Existe para o agente não despejar o relatório inteiro (ou o log do terminal)
 * no contexto. O detalhe de cada falha fica no `error-context.md` dela.
 */

export const RELATORIO_PADRAO = '.playwright-artifacts/ultima-execucao.json'

export interface TesteResumido {
  titulo: string
  arquivo: string
  projeto: string
  /** `expected` | `unexpected` | `flaky` | `skipped`, como o Playwright grava. */
  status: string
  tentativas: number
  erro?: string
  errorContext?: string
}

interface Resultado {
  status?: string
  errors?: { message?: string }[]
  error?: { message?: string }
  attachments?: { name?: string; path?: string }[]
}
interface Teste {
  projectName?: string
  status?: string
  results?: Resultado[]
}
interface Spec {
  title: string
  file?: string
  line?: number
  tests?: Teste[]
}
interface Suite {
  title?: string
  file?: string
  specs?: Spec[]
  suites?: Suite[]
}

const semAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '')

export function resumirRelatorio(relatorio: { suites?: Suite[] }): TesteResumido[] {
  const saida: TesteResumido[] = []
  const visitar = (suite: Suite, arquivo?: string) => {
    const arq = suite.file ?? arquivo ?? ''
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const resultados = t.results ?? []
        const ultimo = resultados.at(-1)
        const falhou = t.status === 'unexpected' || t.status === 'flaky'
        const comErro = [...resultados].reverse().find((r) => r.errors?.length || r.error)
        const msg = comErro?.errors?.[0]?.message ?? comErro?.error?.message
        const contexto = [...resultados]
          .reverse()
          .flatMap((r) => r.attachments ?? [])
          .find((a) => a.name === 'error-context' && a.path)
        saida.push({
          titulo: spec.title,
          arquivo: `${spec.file ?? arq}${spec.line ? `:${spec.line}` : ''}`,
          projeto: t.projectName ?? '',
          status: t.status ?? ultimo?.status ?? 'desconhecido',
          tentativas: resultados.length,
          erro: falhou && msg ? semAnsi(msg).split('\n').find((l) => l.trim())?.trim() : undefined,
          errorContext: falhou ? contexto?.path : undefined,
        })
      }
    }
    for (const filha of suite.suites ?? []) visitar(filha, arq)
  }
  for (const s of relatorio.suites ?? []) visitar(s)
  return saida
}

export function lerRelatorio(arquivo = RELATORIO_PADRAO): TesteResumido[] {
  if (!fs.existsSync(arquivo)) throw new Error(`${arquivo} não existe — a suíte rodou com o reporter json?`)
  return resumirRelatorio(JSON.parse(fs.readFileSync(arquivo, 'utf-8')))
}

export function formatarResumo(testes: TesteResumido[]): string {
  const conta = (s: string) => testes.filter((t) => t.status === s).length
  const l = [
    `${testes.length} testes — ${conta('expected')} passaram · ${conta('unexpected')} falharam · ${conta('flaky')} flaky · ${conta('skipped')} pulados`,
    '',
  ]
  for (const t of testes) {
    l.push(`${t.status.padEnd(10)} ${t.titulo}  [${t.projeto}]  ${t.arquivo}${t.tentativas > 1 ? `  (${t.tentativas} tentativas)` : ''}`)
    if (t.erro) l.push(`           erro: ${t.erro}`)
    if (t.errorContext) l.push(`           error-context: ${t.errorContext}`)
  }
  return l.join('\n')
}
