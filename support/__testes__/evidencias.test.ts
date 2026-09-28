import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { Evidencia, RUN_ID, type ResultadoCenario } from '../evidencias'
import { pastaDeEvidencias, pastaDeParciais } from '../caminhos'

/**
 * `Evidencia.consolidar` monta o `resultado.json`, que é o insumo único do PDF
 * de evidência. Ele lê **tudo** que houver em `_cenarios/` da tarefa.
 *
 * O modo de falha: um CT renomeado ou removido do spec deixa um parcial órfão
 * com o status da rodada anterior — inclusive `aprovado`. Ele entra no PDF como
 * se tivesse rodado agora. Já aconteceu de verdade, e foi contornado na mão
 * criando `evidencias/_backup-<TAREFA>-rodada-anterior/`.
 *
 * O contrato travado aqui: consolidar **não apaga** nada (re-rodar um CT só é
 * fluxo normal), mas marca de qual execução cada cenário veio, para o parcial
 * velho não passar por atual.
 */

function comPasta(nome: string, fn: (tarefa: string) => void) {
  const tarefa = `_TESTE-${nome}-${process.pid}`
  const pasta = pastaDeEvidencias(tarefa)
  try {
    fs.mkdirSync(pastaDeParciais(tarefa), { recursive: true })
    fn(tarefa)
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true })
  }
}

function gravarParcial(tarefa: string, dados: Partial<ResultadoCenario> & { cenario: string }) {
  fs.writeFileSync(
    path.join(pastaDeParciais(tarefa), `${dados.cenario}.json`),
    JSON.stringify({ status: 'aprovado', passos: [], ...dados }, null, 2),
    'utf-8',
  )
}

test('consolida os parciais em ordem de cenário', () => {
  comPasta('ordem', (tarefa) => {
    gravarParcial(tarefa, { cenario: 'CT02', runId: RUN_ID, titulo: 'segundo' })
    gravarParcial(tarefa, { cenario: 'CT01', runId: RUN_ID, titulo: 'primeiro' })

    const r = Evidencia.consolidar(tarefa)

    assert.deepEqual(
      r.cenarios.map((c) => c.cenario),
      ['CT01', 'CT02'],
    )
    assert.equal(r.tarefa, tarefa)
    assert.ok(r.inicio, 'inicio não foi preenchido')
    assert.ok(r.fim, 'fim não foi preenchido')
  })
})

test('preserva a ficha do cenário — é ela que vira as linhas do PDF', () => {
  comPasta('ficha', (tarefa) => {
    gravarParcial(tarefa, {
      cenario: 'CT01',
      runId: RUN_ID,
      titulo: 'Cadastra cliente',
      tipo: 'obrigatorio',
      criterios: ['CA01', 'CA02'],
      precondicao: 'Admin na filial Matriz',
      esperado: 'POST 200 e registro na listagem',
      obtido: 'cliente 4711 gravado',
    })

    const c = Evidencia.consolidar(tarefa).cenarios[0]

    assert.equal(c.titulo, 'Cadastra cliente')
    assert.equal(c.tipo, 'obrigatorio')
    assert.deepEqual(c.criterios, ['CA01', 'CA02'])
    assert.equal(c.precondicao, 'Admin na filial Matriz')
    assert.equal(c.esperado, 'POST 200 e registro na listagem')
    assert.equal(c.obtido, 'cliente 4711 gravado')
  })
})

test('cenário de execução anterior é marcado, nunca passa por atual', () => {
  comPasta('orfao', (tarefa) => {
    gravarParcial(tarefa, { cenario: 'CT01', runId: RUN_ID, status: 'reprovado' })
    // Órfão: aprovado numa rodada antiga, e o CT nem existe mais no spec.
    gravarParcial(tarefa, { cenario: 'CT07', runId: '2026-01-01T00:00:00.000Z', status: 'aprovado' })

    const r = Evidencia.consolidar(tarefa)

    assert.equal(r.runId, RUN_ID)
    const atual = r.cenarios.find((c) => c.cenario === 'CT01')!
    const velho = r.cenarios.find((c) => c.cenario === 'CT07')!

    assert.equal(atual.desteRun, true)
    assert.equal(velho.desteRun, false)
    assert.deepEqual(r.cenariosDeOutraExecucao, ['CT07'])
  })
})

test('parcial sem runId (formato antigo) conta como de outra execução', () => {
  comPasta('legado', (tarefa) => {
    gravarParcial(tarefa, { cenario: 'CT01', status: 'aprovado' })

    const r = Evidencia.consolidar(tarefa)

    assert.equal(r.cenarios[0].desteRun, false)
    assert.deepEqual(r.cenariosDeOutraExecucao, ['CT01'])
  })
})

test('quando todos os cenários são do run atual, a lista de órfãos some', () => {
  comPasta('limpo', (tarefa) => {
    gravarParcial(tarefa, { cenario: 'CT01', runId: RUN_ID })
    gravarParcial(tarefa, { cenario: 'CT02', runId: RUN_ID })

    const r = Evidencia.consolidar(tarefa)

    assert.equal(r.cenariosDeOutraExecucao, undefined)
    assert.ok(r.cenarios.every((c) => c.desteRun))
  })
})

test('consolidar é idempotente e preserva o `inicio` da primeira chamada', () => {
  comPasta('idempotente', (tarefa) => {
    gravarParcial(tarefa, { cenario: 'CT01', runId: RUN_ID })

    const primeira = Evidencia.consolidar(tarefa)
    const segunda = Evidencia.consolidar(tarefa)

    assert.equal(segunda.inicio, primeira.inicio)
    assert.equal(segunda.cenarios.length, 1)
  })
})

test('pasta sem nenhum parcial devolve resultado vazio em vez de estourar', () => {
  comPasta('vazio', (tarefa) => {
    const r = Evidencia.consolidar(tarefa)
    assert.deepEqual(r.cenarios, [])
  })
})
