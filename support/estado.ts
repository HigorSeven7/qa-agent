import fs from 'node:fs'
import path from 'node:path'
import { arquivoDeEstado, pastaDaTarefa } from './caminhos'

/**
 * Estado da esteira de uma tarefa: `tarefas/<ID>/contexto/estado.json`.
 *
 * Oficializa o que antes se fazia à mão num `00-estado-esteira.md`: saber em
 * que etapa a esteira parou, o que cada etapa decidiu e o que eu respondi nos
 * gates — para retomar sem refazer etapa concluída e sem reler cada arquivo de
 * contexto inteiro.
 *
 * O `resumo` de uma etapa é curto de propósito (no máximo `MAX_LINHAS_RESUMO`):
 * decisões, IDs, refs e riscos. O detalhe continua no arquivo da etapa.
 *
 * Contrato de passagem entre etapas: todo arquivo de contexto (01, 02, 03, 03b,
 * 04, 04b, 05) abre com `## Resumo`. Ao concluir com `arquivo` e sem `resumo`,
 * o resumo é copiado dessa seção — arquivo e estado.json ficam iguais.
 *
 * Todo caminho sai de `support/caminhos.ts`, relativo à raiz do projeto.
 */

export type StatusEtapa = 'pendente' | 'em-andamento' | 'concluida' | 'bloqueada'
export type Fluxo = 'testar-tarefa' | 'reteste'

export interface EstadoEtapa {
  status: StatusEtapa
  arquivo?: string
  resumo?: string
  concluidaEm?: string
}

/** `pendente` = ainda não perguntado; `respondido` = tenho a resposta; `nao-aplica` = o gate não disparou. */
export type StatusGate = 'pendente' | 'respondido' | 'nao-aplica'

export interface GateComplementares {
  status: StatusGate
  /** `CX` que eu aprovei — só estes viram spec. */
  aprovados: string[]
  /** A resposta literal: "todos", "nenhum" ou os IDs. */
  resposta?: string
}

export interface GateAchado {
  status: StatusGate
  resposta?: 'reprova' | 'achado'
  /** Qual complementar levou ao gate. */
  cenario?: string
}

export interface EstadoEsteira {
  tarefa: string
  cliente?: string
  sistema?: string
  filial?: string
  ambiente?: string
  baseURL?: string
  tarefaQA?: string
  branch?: string
  refSeletor?: string
  comandoDiff?: string
  etapaAtual: string
  etapas: Record<string, EstadoEtapa>
  gates: { complementares: GateComplementares; achado: GateAchado }
  pendencias: string[]
  atualizadoEm: string
}

/** Etapas do `/testar-tarefa`, na ordem — os IDs são os títulos do comando. */
export const ETAPAS_TESTAR = ['1', '2', '3', '3.5', '4', '5', '6', '7', '8', '8.4', '8.5', '9', '10', '11']

/** Passos do `/reteste`, prefixados com R para não colidir com os do testar. */
export const ETAPAS_RETESTE = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5']

export const MAX_LINHAS_RESUMO = 20

export const CAMPOS_CABECALHO = [
  'cliente',
  'sistema',
  'filial',
  'ambiente',
  'baseURL',
  'tarefaQA',
  'branch',
  'refSeletor',
  'comandoDiff',
] as const

export type Cabecalho = Partial<Pick<EstadoEsteira, (typeof CAMPOS_CABECALHO)[number]>>

const ordemDe = (fluxo: Fluxo) => (fluxo === 'reteste' ? ETAPAS_RETESTE : ETAPAS_TESTAR)
const fluxoDaEtapa = (id: string): Fluxo => (ETAPAS_RETESTE.includes(id) ? 'reteste' : 'testar-tarefa')

export function lerEstado(tarefa: string): EstadoEsteira | undefined {
  const arquivo = arquivoDeEstado(tarefa)
  if (!fs.existsSync(arquivo)) return undefined
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf-8')) as EstadoEsteira
  } catch (e) {
    throw new Error(`${arquivo} não é um JSON válido: ${(e as Error).message}`)
  }
}

function gravar(estado: EstadoEsteira): EstadoEsteira {
  estado.atualizadoEm = new Date().toISOString()
  const arquivo = arquivoDeEstado(estado.tarefa)
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  fs.writeFileSync(arquivo, JSON.stringify(estado, null, 2) + '\n', 'utf-8')
  return estado
}

function exigir(tarefa: string): EstadoEsteira {
  const estado = lerEstado(tarefa)
  if (!estado) throw new Error(`${tarefa}: estado.json não existe — rode "iniciar" primeiro`)
  return estado
}

function validarEtapa(id: string) {
  if (!ETAPAS_TESTAR.includes(id) && !ETAPAS_RETESTE.includes(id)) {
    throw new Error(`etapa "${id}" desconhecida — use ${ETAPAS_TESTAR.join(', ')} ou ${ETAPAS_RETESTE.join(', ')}`)
  }
}

/**
 * Cria o estado, ou completa o cabeçalho de um que já existe. Nunca apaga
 * etapa concluída.
 *
 * `fluxo: 'reteste'` acrescenta os passos R0–R5. `novaRodada` zera esses passos
 * e o gate do achado — é o reteste da rodada seguinte (`QA02-` → `QA03-`).
 */
export function iniciarEstado(
  tarefa: string,
  op: { fluxo?: Fluxo; novaRodada?: boolean; cabecalho?: Cabecalho } = {},
): EstadoEsteira {
  const fluxo = op.fluxo ?? 'testar-tarefa'
  const existente = lerEstado(tarefa)
  const estado: EstadoEsteira = existente ?? {
    tarefa,
    etapaAtual: ordemDe(fluxo)[0],
    etapas: {},
    gates: {
      complementares: { status: 'pendente', aprovados: [] },
      achado: { status: 'pendente' },
    },
    pendencias: [],
    atualizadoEm: '',
  }

  for (const [k, v] of Object.entries(op.cabecalho ?? {})) {
    if (v !== undefined && v !== '') (estado as unknown as Record<string, unknown>)[k] = v
  }

  if (fluxo === 'reteste' && op.novaRodada) {
    for (const id of ETAPAS_RETESTE) delete estado.etapas[id]
    estado.gates.achado = { status: 'pendente' }
  }
  for (const id of ordemDe(fluxo)) estado.etapas[id] ??= { status: 'pendente' }

  if (!existente || fluxo === 'reteste') estado.etapaAtual = proximaPendente(estado, fluxo) ?? estado.etapaAtual
  return gravar(estado)
}

/** Marca a etapa como em andamento e aponta `etapaAtual` para ela. */
export function iniciarEtapa(tarefa: string, id: string): EstadoEsteira {
  validarEtapa(id)
  const estado = exigir(tarefa)
  estado.etapas[id] = { ...estado.etapas[id], status: 'em-andamento' }
  estado.etapaAtual = id
  return gravar(estado)
}

/**
 * Fecha a etapa com arquivo e resumo, e move `etapaAtual` para a próxima
 * pendente do mesmo fluxo. `bloqueada` fecha sem avançar.
 *
 * Sem `resumo` e com `arquivo` (relativo a `tarefas/<T>/`), o resumo sai da
 * seção `## Resumo` do arquivo. Seção ausente ou acima de `MAX_LINHAS_RESUMO`
 * é erro: cortar aqui deixaria o estado.json diferente do arquivo.
 */
export function concluirEtapa(
  tarefa: string,
  id: string,
  op: { arquivo?: string; resumo?: string; status?: 'concluida' | 'bloqueada' } = {},
): EstadoEsteira {
  validarEtapa(id)
  const estado = exigir(tarefa)
  const status = op.status ?? 'concluida'
  let resumo = op.resumo !== undefined ? limitarResumo(op.resumo) : estado.etapas[id]?.resumo
  if (op.resumo === undefined && op.arquivo) resumo = resumoDoArquivo(path.join(pastaDaTarefa(tarefa), op.arquivo))
  estado.etapas[id] = {
    status,
    arquivo: op.arquivo ?? estado.etapas[id]?.arquivo,
    resumo,
    concluidaEm: new Date().toISOString(),
  }
  estado.etapaAtual = status === 'bloqueada' ? id : (proximaPendente(estado, fluxoDaEtapa(id)) ?? id)
  return gravar(estado)
}

/**
 * Grava a minha resposta num gate.
 *
 * Complementares: `resposta` é "todos", "nenhum" ou os IDs ("CX01, CX03");
 * "todos" precisa de `propostos` para virar lista.
 */
export function registrarGateComplementares(
  tarefa: string,
  op: { resposta?: string; propostos?: string[]; naoAplica?: boolean },
): EstadoEsteira {
  const estado = exigir(tarefa)
  if (op.naoAplica) {
    estado.gates.complementares = { status: 'nao-aplica', aprovados: [] }
    return gravar(estado)
  }
  const resposta = (op.resposta ?? '').trim()
  let aprovados: string[]
  if (/^todos$/i.test(resposta)) {
    if (!op.propostos?.length) throw new Error('resposta "todos" precisa da lista de propostos')
    aprovados = op.propostos.map((c) => c.toUpperCase())
  } else if (/^nenhum$/i.test(resposta)) {
    aprovados = []
  } else {
    aprovados = resposta.match(/\bCX\d+\b/gi)?.map((c) => c.toUpperCase()) ?? []
    if (!aprovados.length) throw new Error(`resposta "${resposta}" não é "todos", "nenhum" nem lista de CX`)
  }
  estado.gates.complementares = { status: 'respondido', aprovados, resposta }
  return gravar(estado)
}

export function registrarGateAchado(
  tarefa: string,
  op: { resposta?: 'reprova' | 'achado'; cenario?: string; naoAplica?: boolean },
): EstadoEsteira {
  const estado = exigir(tarefa)
  if (op.naoAplica) {
    estado.gates.achado = { status: 'nao-aplica' }
  } else {
    if (op.resposta !== 'reprova' && op.resposta !== 'achado') {
      throw new Error('resposta do gate do achado é "reprova" ou "achado"')
    }
    estado.gates.achado = { status: 'respondido', resposta: op.resposta, cenario: op.cenario }
  }
  return gravar(estado)
}

export function adicionarPendencia(tarefa: string, texto: string): EstadoEsteira {
  const estado = exigir(tarefa)
  if (texto.trim()) estado.pendencias.push(texto.trim())
  return gravar(estado)
}

export function resolverPendencia(tarefa: string, indice: number): EstadoEsteira {
  const estado = exigir(tarefa)
  if (!estado.pendencias[indice]) throw new Error(`pendência ${indice} não existe`)
  estado.pendencias.splice(indice, 1)
  return gravar(estado)
}

/**
 * Corpo da seção `## Resumo` de um markdown (até o próximo título de nível 1
 * ou 2), sem linhas em branco nas pontas. `undefined` se a seção não existe.
 */
export function extrairResumo(md: string): string | undefined {
  const linhas = md.replace(/\r\n/g, '\n').split('\n')
  const i = linhas.findIndex((l) => /^##\s+Resumo\s*$/i.test(l.trim()))
  if (i < 0) return undefined
  const fim = linhas.findIndex((l, j) => j > i && /^#{1,2}\s/.test(l))
  return linhas
    .slice(i + 1, fim < 0 ? undefined : fim)
    .join('\n')
    .trim()
}

/** O `## Resumo` do arquivo, validado contra `MAX_LINHAS_RESUMO`. */
export function resumoDoArquivo(arquivo: string): string {
  if (!fs.existsSync(arquivo)) throw new Error(`${arquivo} não existe — não há de onde tirar o resumo`)
  const resumo = extrairResumo(fs.readFileSync(arquivo, 'utf-8'))
  if (!resumo) throw new Error(`${arquivo} não abre com "## Resumo" — escreva a seção ou passe --resumo`)
  const n = resumo.split('\n').length
  if (n > MAX_LINHAS_RESUMO) {
    throw new Error(`${arquivo}: "## Resumo" tem ${n} linhas — encurte para no máximo ${MAX_LINHAS_RESUMO}`)
  }
  return resumo
}

/** Corta o resumo em `MAX_LINHAS_RESUMO` linhas, avisando que cortou. */
export function limitarResumo(resumo: string): string {
  const linhas = resumo.replace(/\r\n/g, '\n').trim().split('\n')
  if (linhas.length <= MAX_LINHAS_RESUMO) return linhas.join('\n')
  return [...linhas.slice(0, MAX_LINHAS_RESUMO), `… (${linhas.length - MAX_LINHAS_RESUMO} linhas cortadas — o detalhe fica no arquivo da etapa)`].join('\n')
}

function proximaPendente(estado: EstadoEsteira, fluxo: Fluxo): string | undefined {
  return ordemDe(fluxo).find((id) => {
    const s = estado.etapas[id]?.status
    return s !== 'concluida'
  })
}

/** Texto para o chat: onde parou, o que cada etapa decidiu, gates e pendências. */
export function descreverEstado(estado: EstadoEsteira): string {
  const l: string[] = []
  l.push(`Estado da esteira — ${estado.tarefa}  (atualizado ${estado.atualizadoEm})`)
  const cab = CAMPOS_CABECALHO.filter((c) => estado[c]).map((c) => `${c}=${estado[c]}`)
  if (cab.length) l.push(cab.join('  ·  '))
  l.push('', `>>> etapaAtual: ${estado.etapaAtual} <<<`, '')

  const ids = [...ETAPAS_TESTAR, ...ETAPAS_RETESTE].filter((id) => estado.etapas[id])
  for (const id of ids) {
    const e = estado.etapas[id]
    l.push(`[${marca(e.status)}] ${id.padEnd(4)} ${e.status}${e.arquivo ? `  → ${e.arquivo}` : ''}`)
    if (e.resumo) l.push(...e.resumo.split('\n').map((r) => `        ${r}`))
  }

  const gc = estado.gates.complementares
  const ga = estado.gates.achado
  l.push(
    '',
    `Gate complementares: ${gc.status}${gc.resposta ? ` — "${gc.resposta}"` : ''}${gc.aprovados.length ? ` → ${gc.aprovados.join(', ')}` : ''}`,
    `Gate do achado:      ${ga.status}${ga.resposta ? ` — ${ga.resposta}` : ''}${ga.cenario ? ` (${ga.cenario})` : ''}`,
  )
  if (estado.pendencias.length) {
    l.push('', 'Pendências:', ...estado.pendencias.map((p, i) => `  ${i}. ${p}`))
  }
  return l.join('\n')
}

function marca(s: StatusEtapa): string {
  return s === 'concluida' ? 'x' : s === 'em-andamento' ? '>' : s === 'bloqueada' ? '!' : ' '
}
