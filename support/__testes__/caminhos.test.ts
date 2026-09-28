import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  RAIZ_TAREFAS,
  pastaDaTarefa,
  pastaDeContexto,
  pastaDeSpecs,
  pastaDeFixtures,
  pastaDeEvidencias,
  pastaDeParciais,
  pastaDeArquivos,
  pastaDeDocumento,
  arquivoDeResultado,
  arquivoDeAlvo,
  idsDeTarefas,
  tarefasComSpecs,
  alvoDaTarefa,
} from '../caminhos'

/**
 * `support/caminhos.ts` é o único lugar que sabe onde mora cada arquivo de uma
 * tarefa. Antes disso, `path.join('evidencias', tarefa)` estava literal em três
 * pontos só do coletor de evidências, mais os specs e os scripts — e mudar a
 * estrutura significava caçar o literal no projeto inteiro. O contrato travado
 * aqui é o que impede o próximo caminho hardcoded de nascer.
 *
 * O `migrada()` transitório também é testado: enquanto o Lote D roda, tarefa
 * migrada e tarefa não migrada convivem, e quem resolve errado grava evidência
 * em pasta que ninguém vai olhar.
 */

const TAREFA = 'TSK-25177'

/** Roda `fn` com o processo dentro de um diretório descartável. */
function emPastaTemporaria(fn: (raiz: string) => void) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-caminhos-'))
  const anterior = process.cwd()
  try {
    process.chdir(raiz)
    fn(raiz)
  } finally {
    process.chdir(anterior)
    fs.rmSync(raiz, { recursive: true, force: true })
  }
}

test('tarefa migrada: tudo pendurado em tarefas/<ID>/', () => {
  emPastaTemporaria(() => {
    fs.mkdirSync(pastaDaTarefa(TAREFA), { recursive: true })

    assert.equal(pastaDaTarefa(TAREFA), path.join('tarefas', TAREFA))
    assert.equal(pastaDeContexto(TAREFA), path.join('tarefas', TAREFA, 'contexto'))
    assert.equal(pastaDeSpecs(TAREFA), path.join('tarefas', TAREFA, 'specs'))
    assert.equal(pastaDeFixtures(TAREFA), path.join('tarefas', TAREFA, 'fixtures'))
    assert.equal(pastaDeEvidencias(TAREFA), path.join('tarefas', TAREFA, 'evidencias'))
    assert.equal(pastaDeDocumento(TAREFA), path.join('tarefas', TAREFA, 'documento'))
    assert.equal(arquivoDeAlvo(TAREFA), path.join('tarefas', TAREFA, 'alvo.json'))
  })
})

test('parciais, resultado e arquivos ficam DENTRO da pasta de evidências', () => {
  emPastaTemporaria(() => {
    fs.mkdirSync(pastaDaTarefa(TAREFA), { recursive: true })
    const ev = pastaDeEvidencias(TAREFA)

    assert.equal(pastaDeParciais(TAREFA), path.join(ev, '_cenarios'))
    assert.equal(arquivoDeResultado(TAREFA), path.join(ev, 'resultado.json'))
    // Anexo (xlsx, pdf) fora do nível dos PNGs: o gerador do PDF varre a pasta
    // de evidências atrás de imagem e não pode tropeçar em planilha.
    assert.equal(pastaDeArquivos(TAREFA), path.join(ev, 'arquivos'))
    assert.notEqual(pastaDeArquivos(TAREFA), ev)
  })
})

test('tarefa NÃO migrada cai na estrutura antiga — nenhuma quebra no meio do Lote D', () => {
  emPastaTemporaria(() => {
    // Nada criado em tarefas/: esta tarefa ainda não foi movida.
    assert.equal(pastaDeEvidencias(TAREFA), path.join('evidencias', TAREFA))
    assert.equal(pastaDeContexto(TAREFA), path.join('.contexto', TAREFA))
    assert.equal(pastaDeDocumento(TAREFA), path.join('docs', 'evidencias'))
    // `arquivos/` vale nos dois modos — é a convenção que a TSK-25507 já usava.
    assert.equal(pastaDeArquivos(TAREFA), path.join('evidencias', TAREFA, 'arquivos'))
  })
})

test('migrada e não migrada convivem na mesma execução', () => {
  emPastaTemporaria(() => {
    fs.mkdirSync(pastaDaTarefa('TSK-25177'), { recursive: true })

    assert.equal(pastaDeEvidencias('TSK-25177'), path.join('tarefas', 'TSK-25177', 'evidencias'))
    assert.equal(pastaDeEvidencias('TSK-25506'), path.join('evidencias', 'TSK-25506'))
  })
})

test('idsDeTarefas ignora pasta de apoio (_) e arquivo solto', () => {
  emPastaTemporaria(() => {
    for (const p of ['TSK-25507', 'TSK-25177', '_exemplo', '.rascunho']) {
      fs.mkdirSync(path.join(RAIZ_TAREFAS, p), { recursive: true })
    }
    fs.writeFileSync(path.join(RAIZ_TAREFAS, 'LEIA-ME.md'), '# nada', 'utf-8')

    assert.deepEqual(idsDeTarefas(), ['TSK-25177', 'TSK-25507'])
  })
})

test('idsDeTarefas devolve lista vazia quando tarefas/ nem existe', () => {
  emPastaTemporaria(() => {
    assert.deepEqual(idsDeTarefas(), [])
  })
})

test('alvoDaTarefa lê o par cliente+sistema', () => {
  emPastaTemporaria(() => {
    fs.mkdirSync(pastaDaTarefa(TAREFA), { recursive: true })
    fs.writeFileSync(
      arquivoDeAlvo(TAREFA),
      JSON.stringify({ cliente: 'acme', sistema: 'crm' }),
      'utf-8',
    )

    assert.deepEqual(alvoDaTarefa(TAREFA), { cliente: 'acme', sistema: 'crm' })
  })
})

test('tarefa sem alvo.json devolve undefined — ela roda em qualquer alvo, com aviso', () => {
  emPastaTemporaria(() => {
    fs.mkdirSync(pastaDaTarefa(TAREFA), { recursive: true })
    assert.equal(alvoDaTarefa(TAREFA), undefined)
  })
})

test('alvo.json malformado estoura com o caminho do arquivo na mensagem', () => {
  emPastaTemporaria(() => {
    fs.mkdirSync(pastaDaTarefa(TAREFA), { recursive: true })

    fs.writeFileSync(arquivoDeAlvo(TAREFA), '{ isto não é json', 'utf-8')
    assert.throws(() => alvoDaTarefa(TAREFA), /alvo\.json não é um JSON válido/)

    // Faltando `sistema`: alvo pela metade é pior que alvo ausente — o recorte
    // acharia que declarou e rodaria a tarefa contra o cliente errado.
    fs.writeFileSync(arquivoDeAlvo(TAREFA), JSON.stringify({ cliente: 'acme' }), 'utf-8')
    assert.throws(() => alvoDaTarefa(TAREFA), /precisa de "cliente" e "sistema"/)
  })
})

test('tarefasComSpecs deixa de fora a tarefa que só tem contexto', () => {
  emPastaTemporaria(() => {
    fs.mkdirSync(pastaDeSpecs('TSK-25177'), { recursive: true })
    // Analisada, nunca automatizada: só contexto. (A pasta é criada antes de
    // chamar pastaDeContexto: sem `tarefas/<ID>/`, o helper ainda resolveria
    // para a estrutura antiga.)
    fs.mkdirSync(path.join(pastaDaTarefa('TSK-24747'), 'contexto'), { recursive: true })

    assert.deepEqual(idsDeTarefas(), ['TSK-24747', 'TSK-25177'])
    assert.deepEqual(tarefasComSpecs(), ['TSK-25177'])
  })
})
