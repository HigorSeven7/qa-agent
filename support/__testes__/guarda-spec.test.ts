import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * O guarda-spec é o hook PreToolUse que barra `waitForTimeout` e import de
 * test/expect de '@playwright/test' antes de o arquivo ser gravado. O teste
 * roda o script do jeito que o Claude Code roda: `node` puro, JSON no stdin,
 * exit 2 = bloqueia com a mensagem no stderr.
 */

const SCRIPT = path.resolve(__dirname, '..', '..', '.claude', 'scripts', 'guarda-spec.ts')

function rodar(toolName: string, toolInput: object) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-guarda-'))
  try {
    return spawnSync(process.execPath, ['--no-warnings', SCRIPT], {
      input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: raiz, tool_name: toolName, tool_input: toolInput }),
      encoding: 'utf-8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: raiz },
    })
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true })
  }
}

test('Write com waitForTimeout num spec é barrado com exit 2 e a alternativa', () => {
  const r = rodar('Write', {
    file_path: 'tarefas/TSK-1/specs/a.spec.ts',
    content: "import { test } from '../../../support/teste'\nawait page.waitForTimeout(500)\n",
  })
  assert.equal(r.status, 2)
  assert.match(r.stderr, /waitForTimeout/)
  assert.match(r.stderr, /waitForResponse/)
})

test('Edit que importa expect de @playwright/test em tarefas/ é barrado', () => {
  const r = rodar('Edit', {
    file_path: 'tarefas/TSK-1/specs/apoio.ts',
    old_string: 'x',
    new_string: "import { expect } from '@playwright/test'",
  })
  assert.equal(r.status, 2)
  assert.match(r.stderr, /support\/teste/)
})

test('escrita normal passa (exit 0)', () => {
  const r = rodar('Write', {
    file_path: 'tarefas/TSK-1/specs/a.spec.ts',
    content: "import { test, expect } from '../../../support/teste'\nimport type { Page } from '@playwright/test'\n",
  })
  assert.equal(r.status, 0, r.stderr)
})

test('Page Object importa expect de @playwright/test (padrão do projeto) mas não pode waitForTimeout', () => {
  const ok = rodar('Write', { file_path: 'pages/x.page.ts', content: "import { Page, Locator, expect } from '@playwright/test'\n" })
  assert.equal(ok.status, 0, ok.stderr)
  const ruim = rodar('Edit', { file_path: 'pages/x.page.ts', old_string: 'a', new_string: 'await this.page.waitForTimeout(1)' })
  assert.equal(ruim.status, 2)
})

test('fora de tarefas/ e pages/, ou comentário, ou arquivo não-.ts: passa', () => {
  assert.equal(rodar('Write', { file_path: 'support/teste.ts', content: "import { test } from '@playwright/test'" }).status, 0)
  assert.equal(rodar('Write', { file_path: 'tarefas/TSK-1/contexto/04-plano.md', content: 'waitForTimeout(1)' }).status, 0)
  assert.equal(rodar('Write', { file_path: 'tarefas/TSK-1/specs/a.spec.ts', content: '// nunca page.waitForTimeout(1)' }).status, 0)
})

test('caminho absoluto dentro do projeto é reconhecido', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-guarda-abs-'))
  try {
    const r = spawnSync(process.execPath, ['--no-warnings', SCRIPT], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: path.join(raiz, 'tarefas', 'TSK-1', 'specs', 'a.spec.ts'), content: 'page.waitForTimeout(1)' },
      }),
      encoding: 'utf-8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: raiz },
    })
    assert.equal(r.status, 2)
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true })
  }
})

test('MultiEdit: qualquer edição proibida bloqueia', () => {
  const r = rodar('MultiEdit', {
    file_path: 'tarefas/TSK-1/specs/a.spec.ts',
    edits: [
      { old_string: 'a', new_string: 'const x = 1' },
      { old_string: 'b', new_string: 'await page.waitForTimeout(2)' },
    ],
  })
  assert.equal(r.status, 2)
})

test('entrada malformada nunca bloqueia', () => {
  const r = spawnSync(process.execPath, ['--no-warnings', SCRIPT], { input: 'não é json', encoding: 'utf-8' })
  assert.equal(r.status, 0)
})
