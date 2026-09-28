import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  efeitosNenhum,
  idsDeCA,
  linhasComImportDeTestOuExpect,
  matrizCaCt,
  verificarEsteira,
  violacaoAppendOnly,
  type ItemVerificado,
} from '../verificar-esteira'

/**
 * A autoverificação é o que a etapa 11 deixa de conferir no olho. Se ela
 * disser OK para um CA sem CT, ou para um cenário sem print, o falso verde
 * passa pela última barreira mecânica da esteira. A pasta de tarefa aqui é
 * sintética, no formato real dos arquivos de contexto.
 */

const T = 'TSK-99999'

const T01 = `# ${T}

## Critérios de aceite

| ID | Critério | Fonte |
|---|---|---|
| CA01 | salva o cliente | \`[descrição]\` |
| **CA02** | mostra o erro | \`[descrição]\` |

## Acessos necessários

nenhum

## Dados de produção citados

nenhum
`

const T02 = `# Análise de código — ${T}

| | |
|---|---|
| Diff usado | \`git diff abc^1 abc\` (merge commit) |
| Ref lida para seletor | \`origin/develop\` |

${'Arquivos alterados e regras de negócio extraídas do diff. '.repeat(10)}
`

const T03B = `| Ação | Onde | Seletor | O que dispara | Efeito observado | Efeito colateral | Estado que exige |
|---|---|---|---|---|---|---|
| Salvar | form | getByTestId('salvar') | nenhuma requisição | toast | não observado | — |
`

const T04 = `| CA | Critério | Fonte | CT(s) |
|---|---|---|---|
| CA01 | salva | [descrição] | CT01 |
| CA02 | erro | [descrição] | CT02 |

CX01 — duplicidade
`

const SPEC_OK = `import { test, expect } from '../../../support/teste'
import type { Page } from '@playwright/test'
`

function resultado(cenarios: object[], extra: object = {}) {
  return JSON.stringify({ evidenciaOficial: true, cenarios, ...extra })
}

const cenario = (id: string, prints = 1) => ({
  cenario: id,
  passos: Array.from({ length: prints }, (_, i) => ({ arquivo: `0${i + 1}-${id.toLowerCase()}.png` })),
})

function montar(sobrescrever: Record<string, string | null> = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-verificar-'))
  const arquivos: Record<string, string | null> = {
    [`tarefas/${T}/alvo.json`]: '{"cliente":"x","sistema":"y"}',
    [`tarefas/${T}/contexto/01-tarefa.md`]: T01,
    [`tarefas/${T}/contexto/02-codigo.md`]: T02,
    [`tarefas/${T}/contexto/03-mapa-seletores.md`]: '# mapa',
    [`tarefas/${T}/contexto/03b-inventario-acoes.md`]: T03B,
    [`tarefas/${T}/contexto/04-plano.md`]: T04,
    [`tarefas/${T}/specs/a.spec.ts`]: SPEC_OK,
    [`tarefas/${T}/evidencias/resultado.json`]: resultado([cenario('CT01'), cenario('CT02', 2), cenario('CX01')]),
    'pages/a.page.ts': "import { Page, Locator, expect } from '@playwright/test'\n",
    ...sobrescrever,
  }
  for (const [rel, conteudo] of Object.entries(arquivos)) {
    if (conteudo === null) continue
    const destino = path.join(raiz, rel)
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    fs.writeFileSync(destino, conteudo, 'utf-8')
  }
  return raiz
}

function verificar(sobrescrever: Record<string, string | null> = {}) {
  const raiz = montar(sobrescrever)
  try {
    return verificarEsteira({ raiz, tarefa: T, diffMassa: { diff: '', linhasNoHead: 10 } })
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true })
  }
}

const falhas = (itens: ItemVerificado[]) => itens.filter((i) => i.status === 'FALHA')
const achar = (itens: ItemVerificado[], trecho: string) => {
  const i = itens.find((x) => x.item.includes(trecho))
  assert.ok(i, `item "${trecho}" não encontrado`)
  return i
}

test('tarefa completa: nenhuma FALHA, e o resto da checklist sai como MANUAL', () => {
  const itens = verificar()
  assert.deepEqual(falhas(itens), [])
  assert.ok(itens.filter((i) => i.status === 'MANUAL').length >= 15)
})

test('arquivo de contexto faltando é FALHA com o nome dele', () => {
  const i = achar(verificar({ [`tarefas/${T}/contexto/03b-inventario-acoes.md`]: null }), 'arquivos de contexto')
  assert.equal(i.status, 'FALHA')
  assert.match(i.detalhe!, /03b-inventario-acoes\.md/)
})

test('"## Resumo" ausente: AVISO em tarefa sem estado.json, FALHA em tarefa nova', () => {
  const item = 'abrem com "## Resumo"'
  const antiga = achar(verificar(), item)
  assert.equal(antiga.status, 'AVISO')
  assert.match(antiga.detalhe!, /01-tarefa\.md sem a seção/)

  const nova = achar(verificar({ [`tarefas/${T}/contexto/estado.json`]: '{}' }), item)
  assert.equal(nova.status, 'FALHA')

  const comResumo = (md: string) => `## Resumo\n- ok\n\n${md}`
  const completa = verificar({
    [`tarefas/${T}/contexto/estado.json`]: '{}',
    [`tarefas/${T}/contexto/01-tarefa.md`]: comResumo(T01),
    [`tarefas/${T}/contexto/02-codigo.md`]: comResumo(T02),
    [`tarefas/${T}/contexto/03-mapa-seletores.md`]: comResumo('# mapa'),
    [`tarefas/${T}/contexto/03b-inventario-acoes.md`]: comResumo(T03B),
    [`tarefas/${T}/contexto/04-plano.md`]: comResumo(T04),
  })
  assert.equal(achar(completa, item).status, 'OK')
  assert.deepEqual(falhas(completa), [])

  const longo = `## Resumo\n${Array.from({ length: 21 }, (_, i) => `- ${i}`).join('\n')}\n\n# mapa`
  const i = achar(verificar({ [`tarefas/${T}/contexto/03-mapa-seletores.md`]: longo }), item)
  assert.match(i.detalhe!, /03-mapa-seletores\.md com 21 linhas/)
})

test('arquivo de contexto acima de 25 KB é AVISO, nunca FALHA', () => {
  const grande = `## Resumo\n- ok\n\n${'x'.repeat(26 * 1024)}`
  const itens = verificar({ [`tarefas/${T}/contexto/03-mapa-seletores.md`]: grande })
  const i = achar(itens, 'até 25 KB')
  assert.equal(i.status, 'AVISO')
  assert.match(i.detalhe!, /03-mapa-seletores\.md 26 KB/)
  assert.equal(achar(verificar(), 'até 25 KB').status, 'OK')
})

test('sem 04b: só passa se o 01 disser "nenhum" nas duas seções', () => {
  assert.equal(achar(verificar(), '04b').status, 'OK')
  const t01 = T01.replace(/## Acessos necessários\n\nnenhum/, '## Acessos necessários\n\n- perfil Comprador')
  assert.equal(achar(verificar({ [`tarefas/${T}/contexto/01-tarefa.md`]: t01 }), '04b').status, 'FALHA')
})

test('CA sem CT na matriz é FALHA', () => {
  const t04 = T04.replace('| CA02 | erro | [descrição] | CT02 |', '| CA02 | erro | [descrição] | — |')
  const i = achar(verificar({ [`tarefas/${T}/contexto/04-plano.md`]: t04 }), 'matriz CA → CT')
  assert.equal(i.status, 'FALHA')
  assert.match(i.detalhe!, /CA02/)
})

test('02 sem comando de diff ou sem ref é FALHA', () => {
  const i = achar(verificar({ [`tarefas/${T}/contexto/02-codigo.md`]: 'curto' }), '02 registra')
  assert.equal(i.status, 'FALHA')
  assert.match(i.detalhe!, /diff/)
  assert.match(i.detalhe!, /ref/)
})

test('waitForTimeout em spec ou page é FALHA; em comentário não conta', () => {
  const comentado = verificar({ [`tarefas/${T}/specs/b.spec.ts`]: '// nunca use page.waitForTimeout(1)\n' })
  assert.equal(achar(comentado, 'waitForTimeout').status, 'OK')
  const i = achar(verificar({ 'pages/b.page.ts': 'await this.page.waitForTimeout(500)\n' }), 'waitForTimeout')
  assert.equal(i.status, 'FALHA')
  assert.match(i.detalhe!, /pages\/b\.page\.ts:1/)
})

test('import de test/expect de @playwright/test no spec é FALHA; tipo e page passam', () => {
  assert.equal(achar(verificar(), "'@playwright/test'").status, 'OK')
  const i = achar(
    verificar({ [`tarefas/${T}/specs/a.spec.ts`]: "import fs from 'node:fs'\nimport { expect } from '@playwright/test'\n" }),
    "'@playwright/test'",
  )
  assert.equal(i.status, 'FALHA')
  assert.match(i.detalhe!, /a\.spec\.ts:2/)
})

test('03b com "nenhum" na coluna de efeito é FALHA; "nenhuma requisição" em outra coluna não', () => {
  assert.equal(achar(verificar(), '03b sem').status, 'OK')
  const t03b = T03B.replace('| toast | não observado |', '| toast | nenhum |')
  const i = achar(verificar({ [`tarefas/${T}/contexto/03b-inventario-acoes.md`]: t03b }), '03b sem')
  assert.equal(i.status, 'FALHA')
  assert.match(i.detalhe!, /linhas 3/)
})

test('resultado.json: CT sem entrada ou sem print é FALHA', () => {
  const r = resultado([cenario('CT01'), cenario('CT02', 0), cenario('CX01')])
  const i = achar(verificar({ [`tarefas/${T}/evidencias/resultado.json`]: r }), 'todo CT da matriz')
  assert.equal(i.status, 'FALHA')
  assert.match(i.detalhe!, /sem print: CT02/)

  const semCt02 = resultado([cenario('CT01'), cenario('CX01')])
  assert.match(achar(verificar({ [`tarefas/${T}/evidencias/resultado.json`]: semCt02 }), 'todo CT da matriz').detalhe!, /sem entrada: CT02/)
})

test('resultado.json: CX do plano que não rodou é MANUAL, não FALHA', () => {
  const r = resultado([cenario('CT01'), cenario('CT02')])
  const i = achar(verificar({ [`tarefas/${T}/evidencias/resultado.json`]: r }), 'CX do plano')
  assert.equal(i.status, 'MANUAL')
})

test('evidenciaOficial=false e parcial de outra execução são sinalizados', () => {
  const r = resultado([cenario('CT01'), cenario('CT02'), cenario('CX01')], {
    evidenciaOficial: false,
    cenariosDeOutraExecucao: ['CT02'],
  })
  const itens = verificar({ [`tarefas/${T}/evidencias/resultado.json`]: r })
  assert.equal(achar(itens, 'evidenciaOficial').status, 'FALHA')
  assert.equal(achar(itens, 'última execução').status, 'FALHA')
})

test('rascunho de veredito: "com ressalva" e veredito fora dos quatro são FALHA', () => {
  const ok = verificar({ [`tarefas/${T}/contexto/rascunho-veredito.md`]: 'Veredito sugerido: APROVADO — tudo passou' })
  assert.equal(achar(ok, 'rascunho de veredito').status, 'OK')
  const ruim = verificar({
    [`tarefas/${T}/contexto/rascunho-veredito.md`]: 'Veredito sugerido: APROVADO com ressalva — CX01',
  })
  assert.equal(achar(ruim, 'rascunho de veredito').status, 'FALHA')
  assert.equal(achar(verificar(), 'rascunho de veredito').status, 'MANUAL')
})

test('massa-em-hmlg: linha acrescentada ao fim passa; no meio ou alterada falha', () => {
  assert.equal(violacaoAppendOnly({ diff: '', linhasNoHead: 10 }), undefined)
  assert.equal(violacaoAppendOnly({ diff: '@@ -10,0 +11,2 @@\n+| a |\n+| b |', linhasNoHead: 10 }), undefined)
  assert.match(violacaoAppendOnly({ diff: '@@ -4,0 +5 @@\n+| a |', linhasNoHead: 10 })!, /meio/)
  assert.match(violacaoAppendOnly({ diff: '@@ -3 +3 @@\n-| velho |\n+| novo |', linhasNoHead: 10 })!, /alterada/)
  // última linha sem quebra ganhou quebra + linha nova: git mostra a última como trocada
  assert.equal(
    violacaoAppendOnly({ diff: '@@ -10 +10,2 @@\n-| fim |\n\\ No newline at end of file\n+| fim |\n+| novo |', linhasNoHead: 10 }),
    undefined,
  )
})

test('git indisponível para a massa vira MANUAL', () => {
  const raiz = montar()
  try {
    const itens = verificarEsteira({ raiz, tarefa: T, diffMassa: null })
    assert.equal(achar(itens, 'massa-em-hmlg').status, 'MANUAL')
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true })
  }
})

test('helpers de markdown: CA com negrito, matriz somando duas tabelas, CT com sufixo', () => {
  assert.deepEqual(idsDeCA('| **CA01** | a |\n| CA02 | b |\n| CA01 | repetido |'), ['CA01', 'CA02'])
  const m = matrizCaCt('| CA01 | x | CT01 |\n\n| CA01 | x | CT13b |')
  assert.deepEqual([...m.get('CA01')!], ['CT01', 'CT13B'])
  assert.deepEqual(efeitosNenhum('| Ação | Efeito |\n|---|---|\n| a | **nenhum** |\n| b | não observado |'), [3])
})

test('import: tipo passa, test/expect falha, e o import anterior sem ";" não confunde', () => {
  assert.deepEqual(linhasComImportDeTestOuExpect("import type { Page } from '@playwright/test'"), [])
  assert.deepEqual(linhasComImportDeTestOuExpect("import { Browser, Locator } from '@playwright/test'"), [])
  assert.deepEqual(linhasComImportDeTestOuExpect("import { type Page, expect } from '@playwright/test'"), [1])
  assert.deepEqual(linhasComImportDeTestOuExpect("import fs from 'node:fs'\nimport { test as base } from '@playwright/test'"), [2])
  assert.deepEqual(linhasComImportDeTestOuExpect("import * as pw from '@playwright/test'"), [1])
})
