import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Catálogo de clientes e sistemas.
 *
 * Um cliente tem N sistemas (ex.: acme: crm, portal, api). O alvo de um
 * teste é sempre um par cliente+sistema, porque URL, credencial e repositório mudam
 * em cada um deles.
 *
 * Separação de segurança:
 *
 *   config/clientes.json  → URLs, hosts de banco, repos, perfis.  SEM SEGREDO.
 *                            O agente PODE ler: precisa saber onde navegar.
 *   .env                   → usuário e senha por cliente/sistema/perfil.
 *                            O agente NÃO lê (bloqueado em .claude/settings.json).
 *
 * Seleção em tempo de execução:
 *   CLIENTE=acme SISTEMA=crm AMBIENTE=hmlg npx playwright test
 */

export type Ambiente = 'hmlg' | 'local'

export interface AmbienteSistema {
  baseURL: string
  apiURL?: string
}

export interface Sistema {
  id: string
  clienteId: string
  clienteNome: string
  nome: string
  ambientes: Partial<Record<Ambiente, AmbienteSistema>>
  perfis: string[]
  rotaLogin: string
  repos: Record<string, string>
  branchBase: string
  requerVpn?: boolean
  /**
   * Produto que o sistema roda — decide qual fluxo de login usar
   * (support/logins/). Ausente = PRODUTO_PADRAO.
   */
  produto?: string
  db?: { server: string; database: string; producao?: boolean }
  avisos?: string[]
  prefixoEnv?: string
  /**
   * Filial a selecionar no login, para sistemas cuja tela pede filial num
   * segundo passo. Nome exatamente como aparece no <select>.
   * Não é segredo — é dado de navegação, por isso mora aqui e não no .env.
   */
  filial?: string
}

interface Catalogo {
  clientePadrao: string
  sistemaPadrao?: string
  clickup: {
    listaDevs?: string
    listaQA?: string
    /**
     * Prefixo comum a todas as rodadas de QA. O título completo é
     * `<prefixo><N>-<título da tarefa do dev>` — QA01-, QA02-, ... uma tarefa
     * por rodada, criada a cada reprovação.
     */
    prefixoTarefaQA: string
    colunaGatilhoDev: string
    /** Coluna do quadro dos devs quando o QA aprova. */
    colunaAprovadoDev?: string
    /** Coluna do quadro dos devs quando o QA reprova — volta para a fila do dev. */
    colunaReprovadoDev?: string
    colunasQA: Record<string, string>
  }
  clientes: Record<
    string,
    {
      nome: string
      clickup?: { aliases?: string[]; listaDevs?: string; listaQA?: string }
      sistemas: Record<string, Omit<Sistema, 'id' | 'clienteId' | 'clienteNome'>>
    }
  >
}

const ARQUIVO = path.join(__dirname, '..', 'config', 'clientes.json')

function carregar(): Catalogo {
  if (!fs.existsSync(ARQUIVO)) {
    throw new Error(
      `config/clientes.json não encontrado. Copie config/clientes.example.json ` +
        `para config/clientes.json e preencha.`,
    )
  }
  return JSON.parse(fs.readFileSync(ARQUIVO, 'utf-8'))
}

export const catalogo = carregar()

export function idsDeClientes(): string[] {
  return Object.keys(catalogo.clientes).filter((k) => !k.startsWith('_'))
}

export function idsDeSistemas(clienteId: string): string[] {
  return Object.keys(catalogo.clientes[clienteId]?.sistemas ?? {})
}

/** Todos os pares cliente/sistema configurados. */
export function todosOsSistemas(): Sistema[] {
  return idsDeClientes().flatMap((c) => idsDeSistemas(c).map((s) => resolverSistema(c, s)))
}

/** Resolve um cliente pelo id ou por alias do ClickUp. */
export function clienteIdDe(idOuAlias: string): string {
  const chave = idOuAlias.toLowerCase()
  if (catalogo.clientes[chave]) return chave

  const porAlias = idsDeClientes().find((k) =>
    (catalogo.clientes[k].clickup?.aliases || []).some((a) => a.toLowerCase() === chave),
  )
  if (porAlias) return porAlias

  throw new Error(
    `Cliente "${idOuAlias}" não existe em config/clientes.json. ` +
      `Disponíveis: ${idsDeClientes().join(', ')}`,
  )
}

export function resolverSistema(clienteRef: string, sistemaRef?: string): Sistema {
  const clienteId = clienteIdDe(clienteRef)
  const cli = catalogo.clientes[clienteId]
  const sistemas = idsDeSistemas(clienteId)

  if (!sistemas.length) {
    throw new Error(`Cliente "${clienteId}" não tem nenhum sistema em config/clientes.json.`)
  }

  // Sem SISTEMA explícito: só resolve sozinho se houver exatamente um.
  // Adivinhar entre "crm-a" e "crm-b" testaria o sistema errado em silêncio.
  const sistemaId = sistemaRef?.toLowerCase() ?? (sistemas.length === 1 ? sistemas[0] : undefined)

  if (!sistemaId) {
    throw new Error(
      `O cliente "${clienteId}" tem ${sistemas.length} sistemas — informe qual.\n` +
        `  SISTEMA=<id> (disponíveis: ${sistemas.join(', ')})`,
    )
  }

  const bruto = cli.sistemas[sistemaId]
  if (!bruto) {
    throw new Error(
      `Sistema "${sistemaId}" não existe para o cliente "${clienteId}". ` +
        `Disponíveis: ${sistemas.join(', ')}`,
    )
  }

  return { id: sistemaId, clienteId, clienteNome: cli.nome, ...bruto }
}

export const CLIENTE_ID = (process.env.CLIENTE || catalogo.clientePadrao).toLowerCase()
export const SISTEMA_ID = process.env.SISTEMA?.toLowerCase() || catalogo.sistemaPadrao
export const AMBIENTE: Ambiente = (process.env.AMBIENTE || 'hmlg').toLowerCase() as Ambiente

if (!['hmlg', 'local'].includes(AMBIENTE)) {
  throw new Error(`AMBIENTE inválido: "${AMBIENTE}". Use "hmlg" ou "local".`)
}

/**
 * Resolução tolerante no import: guarda o erro em vez de explodir, para que
 * `npm run doctor` consiga diagnosticar uma configuração incompleta.
 * Quem executa testes chama validarSelecao(), que relança o erro.
 */
let erroSelecao: Error | null = null
let sistemaResolvido: Sistema

try {
  sistemaResolvido = resolverSistema(CLIENTE_ID, SISTEMA_ID)
} catch (e) {
  erroSelecao = e as Error
  sistemaResolvido = {
    id: SISTEMA_ID ?? '?',
    clienteId: CLIENTE_ID,
    clienteNome: CLIENTE_ID,
    nome: '(não resolvido)',
    ambientes: {},
    perfis: [],
    rotaLogin: '/login',
    repos: {},
    branchBase: 'develop',
  }
}

export const sistema = sistemaResolvido

/** Nome legível do alvo, para log e evidência. */
export const alvo = `${sistema.clienteNome} / ${sistema.nome}`

const ambienteAtual = sistema.ambientes?.[AMBIENTE]

/**
 * Sobrepõe a URL do catálogo. Existe porque alguns ambientes de homologação são
 * catalogados pela URL que valem *dentro* do servidor (ex.: um CRM em
 * `http://localhost:8085`, acessado por área de trabalho remota), e essa URL não
 * resolve da máquina que roda o teste. O host publicado é o mesmo ambiente —
 * muda só o endereço pelo qual se chega nele.
 *
 *   BASE_URL=http://10.0.0.10:8085 CLIENTE=acme SISTEMA=crm npm test
 *
 * Registre a URL efetivamente usada na evidência: quem lê precisa saber por onde
 * o teste entrou.
 */
export const baseURL = process.env.BASE_URL?.trim() || ambienteAtual?.baseURL || ''
export const apiURL = process.env.API_URL?.trim() || ambienteAtual?.apiURL || ''

function prefixo(s: Sistema) {
  return (s.prefixoEnv || `${s.clienteId}_${s.id}`).toUpperCase().replace(/[^A-Z0-9]/g, '_')
}

export interface Credencial {
  usuario: string
  senha: string
}

/**
 * Credenciais do perfil, lidas do .env.
 * O erro diz o nome exato da variável que falta — nunca o valor.
 */
export function credenciaisDe(perfil = 'admin', s: Sistema = sistema): Credencial {
  const p = prefixo(s)
  const chaveUsuario = `${p}_${perfil.toUpperCase()}_USER`
  const chaveSenha = `${p}_${perfil.toUpperCase()}_PASS`

  const usuario = process.env[chaveUsuario]
  const senha = process.env[chaveSenha]

  if (!usuario || !senha) {
    const faltando = [!usuario && chaveUsuario, !senha && chaveSenha].filter(Boolean).join(' e ')
    throw new Error(
      `Credencial ausente para ${s.clienteNome}/${s.nome} (${perfil}): defina ${faltando} no .env.`,
    )
  }

  return { usuario, senha }
}

export function nomesDasVariaveis(perfil = 'admin', s: Sistema = sistema) {
  const p = prefixo(s)
  return { usuario: `${p}_${perfil.toUpperCase()}_USER`, senha: `${p}_${perfil.toUpperCase()}_PASS` }
}

/**
 * Produto usado quando o sistema não declara `produto` no catálogo.
 * TODO(empresa): troque pelo produto mais comum da empresa.
 */
export const PRODUTO_PADRAO = 'exemplo'

/**
 * Produtos cuja tela de login pede filial (ou empresa/tenant) num segundo passo.
 * TODO(empresa): liste aqui; vazio = nenhum produto usa FILIAL=.
 */
export const PRODUTOS_COM_FILIAL: string[] = []

/** Produtos que pedem filial no login — só eles usam FILIAL=. */
export function exigeFilial(s: Sistema): boolean {
  return PRODUTOS_COM_FILIAL.includes(s.produto ?? PRODUTO_PADRAO)
}

/**
 * Filial escolhida no login, para sistemas que pedem filial.
 * A filial é informada por tarefa: FILIAL= sobrepõe o padrão do catálogo.
 */
export function filialAlvo(s: Sistema = sistema): string | undefined {
  // Sem esta guarda, um FILIAL= esquecido no ambiente renomearia o
  // storageState de um sistema que nem pede filial.
  if (!exigeFilial(s)) return undefined
  return process.env.FILIAL?.trim() || s.filial || undefined
}

export function arquivoAuth(perfil = 'admin', s: Sistema = sistema) {
  // A sessão fica presa à filial escolhida no login. Sem a filial no nome do
  // arquivo, uma tarefa da filial B reaproveitaria em silêncio a sessão da
  // filial A — teste verde validando a operação errada.
  const filial = filialAlvo(s)
  const ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g')
  const sufixo = filial
    ? '-' +
      filial
        .toLowerCase()
        .normalize('NFD')
        .replace(ACENTOS, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    : ''

  return path.join('support', '.auth', `${s.clienteId}-${s.id}-${perfil}${sufixo}.json`)
}

export function repoDe(qual: string, s: Sistema = sistema): string {
  const caminho = s.repos?.[qual]
  if (!caminho) {
    throw new Error(
      `Repositório "${qual}" não configurado para ${s.clienteNome}/${s.nome}. ` +
        `Preencha clientes.${s.clienteId}.sistemas.${s.id}.repos em config/clientes.json. ` +
        `Configurados: ${Object.keys(s.repos || {}).join(', ') || 'nenhum'}`,
    )
  }
  return caminho
}

/** true quando a evidência gerada NÃO vale como aprovação formal. */
export const evidenciaNaoOficial = AMBIENTE !== 'hmlg'

/**
 * Valida a seleção. Chamada pelo playwright.config.ts para falhar cedo.
 * Não roda no import, para o `npm run doctor` diagnosticar config incompleta.
 */
export function validarSelecao() {
  if (erroSelecao) throw erroSelecao

  if (!baseURL) {
    throw new Error(
      `${alvo} não tem o ambiente "${AMBIENTE}" configurado em config/clientes.json ` +
        `(clientes.${sistema.clienteId}.sistemas.${sistema.id}.ambientes.${AMBIENTE}.baseURL). ` +
        `Rode "npm run doctor".`,
    )
  }

  // Trava dura: nunca rodar automação contra base de produção.
  if (sistema.db?.producao) {
    throw new Error(
      `BLOQUEADO: o banco configurado para ${alvo} está marcado como PRODUÇÃO ` +
        `(${sistema.db.server} / ${sistema.db.database}).\n` +
        `Corrija a string de homologação em config/clientes.json e remova "producao": true. ` +
        `Automação de QA não roda contra produção.`,
    )
  }
}

export function resumoExecucao() {
  return {
    alvo,
    cliente: sistema.clienteNome,
    clienteId: sistema.clienteId,
    sistema: sistema.id,
    ambiente: AMBIENTE,
    baseURL,
    evidenciaOficial: !evidenciaNaoOficial,
    ...(sistema.requerVpn ? { requerVpn: true } : {}),
  }
}
