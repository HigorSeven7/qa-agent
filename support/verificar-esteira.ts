import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { MAX_LINHAS_RESUMO, extrairResumo } from './estado'

/**
 * Autoverificação da esteira (etapa 11 do `/testar-tarefa`) — a parte que dá
 * para provar lendo arquivo.
 *
 * Cada item volta como OK, FALHA, AVISO ou MANUAL. MANUAL é o que só humano ou
 * LLM confere (filial, eco antes da escrita, print sem senha, comentário
 * publicado). AVISO chama atenção sem reprovar a autoverificação.
 * O script não substitui a checklist: tira dela o que é mecânico, para o agente
 * gastar atenção só no que exige julgamento.
 *
 * Tudo é lido a partir de `raiz` (a raiz do projeto), para o teste unitário
 * rodar numa pasta sintética.
 */

export type StatusItem = 'OK' | 'FALHA' | 'AVISO' | 'MANUAL'

export interface ItemVerificado {
  status: StatusItem
  item: string
  detalhe?: string
}

/** Diff de `docs/massa-em-hmlg.md` contra o HEAD. `null` = git indisponível. */
export interface DiffMassa {
  /** Saída de `git diff --unified=0 HEAD -- docs/massa-em-hmlg.md`. */
  diff: string
  /** Quantidade de linhas do arquivo no HEAD. */
  linhasNoHead: number
}

export interface OpcoesVerificacao {
  raiz: string
  tarefa: string
  /** Injetável no teste. Omitido: lê do git em `raiz`. */
  diffMassa?: DiffMassa | null
}

const ARQUIVO_MASSA = 'docs/massa-em-hmlg.md'

/** Arquivos de contexto que abrem com `## Resumo` (contrato de passagem entre etapas). */
export const ARQUIVOS_COM_RESUMO = [
  '01-tarefa.md',
  '02-codigo.md',
  '03-mapa-seletores.md',
  '03b-inventario-acoes.md',
  '04-plano.md',
  '04b-preparo-ambiente.md',
  '05-execucao.md',
]

/** Acima disto, o arquivo de contexto provavelmente está copiando o que devia resumir. */
export const LIMITE_KB_CONTEXTO = 25
const VEREDITOS = ['APROVADO', 'REPROVADO', 'BLOQUEADO', 'LIBERADA SEM TESTE']

/** O que a checklist da etapa 11 tem e só humano/LLM confere. */
export const ITENS_MANUAIS = [
  'Cliente e sistema identificados com fonte explícita (não assumidos pelo padrão)',
  'Nenhum cenário obrigatório nasceu fora dos CA0N',
  'CA0N [inferido do diff], se houver, saiu em destaque no comentário do ClickUp',
  '03b cobre tudo que o diff tocou',
  'Acessos concedidos antes da exploração, na filial de teste do CLAUDE.md, com npm run auth próprio',
  'Nenhum dado de produção usado como massa; massa nova, aleatória e prefixada QA-<TAREFA>-…',
  'Massa dentro das quatro travas (≤ 20 · nada global · dado sintético · eco antes da 1ª escrita)',
  'BLOQUEADO: tentativas de destrave registradas em 04b e citadas no comentário',
  'Nada configurado à mão no preparo era o que um CA0N pedia que o sistema fizesse',
  'Nenhuma configuração de raio global ou compartilhado mexida sem autorização',
  'Complementares implementados = exatamente os aprovados na etapa 6',
  'URL testada é a do par cliente+sistema em config/clientes.json',
  'PDF gerado pelo /evidencia (não montado à mão)',
  'Todos os comentários e anexos da tarefa foram lidos',
  'Comando de diff bate com o estado da branch (mergeada → merge commit; aberta → three-dot)',
  'Todo seletor usado existe no mapa e foi confirmado na tela e na ref no ar',
  'Suíte rodou até o fim em hmlg',
  'Nenhum print contém senha, token ou dado real de cliente',
  'Comentário nas duas tarefas · evidência anexada na QA · nenhuma coluna alterada, nenhuma tarefa criada',
  'npm run typecheck passa',
]

export function verificarEsteira(op: OpcoesVerificacao): ItemVerificado[] {
  const { raiz, tarefa } = op
  const pastaTarefa = path.join(raiz, 'tarefas', tarefa)
  const contexto = path.join(pastaTarefa, 'contexto')
  const itens: ItemVerificado[] = []
  const add = (status: StatusItem, item: string, detalhe?: string) =>
    itens.push({ status, item, detalhe })

  if (!fs.existsSync(pastaTarefa)) {
    add('FALHA', 'pasta da tarefa', `${path.relative(raiz, pastaTarefa)} não existe`)
    return itens
  }

  const ler = (nome: string) => lerSeExistir(path.join(contexto, nome))
  const t01 = ler('01-tarefa.md')
  const t02 = ler('02-codigo.md')
  const t03b = ler('03b-inventario-acoes.md')
  const t04 = ler('04-plano.md')

  // ── arquivos obrigatórios ────────────────────────────────────────────────
  const faltando = [
    '01-tarefa.md',
    '02-codigo.md',
    '03-mapa-seletores.md',
    '03b-inventario-acoes.md',
    '04-plano.md',
  ].filter((n) => !fs.existsSync(path.join(contexto, n)))
  if (!fs.existsSync(path.join(pastaTarefa, 'alvo.json'))) faltando.push('alvo.json')
  add(
    faltando.length ? 'FALHA' : 'OK',
    'arquivos de contexto (01, 02, 03, 03b, 04, alvo.json)',
    faltando.length ? `faltando: ${faltando.join(', ')}` : undefined,
  )

  // ── contrato "## Resumo" + tamanho ─────────────────────────────────────
  verificarResumos(contexto, add)

  // ── 04b ou preparo "nenhum" ──────────────────────────────────────────────
  if (fs.existsSync(path.join(contexto, '04b-preparo-ambiente.md'))) {
    add('OK', '04b-preparo-ambiente.md existe (ou preparo "nenhum")')
  } else if (t01 && dizNenhum(secao(t01, /acessos necess/i)) && dizNenhum(secao(t01, /dados de produ/i))) {
    add('OK', '04b-preparo-ambiente.md existe (ou preparo "nenhum")', 'preparo "nenhum" no 01')
  } else {
    add(
      'FALHA',
      '04b-preparo-ambiente.md existe (ou preparo "nenhum")',
      'sem 04b, e o 01 não diz "nenhum" em Acessos necessários + Dados de produção citados',
    )
  }

  // ── CA0N no 01 ───────────────────────────────────────────────────────────
  const cas = t01 ? idsDeCA(secao(t01, /crit[ée]rios de aceite/i) ?? '') : []
  if (!t01) add('FALHA', '01 tem "## Critérios de aceite" com CA0N', '01-tarefa.md ausente')
  else if (!cas.length) add('FALHA', '01 tem "## Critérios de aceite" com CA0N', 'nenhum CA0N na seção')
  else add('OK', '01 tem "## Critérios de aceite" com CA0N', `${cas.length} CAs`)

  // ── matriz CA → CT ───────────────────────────────────────────────────────
  const matriz = t04 ? matrizCaCt(t04) : new Map<string, Set<string>>()
  if (!t04) {
    add('FALHA', 'todo CA0N na matriz CA → CT do 04 com ≥ 1 CT', '04-plano.md ausente')
  } else if (cas.length) {
    const semCt = cas.filter((ca) => !(matriz.get(ca)?.size))
    add(
      semCt.length ? 'FALHA' : 'OK',
      'todo CA0N na matriz CA → CT do 04 com ≥ 1 CT',
      semCt.length ? `sem CT: ${semCt.join(', ')}` : undefined,
    )
  }

  // ── 02 ───────────────────────────────────────────────────────────────────
  if (!t02) {
    add('FALHA', '02 registra comando de diff e ref lida, e não está vazio', '02-codigo.md ausente')
  } else {
    const cabecalho = t02.split(/\r?\n/).slice(0, 60).join('\n')
    const problemas: string[] = []
    if (t02.replace(/\s/g, '').length < 300) problemas.push('conteúdo quase vazio')
    if (!/git\b[^\n]*\bdiff\b|\bdiffs? usad/i.test(cabecalho)) problemas.push('comando de diff não achado no cabeçalho')
    if (!/\bref\b[^\n]{0,25}(lida|no ar)/i.test(cabecalho)) problemas.push('ref lida não achada no cabeçalho')
    add(
      problemas.length ? 'FALHA' : 'OK',
      '02 registra comando de diff e ref lida, e não está vazio',
      problemas.join('; ') || undefined,
    )
  }

  // ── código gerado ────────────────────────────────────────────────────────
  const specs = arquivosTs(path.join(pastaTarefa, 'specs'))
  const pages = arquivosTs(path.join(raiz, 'pages'))
  const comTimeout = ocorrencias([...specs, ...pages], /\.waitForTimeout\s*\(/, raiz)
  add(
    comTimeout.length ? 'FALHA' : 'OK',
    'zero waitForTimeout em tarefas/<T>/specs e pages/',
    comTimeout.slice(0, 5).join(', ') || undefined,
  )

  const comImport = specs.flatMap((a) =>
    linhasComImportDeTestOuExpect(fs.readFileSync(a, 'utf-8')).map(
      (n) => `${path.relative(raiz, a).replace(/\\/g, '/')}:${n}`,
    ),
  )
  add(
    comImport.length ? 'FALHA' : 'OK',
    "zero import de test/expect de '@playwright/test' nos specs da tarefa",
    comImport.slice(0, 5).join(', ') || undefined,
  )

  // ── 03b ──────────────────────────────────────────────────────────────────
  if (!t03b) {
    add('FALHA', '03b sem "nenhum" na coluna de efeito', '03b-inventario-acoes.md ausente')
  } else {
    const linhas = efeitosNenhum(t03b)
    add(
      linhas.length ? 'FALHA' : 'OK',
      '03b sem "nenhum" na coluna de efeito',
      linhas.length ? `"nenhum" nas linhas ${linhas.slice(0, 8).join(', ')} — deve ser "não observado"` : undefined,
    )
  }

  // ── resultado.json ───────────────────────────────────────────────────────
  verificarResultado(pastaTarefa, t04, matriz, add)

  // ── massa-em-hmlg.md append-only ─────────────────────────────────────────
  const dm = op.diffMassa === undefined ? diffMassaDoGit(raiz) : op.diffMassa
  if (dm === null) {
    add('MANUAL', `${ARQUIVO_MASSA} só ganhou linhas ao fim`, 'git indisponível')
  } else {
    const erro = violacaoAppendOnly(dm)
    add(
      erro ? 'FALHA' : 'OK',
      `${ARQUIVO_MASSA} só ganhou linhas ao fim`,
      erro ?? (dm.diff.trim() ? undefined : 'sem alteração pendente — o que já foi comitado não é provado aqui'),
    )
  }

  // ── rascunho de veredito ─────────────────────────────────────────────────
  verificarVeredito(contexto, add)

  for (const m of ITENS_MANUAIS) add('MANUAL', m)
  return itens
}

// ───────────────────────── contrato de resumo ─────────────────────────

/**
 * Todo arquivo de contexto presente abre com `## Resumo` de até
 * `MAX_LINHAS_RESUMO` linhas. Tarefa sem `estado.json` é anterior ao contrato:
 * a falta vira AVISO. Com `estado.json`, é FALHA. Tamanho acima de
 * `LIMITE_KB_CONTEXTO` é sempre só AVISO.
 */
function verificarResumos(contexto: string, add: (s: StatusItem, i: string, d?: string) => void) {
  const presentes = ARQUIVOS_COM_RESUMO.filter((n) => fs.existsSync(path.join(contexto, n)))
  const tarefaNova = fs.existsSync(path.join(contexto, 'estado.json'))
  const item = `arquivos de contexto abrem com "## Resumo" (≤ ${MAX_LINHAS_RESUMO} linhas)`

  const problemas: string[] = []
  for (const n of presentes) {
    const resumo = extrairResumo(fs.readFileSync(path.join(contexto, n), 'utf-8'))
    const linhas = resumo?.split('\n').length ?? 0
    if (!resumo) problemas.push(`${n} sem a seção`)
    else if (linhas > MAX_LINHAS_RESUMO) problemas.push(`${n} com ${linhas} linhas`)
  }
  if (!problemas.length) add('OK', item, presentes.length ? undefined : 'nenhum arquivo de contexto ainda')
  else if (tarefaNova) add('FALHA', item, problemas.join('; '))
  else add('AVISO', item, `${problemas.join('; ')} — tarefa sem estado.json, anterior ao contrato`)

  const grandes = presentes
    .map((n) => ({ n, kb: fs.statSync(path.join(contexto, n)).size / 1024 }))
    .filter((a) => a.kb > LIMITE_KB_CONTEXTO)
  add(
    grandes.length ? 'AVISO' : 'OK',
    `arquivos de contexto até ${LIMITE_KB_CONTEXTO} KB`,
    grandes.map((a) => `${a.n} ${a.kb.toFixed(0)} KB`).join(', ') || undefined,
  )
}

// ───────────────────────── resultado.json ─────────────────────────

interface CenarioResultado {
  cenario: string
  passos?: { arquivo?: string }[]
}

function verificarResultado(
  pastaTarefa: string,
  t04: string | undefined,
  matriz: Map<string, Set<string>>,
  add: (s: StatusItem, i: string, d?: string) => void,
) {
  const arquivo = path.join(pastaTarefa, 'evidencias', 'resultado.json')
  if (!fs.existsSync(arquivo)) {
    add('FALHA', 'resultado.json existe', 'tarefas/<T>/evidencias/resultado.json ausente')
    return
  }
  let r: { evidenciaOficial?: boolean; cenariosDeOutraExecucao?: string[]; cenarios?: CenarioResultado[] }
  try {
    r = JSON.parse(fs.readFileSync(arquivo, 'utf-8'))
  } catch (e) {
    add('FALHA', 'resultado.json existe', `JSON inválido: ${(e as Error).message}`)
    return
  }
  add('OK', 'resultado.json existe')

  const porId = new Map((r.cenarios ?? []).map((c) => [c.cenario.toUpperCase(), c]))
  const temPrint = (c: CenarioResultado) => (c.passos ?? []).some((p) => p.arquivo)

  const cts = [...new Set([...matriz.values()].flatMap((s) => [...s]))].sort(porNumero)
  const semEntrada = cts.filter((ct) => !porId.has(ct))
  const semPrint = cts.filter((ct) => porId.has(ct) && !temPrint(porId.get(ct)!))
  const problemas: string[] = []
  if (semEntrada.length) problemas.push(`sem entrada: ${semEntrada.join(', ')}`)
  if (semPrint.length) problemas.push(`sem print: ${semPrint.join(', ')}`)
  add(
    problemas.length ? 'FALHA' : 'OK',
    'todo CT da matriz tem entrada e print no resultado.json',
    problemas.join('; ') || (cts.length ? `${cts.length} CTs` : undefined),
  )

  const cxsPlano = t04 ? [...new Set(t04.match(/\bCX\d+\b/g) ?? [])].sort(porNumero) : []
  const cxsSemPrint = [...porId.keys()].filter((id) => /^CX\d+$/.test(id) && !temPrint(porId.get(id)!))
  if (cxsSemPrint.length) {
    add('FALHA', 'todo CX executado tem print', `sem print: ${cxsSemPrint.join(', ')}`)
  } else if (porId.size && [...porId.keys()].some((id) => id.startsWith('CX'))) {
    add('OK', 'todo CX executado tem print')
  }
  const cxsForaDoResultado = cxsPlano.filter((cx) => !porId.has(cx))
  if (cxsForaDoResultado.length) {
    add(
      'MANUAL',
      'CX do plano sem entrada no resultado.json',
      `${cxsForaDoResultado.join(', ')} — confira se não foram aprovados na etapa 6`,
    )
  }

  add(
    r.evidenciaOficial === false ? 'FALHA' : 'OK',
    'evidenciaOficial = true (execução em hmlg)',
    r.evidenciaOficial === false ? 'execução fora de hmlg — evidência não oficial, sinalizar no comentário' : undefined,
  )

  const velhos = r.cenariosDeOutraExecucao ?? []
  add(
    velhos.length ? 'FALHA' : 'OK',
    'todo cenário do resultado.json é da última execução',
    velhos.length ? `de execução anterior: ${velhos.join(', ')}` : undefined,
  )
}

// ───────────────────────── veredito ─────────────────────────

function verificarVeredito(contexto: string, add: (s: StatusItem, i: string, d?: string) => void) {
  const item = 'rascunho de veredito: um dos quatro, sem "com ressalva"'
  const rascunhos = fs.existsSync(contexto)
    ? fs.readdirSync(contexto).filter((n) => /\.(md|txt)$/i.test(n) && /(veredito|rascunho|^comentario-)/i.test(n))
    : []
  if (!rascunhos.length) {
    add('MANUAL', item, 'nenhum rascunho salvo em contexto/ — confira o texto publicado')
    return
  }
  const problemas: string[] = []
  for (const nome of rascunhos) {
    const texto = fs.readFileSync(path.join(contexto, nome), 'utf-8')
    const linhas = texto.split(/\r?\n/).filter((l) => /veredito sugerido\s*:/i.test(l))
    if (!linhas.length) problemas.push(`${nome}: sem "Veredito sugerido:"`)
    for (const l of linhas) {
      const valor = l.split(/veredito sugerido\s*:/i)[1].replace(/[*`_]/g, '').trim().toUpperCase()
      if (!VEREDITOS.some((v) => valor.startsWith(v))) problemas.push(`${nome}: veredito fora dos quatro ("${valor.slice(0, 40)}")`)
      if (/com ressalva/i.test(l)) problemas.push(`${nome}: "com ressalva" não existe`)
    }
  }
  add(problemas.length ? 'FALHA' : 'OK', item, problemas.join('; ') || rascunhos.join(', '))
}

// ───────────────────────── massa-em-hmlg ─────────────────────────

function diffMassaDoGit(raiz: string): DiffMassa | null {
  try {
    const git = (...a: string[]) =>
      execFileSync('git', ['-C', raiz, ...a], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
    const head = git('show', `HEAD:${ARQUIVO_MASSA}`)
    const diff = git('diff', '--unified=0', 'HEAD', '--', ARQUIVO_MASSA)
    return { diff, linhasNoHead: head.split(/\r?\n/).length - (head.endsWith('\n') ? 1 : 0) }
  } catch {
    return null
  }
}

/**
 * Devolve o motivo da violação, ou `undefined` se o diff só acrescenta linhas
 * ao fim. Tolera o caso "última linha sem quebra ganhou quebra": o git mostra
 * a última linha removida e readicionada igual.
 */
export function violacaoAppendOnly({ diff, linhasNoHead }: DiffMassa): string | undefined {
  const hunks = diff.split(/\r?\n(?=@@ )/).filter((h) => h.startsWith('@@ '))
  for (const h of hunks) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/.exec(h)
    if (!m) continue
    const inicio = Number(m[1])
    const qtd = m[2] === undefined ? 1 : Number(m[2])
    const linhas = h.split(/\r?\n/).slice(1)
    const removidas = linhas.filter((l) => l.startsWith('-')).map((l) => l.slice(1).trimEnd())
    const adicionadas = linhas.filter((l) => l.startsWith('+')).map((l) => l.slice(1).trimEnd())

    if (qtd === 0) {
      // inserção pura: `inicio` é a linha depois da qual entra o texto novo
      if (inicio < linhasNoHead) return `linha inserida no meio (depois da linha ${inicio} de ${linhasNoHead})`
      continue
    }
    const soQuebraFinal =
      inicio + qtd - 1 === linhasNoHead && removidas.every((r, i) => adicionadas[i] === r)
    if (!soQuebraFinal) return `linha antiga alterada ou removida (linha ${inicio})`
  }
  return undefined
}

// ───────────────────────── markdown ─────────────────────────

function lerSeExistir(arquivo: string): string | undefined {
  return fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf-8') : undefined
}

/** Corpo da primeira seção cujo título casa, até o próximo título de nível ≤. */
export function secao(md: string, titulo: RegExp): string | undefined {
  const linhas = md.split(/\r?\n/)
  const i = linhas.findIndex((l) => /^#{1,6}\s/.test(l) && titulo.test(l))
  if (i < 0) return undefined
  const nivel = /^#+/.exec(linhas[i])![0].length
  const fim = linhas.findIndex((l, j) => j > i && /^#{1,6}\s/.test(l) && /^#+/.exec(l)![0].length <= nivel)
  return linhas.slice(i + 1, fim < 0 ? undefined : fim).join('\n')
}

/** A seção começa dizendo "nenhum"/"nenhuma" (primeira linha com texto). */
function dizNenhum(corpo: string | undefined): boolean {
  const primeira = corpo?.split(/\r?\n/).find((l) => l.trim())
  return !!primeira && /^[\s>*_\-|`]*nenhum/i.test(primeira)
}

function celulas(linha: string): string[] {
  return linha.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
}

function limpar(celula: string): string {
  return celula.replace(/[*`_~]/g, '').trim()
}

const ehLinhaTabela = (l: string) => /^\s*\|/.test(l)
const ehSeparador = (l: string) => /^\s*\|[\s:|-]+$/.test(l) && l.includes('---')

/** IDs `CA0N` das linhas de tabela, na ordem, sem repetir. */
export function idsDeCA(texto: string): string[] {
  const ids: string[] = []
  for (const l of texto.split(/\r?\n/)) {
    if (!ehLinhaTabela(l)) continue
    const id = limpar(celulas(l)[0] ?? '')
    if (/^CA\d+$/i.test(id) && !ids.includes(id.toUpperCase())) ids.push(id.toUpperCase())
  }
  return ids
}

/** CA → CTs, somando todas as matrizes do plano. */
export function matrizCaCt(t04: string): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>()
  for (const l of t04.split(/\r?\n/)) {
    if (!ehLinhaTabela(l)) continue
    const cs = celulas(l)
    const ca = limpar(cs[0] ?? '').toUpperCase()
    if (!/^CA\d+$/.test(ca)) continue
    const cts = cs.slice(1).join(' ').match(/\bCT\d+[a-z]?\b/gi) ?? []
    const set = m.get(ca) ?? new Set<string>()
    for (const ct of cts) set.add(ct.toUpperCase())
    m.set(ca, set)
  }
  return m
}

/**
 * Números de linha (1-based) do 03b onde uma coluna de efeito diz só "nenhum".
 * As colunas são achadas pelo cabeçalho de cada tabela ("Efeito observado",
 * "Efeito colateral", "Efeito"), porque o formato varia entre tarefas.
 */
export function efeitosNenhum(t03b: string): number[] {
  const linhas = t03b.split(/\r?\n/)
  const achadas: number[] = []
  let colunas: number[] = []
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]
    if (!ehLinhaTabela(l)) {
      colunas = []
      continue
    }
    if (i + 1 < linhas.length && ehSeparador(linhas[i + 1])) {
      colunas = celulas(l)
        .map((c, j) => (/^efeito/i.test(limpar(c)) ? j : -1))
        .filter((j) => j >= 0)
      i++
      continue
    }
    const cs = celulas(l)
    if (colunas.some((j) => /^nenhum[a]?\.?$/i.test(limpar(cs[j] ?? '')))) achadas.push(i + 1)
  }
  return achadas
}

// ───────────────────────── código ─────────────────────────

function arquivosTs(pasta: string): string[] {
  if (!fs.existsSync(pasta)) return []
  const saida: string[] = []
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, e.name)
    if (e.isDirectory()) saida.push(...arquivosTs(p))
    else if (e.name.endsWith('.ts')) saida.push(p)
  }
  return saida
}

/** `arquivo:linha` de cada ocorrência fora de comentário. */
function ocorrencias(arquivos: string[], padrao: RegExp, raiz: string): string[] {
  const achadas: string[] = []
  for (const a of arquivos) {
    fs.readFileSync(a, 'utf-8')
      .split(/\r?\n/)
      .forEach((l, i) => {
        const t = l.trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
        if (padrao.test(l)) achadas.push(`${path.relative(raiz, a).replace(/\\/g, '/')}:${i + 1}`)
      })
  }
  return achadas
}

/**
 * Linhas (1-based) onde `test` ou `expect` vêm de '@playwright/test'.
 *
 * Import só de tipo (`Page`, `Locator`, `Browser`) é permitido: a regra do
 * CLAUDE.md é sobre `test`/`expect`, que precisam vir de `support/teste` para o
 * modo acompanhamento valer. A mesma lógica está em `.claude/scripts/guarda-spec.ts`.
 */
export function linhasComImportDeTestOuExpect(texto: string): number[] {
  const linhas: number[] = []
  const linhaDe = (i: number) => texto.slice(0, i).split('\n').length
  // a cláusula não atravessa aspas: sem isso, num código sem `;`, o match
  // começaria no import anterior e engoliria o `from 'outro-modulo'` dele
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
    if (fora || nomes.some((n) => n === 'test' || n === 'expect')) linhas.push(linhaDe(m.index))
  }
  const req = /require\(\s*['"]@playwright\/test['"]\s*\)/g
  for (let m = req.exec(texto); m; m = req.exec(texto)) linhas.push(linhaDe(m.index))
  return linhas
}

function porNumero(a: string, b: string): number {
  return Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')) || a.localeCompare(b)
}

export function formatar(itens: ItemVerificado[]): string {
  const largura = Math.max(...itens.map((i) => i.status.length))
  return itens
    .map((i) => `${i.status.padEnd(largura)}  ${i.item}${i.detalhe ? ` — ${i.detalhe}` : ''}`)
    .join('\n')
}
