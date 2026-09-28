import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gerarToml, lerAgenteMd, sincronizarCodex } from '../codex-agentes'

/**
 * O .toml do Codex é gerado do .md do agente. Se o escape falhar, o Codex lê
 * um agente truncado ou nem carrega — e ninguém percebe até rodar a esteira
 * por lá. Se a sincronização não detectar defasagem, os dois divergem em
 * silêncio, que foi o que aconteceu com três dos quatro agentes.
 */

const MD = `---\r
name: qa-teste\r
description: Faz "algo" com C:\\pasta\r
tools: Read\r
model: sonnet\r
---\r
\r
Corpo com \`grep "\\.waitForTimeout("\` e aspas triplas """ no meio.\r
Segunda linha.\r
`

test('lê o frontmatter e o corpo sem as linhas de ---', () => {
  const a = lerAgenteMd(MD)
  assert.equal(a.name, 'qa-teste')
  assert.equal(a.description, 'Faz "algo" com C:\\pasta')
  assert.match(a.corpo, /^Corpo com/)
  assert.doesNotMatch(a.corpo, /model: sonnet/)
})

test('gera TOML com barra, aspas e """ escapados, e \\r no fim de cada linha', () => {
  const toml = gerarToml(lerAgenteMd(MD))
  assert.match(toml, /^name = "qa-teste"\ndescription = "Faz \\"algo\\" com C:\\\\pasta"\n/)
  assert.ok(toml.includes('grep \\"\\\\.waitForTimeout(\\"'))
  assert.ok(toml.includes('aspas triplas \\"\\"\\" no meio.\\r\nSegunda linha."""\n'))
})

test('sincronizar escreve o que mudou e --verificar acusa a defasagem sem escrever', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-codex-'))
  try {
    fs.mkdirSync(path.join(raiz, '.claude/agents'), { recursive: true })
    fs.writeFileSync(path.join(raiz, '.claude/agents/qa-teste.md'), MD)

    assert.deepEqual(sincronizarCodex(raiz, false), [{ arquivo: '.codex/agents/qa-teste.toml', mudou: true }])
    assert.equal(fs.existsSync(path.join(raiz, '.codex/agents/qa-teste.toml')), false)

    sincronizarCodex(raiz)
    assert.deepEqual(sincronizarCodex(raiz, false), [{ arquivo: '.codex/agents/qa-teste.toml', mudou: false }])
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true })
  }
})
