import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { agregar, respostasDoJsonl, tabelaMarkdown, totalDe, type FonteSessao } from '../custo-sessao'

/**
 * O medidor de custo é a régua dos blocos de otimização da esteira: se ele
 * contar em dobro as linhas do streaming, ou somar mensagem `<synthetic>`, a
 * comparação antes × depois vira ruído. O .jsonl aqui é sintético, no formato
 * real do histórico do Claude Code (principal + subagents/ com .meta.json).
 */

const linha = (o: object) => JSON.stringify(o)

function assistente(id: string, modelo: string, u: [number, number, number, number], extra = {}) {
  return linha({
    type: 'assistant',
    requestId: `req-${id}`,
    ...extra,
    message: {
      id,
      model: modelo,
      usage: {
        input_tokens: u[0],
        output_tokens: u[1],
        cache_creation_input_tokens: u[2],
        cache_read_input_tokens: u[3],
      },
    },
  })
}

/** Monta a sessão sintética em disco e devolve as fontes como o CLI as leria. */
function montarSessao(): FonteSessao[] {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-medir-custo-'))
  try {
    const principal = [
      linha({ type: 'user', message: { content: 'oi' } }),
      // mesma resposta em duas linhas de streaming: output cresce de 2 para 150
      assistente('msg_1', 'claude-opus-x', [10, 2, 100, 1000]),
      assistente('msg_1', 'claude-opus-x', [10, 150, 100, 1000]),
      assistente('msg_syn', '<synthetic>', [0, 999, 0, 0]),
      '{isto não é json',
    ].join('\n')
    fs.writeFileSync(path.join(raiz, 'sessao.jsonl'), principal)

    const sub = path.join(raiz, 'sessao', 'subagents')
    fs.mkdirSync(sub, { recursive: true })
    fs.writeFileSync(
      path.join(sub, 'agent-a1.jsonl'),
      assistente('msg_2', 'claude-sonnet-x', [5, 40, 20, 200], { isSidechain: true }),
    )
    fs.writeFileSync(path.join(sub, 'agent-a1.meta.json'), linha({ agentType: 'qa-revisor' }))
    fs.writeFileSync(
      path.join(sub, 'agent-a2.jsonl'),
      assistente('msg_3', 'claude-sonnet-x', [1, 3, 0, 7], { isSidechain: true }),
    )
    fs.writeFileSync(path.join(sub, 'agent-a2.meta.json'), linha({ agentType: 'general-purpose' }))

    const ler = (p: string) => fs.readFileSync(p, 'utf8')
    const tipo = (p: string) => JSON.parse(ler(p)).agentType as string
    return [
      { tipoAgente: 'principal', conteudo: ler(path.join(raiz, 'sessao.jsonl')) },
      { tipoAgente: tipo(path.join(sub, 'agent-a1.meta.json')), conteudo: ler(path.join(sub, 'agent-a1.jsonl')) },
      { tipoAgente: tipo(path.join(sub, 'agent-a2.meta.json')), conteudo: ler(path.join(sub, 'agent-a2.jsonl')) },
    ]
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true })
  }
}

test('linhas de streaming com o mesmo message.id não contam em dobro e o output é o maior', () => {
  const linhas = agregar(montarSessao())
  const principal = linhas.find((l) => l.agente === 'principal')
  assert.deepEqual(principal, {
    agente: 'principal',
    modelo: 'claude-opus-x',
    input: 10,
    output: 150,
    cacheWrite: 100,
    cacheRead: 1000,
  })
})

test('mensagem <synthetic> e linha inválida ficam fora', () => {
  const linhas = agregar(montarSessao())
  assert.ok(!linhas.some((l) => l.modelo === '<synthetic>'))
  assert.equal(linhas.filter((l) => l.agente === 'principal').length, 1)
})

test('subagente conhecido usa o agentType; desconhecido cai em outros', () => {
  const linhas = agregar(montarSessao())
  assert.deepEqual(
    linhas.map((l) => [l.agente, l.modelo]),
    [
      ['principal', 'claude-opus-x'],
      ['qa-revisor', 'claude-sonnet-x'],
      ['outros', 'claude-sonnet-x'],
    ],
  )
})

test('total é a soma das linhas', () => {
  const total = totalDe(agregar(montarSessao()))
  assert.deepEqual(total, { input: 16, output: 193, cacheWrite: 120, cacheRead: 1207 })
  const tabela = tabelaMarkdown(agregar(montarSessao()))
  assert.match(tabela, /\| \*\*Total\*\* \|/)
  assert.match(tabela, /\*\*1\.536\*\* \| \*\*100%\*\*/)
})

test('sem .meta.json o attributionAgent da linha serve de fallback', () => {
  const conteudo = assistente('m', 'claude-sonnet-x', [1, 1, 0, 0], { attributionAgent: 'qa-analista' })
  assert.equal(respostasDoJsonl(conteudo).agenteAtribuido, 'qa-analista')
  assert.equal(agregar([{ tipoAgente: '', conteudo }])[0].agente, 'qa-analista')
})
