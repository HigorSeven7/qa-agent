import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { arquivoDeEstado } from '../caminhos'
import {
  MAX_LINHAS_RESUMO,
  adicionarPendencia,
  concluirEtapa,
  descreverEstado,
  extrairResumo,
  iniciarEstado,
  iniciarEtapa,
  lerEstado,
  registrarGateAchado,
  registrarGateComplementares,
  resolverPendencia,
} from '../estado'

/**
 * O estado.json é o que deixa a esteira retomar de onde parou sem refazer
 * etapa concluída. Se `etapaAtual` apontar errado, ou se "iniciar" de novo
 * zerar o que já foi feito, a retomada refaz trabalho ou pula etapa — os dois
 * são piores que não ter estado nenhum.
 */

const T = 'TSK-99998'

function emPastaTemporaria(fn: () => void) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-estado-'))
  const anterior = process.cwd()
  try {
    process.chdir(raiz)
    fs.mkdirSync(path.join('tarefas', T), { recursive: true })
    fn()
  } finally {
    process.chdir(anterior)
    fs.rmSync(raiz, { recursive: true, force: true })
  }
}

test('iniciar cria o estado em tarefas/<T>/contexto/estado.json com todas as etapas pendentes', () => {
  emPastaTemporaria(() => {
    assert.equal(lerEstado(T), undefined)
    const e = iniciarEstado(T, { cabecalho: { cliente: 'acme', sistema: 'crm' } })
    assert.equal(arquivoDeEstado(T), path.join('tarefas', T, 'contexto', 'estado.json'))
    assert.ok(fs.existsSync(arquivoDeEstado(T)))
    assert.equal(e.etapaAtual, '1')
    assert.equal(e.etapas['3.5'].status, 'pendente')
    assert.equal(e.cliente, 'acme')
    assert.deepEqual(e.gates.complementares, { status: 'pendente', aprovados: [] })
  })
})

test('concluir avança etapaAtual; iniciar de novo não apaga etapa concluída', () => {
  emPastaTemporaria(() => {
    iniciarEstado(T)
    iniciarEtapa(T, '1')
    const e = concluirEtapa(T, '1', { arquivo: 'contexto/01-tarefa.md', resumo: 'CA01..CA03 da descrição' })
    assert.equal(e.etapas['1'].status, 'concluida')
    assert.ok(e.etapas['1'].concluidaEm)
    assert.equal(e.etapaAtual, '2')

    const de_novo = iniciarEstado(T, { cabecalho: { filial: 'FILIAL TESTE' } })
    assert.equal(de_novo.etapas['1'].status, 'concluida')
    assert.equal(de_novo.etapas['1'].resumo, 'CA01..CA03 da descrição')
    assert.equal(de_novo.etapaAtual, '2')
    assert.equal(de_novo.filial, 'FILIAL TESTE')
  })
})

test('etapa bloqueada não avança etapaAtual', () => {
  emPastaTemporaria(() => {
    iniciarEstado(T)
    concluirEtapa(T, '1')
    const e = concluirEtapa(T, '2', { status: 'bloqueada', resumo: 'repo não encontrado' })
    assert.equal(e.etapaAtual, '2')
    assert.equal(e.etapas['2'].status, 'bloqueada')
  })
})

test('resumo passado à mão é cortado em 20 linhas', () => {
  emPastaTemporaria(() => {
    iniciarEstado(T)
    const longo = Array.from({ length: 30 }, (_, i) => `linha ${i + 1}`).join('\n')
    const r = concluirEtapa(T, '1', { resumo: longo }).etapas['1'].resumo!.split('\n')
    assert.equal(MAX_LINHAS_RESUMO, 20)
    assert.equal(r.length, MAX_LINHAS_RESUMO + 1)
    assert.equal(r[MAX_LINHAS_RESUMO - 1], 'linha 20')
    assert.match(r.at(-1)!, /10 linhas cortadas/)
  })
})

test('sem --resumo, o resumo sai do "## Resumo" do arquivo — igual ao arquivo', () => {
  emPastaTemporaria(() => {
    iniciarEstado(T)
    const md = '# Análise de código\r\n\r\n## Resumo\r\n\r\n- mergeada: sim\r\n- ref: origin/develop\r\n\r\n## Arquivos alterados\r\n- a.vue\r\n'
    fs.mkdirSync(path.join('tarefas', T, 'contexto'), { recursive: true })
    fs.writeFileSync(path.join('tarefas', T, 'contexto', '02-codigo.md'), md)
    assert.equal(extrairResumo(md), '- mergeada: sim\n- ref: origin/develop')
    const e = concluirEtapa(T, '2', { arquivo: 'contexto/02-codigo.md' })
    assert.equal(e.etapas['2'].resumo, '- mergeada: sim\n- ref: origin/develop')
  })
})

test('"## Resumo" ausente ou acima de 20 linhas é erro, não corte silencioso', () => {
  emPastaTemporaria(() => {
    iniciarEstado(T)
    const ctx = path.join('tarefas', T, 'contexto')
    fs.mkdirSync(ctx, { recursive: true })
    fs.writeFileSync(path.join(ctx, '01-tarefa.md'), '# TSK\n\n## Critérios de aceite\n')
    assert.throws(() => concluirEtapa(T, '1', { arquivo: 'contexto/01-tarefa.md' }), /não abre com "## Resumo"/)
    const longo = Array.from({ length: 21 }, (_, i) => `- ${i}`).join('\n')
    fs.writeFileSync(path.join(ctx, '01-tarefa.md'), `# TSK\n\n## Resumo\n${longo}\n\n## Outro\n`)
    assert.throws(() => concluirEtapa(T, '1', { arquivo: 'contexto/01-tarefa.md' }), /21 linhas/)
    assert.equal(lerEstado(T)!.etapas['1'].status, 'pendente')
  })
})

test('gate dos complementares grava a resposta: todos, nenhum ou IDs', () => {
  emPastaTemporaria(() => {
    iniciarEstado(T)
    assert.deepEqual(
      registrarGateComplementares(T, { resposta: 'todos', propostos: ['CX01', 'cx02'] }).gates.complementares.aprovados,
      ['CX01', 'CX02'],
    )
    assert.deepEqual(registrarGateComplementares(T, { resposta: 'nenhum' }).gates.complementares.aprovados, [])
    const g = registrarGateComplementares(T, { resposta: 'CX01, CX03' }).gates.complementares
    assert.deepEqual(g, { status: 'respondido', aprovados: ['CX01', 'CX03'], resposta: 'CX01, CX03' })
    assert.throws(() => registrarGateComplementares(T, { resposta: 'todos' }), /propostos/)
    assert.throws(() => registrarGateComplementares(T, { resposta: 'talvez' }))
  })
})

test('gate do achado só aceita reprova ou achado', () => {
  emPastaTemporaria(() => {
    iniciarEstado(T)
    const g = registrarGateAchado(T, { resposta: 'achado', cenario: 'CX02' }).gates.achado
    assert.deepEqual(g, { status: 'respondido', resposta: 'achado', cenario: 'CX02' })
    assert.throws(() => registrarGateAchado(T, { resposta: 'aprova' as 'achado' }))
    assert.equal(registrarGateAchado(T, { naoAplica: true }).gates.achado.status, 'nao-aplica')
  })
})

test('reteste: acrescenta R0–R5 sem mexer nas etapas do testar; nova rodada zera só o reteste', () => {
  emPastaTemporaria(() => {
    iniciarEstado(T)
    concluirEtapa(T, '1', { resumo: 'CAs' })
    registrarGateAchado(T, { resposta: 'reprova', cenario: 'CX01' })

    let e = iniciarEstado(T, { fluxo: 'reteste', cabecalho: { tarefaQA: 'QA02' } })
    assert.equal(e.etapaAtual, 'R0')
    assert.equal(e.etapas['1'].status, 'concluida')
    e = concluirEtapa(T, 'R0')
    assert.equal(e.etapaAtual, 'R1')

    e = iniciarEstado(T, { fluxo: 'reteste', novaRodada: true, cabecalho: { tarefaQA: 'QA03' } })
    assert.equal(e.etapas.R0.status, 'pendente')
    assert.equal(e.etapaAtual, 'R0')
    assert.equal(e.gates.achado.status, 'pendente')
    assert.equal(e.etapas['1'].status, 'concluida')
    assert.equal(e.tarefaQA, 'QA03')
  })
})

test('etapa desconhecida e estado inexistente dão erro claro', () => {
  emPastaTemporaria(() => {
    assert.throws(() => concluirEtapa(T, '1'), /iniciar/)
    iniciarEstado(T)
    assert.throws(() => concluirEtapa(T, '12'), /desconhecida/)
  })
})

test('pendências entram e saem; mostrar traz etapaAtual, resumos e gates', () => {
  emPastaTemporaria(() => {
    iniciarEstado(T)
    concluirEtapa(T, '1', { arquivo: 'contexto/01-tarefa.md', resumo: 'CA01 e CA02' })
    adicionarPendencia(T, 'confirmar filial com o QA')
    adicionarPendencia(T, 'massa da RC 10220')
    assert.deepEqual(resolverPendencia(T, 0).pendencias, ['massa da RC 10220'])

    const texto = descreverEstado(lerEstado(T)!)
    assert.match(texto, />>> etapaAtual: 2 <<</)
    assert.match(texto, /CA01 e CA02/)
    assert.match(texto, /Gate complementares: pendente/)
    assert.match(texto, /massa da RC 10220/)
  })
})
