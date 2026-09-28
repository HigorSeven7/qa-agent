import fs from 'node:fs'
import path from 'node:path'

/*
 * Hook PreToolUse (Write|Edit|MultiEdit) — trava de código de teste.
 *
 * Bloqueia, com exit 2 e a regra no stderr, a escrita que traz:
 *   - `.waitForTimeout(` em .ts de tarefas/ ou pages/;
 *   - `test`/`expect` importados de '@playwright/test' em .ts de tarefas/.
 *
 * Page Object (pages/) importa `Page`, `Locator` e `expect` de
 * '@playwright/test' de propósito — é o padrão do qa-implementador —, por isso
 * a trava de import vale só em tarefas/. Import só de tipo passa em qualquer
 * lugar. support/teste.ts fica fora do alcance: é ele que reexporta os dois.
 *
 * Roda com `node` puro (type stripping do Node 22.18+), sem tsx: hook que
 * estoura o timeout não bloqueia nada, então ele precisa ser leve.
 * Entrada malformada nunca bloqueia (exit 0) — quem trava é a regra, não o parser.
 */

interface Edicao {
  file_path?: string
  content?: string
  new_string?: string
  file_text?: string
}

interface Entrada {
  cwd?: string
  tool_name?: string
  tool_input?: Edicao & { edits?: Edicao[] }
}

function lerEntrada(): Entrada | undefined {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf-8'))
  } catch {
    return undefined
  }
}

/** Caminho relativo à raiz do projeto, com barra normal. */
function relativo(arquivo: string, raiz: string): string {
  return path.relative(raiz, path.resolve(raiz, arquivo)).replace(/\\/g, '/')
}

function semComentarios(texto: string): string {
  return texto
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim()
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'))
    })
    .join('\n')
}

/** Mesma lógica de `linhasComImportDeTestOuExpect` em support/verificar-esteira.ts. */
function importaTestOuExpect(texto: string): boolean {
  const imp = /\bimport\s+(type\s+)?([^;'"]*?)\s+from\s+['"]@playwright\/test['"]/g
  for (let m = imp.exec(texto); m; m = imp.exec(texto)) {
    if (m[1]) continue
    const clausula = m[2]
    const fora = clausula.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim()
    const nomes = (/\{([\s\S]*)\}/.exec(clausula)?.[1] ?? '')
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n && !n.startsWith('type '))
      .map((n) => n.split(/\s+as\s+/)[0].trim())
    if (fora || nomes.some((n) => n === 'test' || n === 'expect')) return true
  }
  return /require\(\s*['"]@playwright\/test['"]\s*\)/.test(texto)
}

function violacoes(rel: string, texto: string): string[] {
  const emTarefas = rel.startsWith('tarefas/')
  const emPages = rel.startsWith('pages/')
  if (!rel.endsWith('.ts') || !(emTarefas || emPages)) return []

  const codigo = semComentarios(texto)
  const achadas: string[] = []
  if (/\.waitForTimeout\s*\(/.test(codigo)) {
    achadas.push(
      '`page.waitForTimeout()` é proibido, sem exceção (CLAUDE.md → Waits e sincronização).\n' +
        '  Use `page.waitForResponse()` na ação que dispara API, ou uma asserção auto-retry:\n' +
        '  `await expect(locator).toBeVisible()`.',
    )
  }
  if (emTarefas && importaTestOuExpect(codigo)) {
    achadas.push(
      "`test`/`expect` não vêm de '@playwright/test' (CLAUDE.md → Código de teste).\n" +
        "  Importe de support/teste: `import { test, expect } from '../../../support/teste'`.\n" +
        "  Import só de tipo (`import type { Page } from '@playwright/test'`) é permitido.",
    )
  }
  return achadas
}

const entrada = lerEntrada()
if (!entrada?.tool_input) process.exit(0)

const raiz = process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd()
const ti = entrada.tool_input
const edicoes: Edicao[] = ti.edits?.length
  ? ti.edits.map((e) => ({ ...e, file_path: e.file_path ?? ti.file_path }))
  : [ti]

const mensagens: string[] = []
for (const e of edicoes) {
  if (!e.file_path) continue
  const texto = e.content ?? e.new_string ?? e.file_text ?? ''
  const rel = relativo(e.file_path, raiz)
  for (const v of violacoes(rel, texto)) mensagens.push(`${rel}: ${v}`)
}

if (mensagens.length) {
  process.stderr.write(`Bloqueado pelo guarda-spec.\n${mensagens.join('\n')}\n`)
  process.exit(2)
}
process.exit(0)
