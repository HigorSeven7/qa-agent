/**
 * Lógica pura do medidor de custo por sessão do Claude Code.
 *
 * Não lê disco: recebe o texto dos .jsonl já carregados e devolve a agregação.
 * Fica separado de `scripts/medir-custo.ts` para o teste unitário importar só
 * isto (o CLI resolve caminho e grava arquivo).
 *
 * Formato real do histórico (conferido na pasta de projetos do Claude Code):
 * - só linhas `type: "assistant"` trazem `message.usage`;
 * - o modelo vem em `message.model` — `<synthetic>` é mensagem gerada pelo
 *   próprio CLI, sem custo, e fica fora;
 * - com streaming a mesma resposta aparece em várias linhas com o mesmo
 *   `message.id` (reserva: `requestId`). input e cache se repetem iguais e o
 *   `output_tokens` cresce — conta input/cache uma vez e o output pelo MAIOR.
 */

export const AGENTES_CONHECIDOS = [
  'principal',
  'qa-analista',
  'qa-explorador',
  'qa-implementador',
  'qa-revisor',
  'outros',
] as const

export type Agente = (typeof AGENTES_CONHECIDOS)[number]

export interface Tokens {
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}

export interface LinhaAgregada extends Tokens {
  agente: Agente
  modelo: string
}

/** Um arquivo .jsonl já lido, com o tipo de agente que o gerou. */
export interface FonteSessao {
  /** `principal` para o .jsonl da sessão; o `agentType` do .meta.json para subagente. */
  tipoAgente: string
  conteudo: string
}

interface Resposta extends Tokens {
  modelo: string
}

const vazio = (): Tokens => ({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 })

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** Normaliza o tipo do agente para uma das categorias da tabela. */
export function categoriaDoAgente(tipo: string | undefined): Agente {
  return tipo && (AGENTES_CONHECIDOS as readonly string[]).includes(tipo) ? (tipo as Agente) : 'outros'
}

/**
 * Lê as linhas de um .jsonl e devolve uma resposta por `message.id`, já sem
 * dupla contagem. Linha inválida é ignorada. Também devolve o
 * `attributionAgent` visto, para servir de fallback quando falta o .meta.json.
 */
export function respostasDoJsonl(conteudo: string): {
  respostas: Resposta[]
  agenteAtribuido?: string
} {
  const porId = new Map<string, Resposta>()
  let agenteAtribuido: string | undefined
  let semId = 0

  for (const bruta of conteudo.split(/\r?\n/)) {
    const linha = bruta.trim()
    if (!linha) continue
    let obj: any
    try {
      obj = JSON.parse(linha)
    } catch {
      continue
    }
    if (!obj || typeof obj !== 'object') continue
    if (!agenteAtribuido && typeof obj.attributionAgent === 'string') {
      agenteAtribuido = obj.attributionAgent
    }
    if (obj.type !== 'assistant') continue
    const msg = obj.message
    const usage = msg?.usage
    if (!usage || typeof usage !== 'object') continue
    const modelo = typeof msg.model === 'string' ? msg.model : 'desconhecido'
    if (modelo === '<synthetic>') continue

    const id: string =
      (typeof msg.id === 'string' && msg.id) ||
      (typeof obj.requestId === 'string' && obj.requestId) ||
      `sem-id-${semId++}`

    const atual: Resposta = {
      modelo,
      input: num(usage.input_tokens),
      output: num(usage.output_tokens),
      cacheWrite: num(usage.cache_creation_input_tokens),
      cacheRead: num(usage.cache_read_input_tokens),
    }
    const anterior = porId.get(id)
    if (!anterior) {
      porId.set(id, atual)
    } else {
      // input/cache se repetem entre as linhas do streaming: fica o primeiro.
      anterior.output = Math.max(anterior.output, atual.output)
    }
  }
  return { respostas: [...porId.values()], agenteAtribuido }
}

/** Agrega todas as fontes em linhas agente × modelo, ordenadas. */
export function agregar(fontes: FonteSessao[]): LinhaAgregada[] {
  const mapa = new Map<string, LinhaAgregada>()
  for (const fonte of fontes) {
    const { respostas, agenteAtribuido } = respostasDoJsonl(fonte.conteudo)
    const agente = categoriaDoAgente(fonte.tipoAgente || agenteAtribuido)
    for (const r of respostas) {
      const chave = `${agente}\u0000${r.modelo}`
      let linha = mapa.get(chave)
      if (!linha) {
        linha = { agente, modelo: r.modelo, ...vazio() }
        mapa.set(chave, linha)
      }
      linha.input += r.input
      linha.output += r.output
      linha.cacheWrite += r.cacheWrite
      linha.cacheRead += r.cacheRead
    }
  }
  const ordem = (a: Agente) => AGENTES_CONHECIDOS.indexOf(a)
  return [...mapa.values()].sort(
    (a, b) => ordem(a.agente) - ordem(b.agente) || a.modelo.localeCompare(b.modelo),
  )
}

export function totalDe(linhas: Tokens[]): Tokens {
  const t = vazio()
  for (const l of linhas) {
    t.input += l.input
    t.output += l.output
    t.cacheWrite += l.cacheWrite
    t.cacheRead += l.cacheRead
  }
  return t
}

const somaTokens = (t: Tokens) => t.input + t.output + t.cacheWrite + t.cacheRead

const fmt = (n: number) => n.toLocaleString('pt-BR')

/**
 * Tabela Markdown agente × modelo × tipo, com coluna de soma, % do total de
 * tokens e linha de total. Sem preço em dólar: tokens de tipos diferentes têm
 * pesos diferentes, e a % é sobre a soma bruta.
 */
export function tabelaMarkdown(linhas: LinhaAgregada[]): string {
  const total = totalDe(linhas)
  const somaTotal = somaTokens(total)
  const pct = (n: number) => (somaTotal ? ((n / somaTotal) * 100).toFixed(1) + '%' : '0.0%')
  const cab =
    '| Agente | Modelo | Input | Output | Cache write | Cache read | Soma | % do total |\n' +
    '|---|---|---:|---:|---:|---:|---:|---:|'
  const corpo = linhas.map((l) => {
    const s = somaTokens(l)
    return `| ${l.agente} | ${l.modelo} | ${fmt(l.input)} | ${fmt(l.output)} | ${fmt(l.cacheWrite)} | ${fmt(l.cacheRead)} | ${fmt(s)} | ${pct(s)} |`
  })
  const rodape = `| **Total** | | **${fmt(total.input)}** | **${fmt(total.output)}** | **${fmt(total.cacheWrite)}** | **${fmt(total.cacheRead)}** | **${fmt(somaTotal)}** | **100%** |`
  return [cab, ...corpo, rodape].join('\n')
}
