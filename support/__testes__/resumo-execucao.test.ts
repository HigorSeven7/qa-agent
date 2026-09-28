import test from 'node:test'
import assert from 'node:assert/strict'
import { formatarResumo, resumirRelatorio } from '../resumo-execucao'

/**
 * O qa-executor classifica falha a partir deste resumo. Se ele perder um teste
 * de suíte aninhada, ou não apontar o error-context de quem falhou, a triagem
 * trabalha no escuro — e falha de script vira "bug" por falta de detalhe.
 */

const relatorio = {
  suites: [
    {
      title: 'a.spec.ts',
      file: 'TSK-1/specs/a.spec.ts',
      specs: [
        {
          title: 'CT01 — salva',
          line: 10,
          tests: [{ projectName: 'acme-crm', status: 'expected', results: [{ status: 'passed' }] }],
        },
      ],
      suites: [
        {
          title: 'describe',
          specs: [
            {
              title: 'CT02 — mostra erro',
              file: 'TSK-1/specs/a.spec.ts',
              line: 30,
              tests: [
                {
                  projectName: 'acme-crm',
                  status: 'unexpected',
                  results: [
                    {
                      status: 'failed',
                      errors: [{ message: '\u001b[31mError: expect(locator).toBeVisible()\u001b[39m\n\nLocator: getByTestId(x)' }],
                      attachments: [
                        { name: 'screenshot', path: 'x.png' },
                        { name: 'error-context', path: '.playwright-artifacts/ct02/error-context.md' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

test('resume suíte aninhada: status final, 1ª linha do erro sem ANSI e o error-context', () => {
  const r = resumirRelatorio(relatorio)
  assert.equal(r.length, 2)
  assert.equal(r[0].status, 'expected')
  assert.equal(r[0].erro, undefined)
  assert.equal(r[1].titulo, 'CT02 — mostra erro')
  assert.equal(r[1].arquivo, 'TSK-1/specs/a.spec.ts:30')
  assert.equal(r[1].erro, 'Error: expect(locator).toBeVisible()')
  assert.equal(r[1].errorContext, '.playwright-artifacts/ct02/error-context.md')
})

test('formatar conta por status e não traz o erro inteiro', () => {
  const txt = formatarResumo(resumirRelatorio(relatorio))
  assert.match(txt, /^2 testes — 1 passaram · 1 falharam · 0 flaky · 0 pulados/)
  assert.match(txt, /error-context: \.playwright-artifacts\/ct02\/error-context\.md/)
  assert.doesNotMatch(txt, /Locator: getByTestId/)
})
