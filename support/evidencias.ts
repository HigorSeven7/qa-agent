import { Locator, Page, TestInfo } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { AMBIENTE, baseURL, alvo, sistema, evidenciaNaoOficial } from './env'
import { pastaDeEvidencias, pastaDeParciais, arquivoDeResultado } from './caminhos'

/**
 * Coletor de evidências por tarefa.
 *
 * Produz os artefatos que a skill de evidência consome:
 *   tarefas/<TAREFA>/evidencias/NN-ct0N-descricao.png
 *   tarefas/<TAREFA>/evidencias/resultado.json          ← consolidado
 *   tarefas/<TAREFA>/evidencias/_cenarios/<CT>.json     ← parcial por cenário
 *
 * Os caminhos saem todos de `support/caminhos.ts` — nenhum literal aqui.
 *
 * Cada instância é dona de UM cenário e grava no próprio arquivo parcial.
 * Isso evita que testes em paralelo (AMBIENTE=local) se sobrescrevam:
 * o resultado.json é sempre reconstruído a partir dos parciais.
 *
 * Uso no spec:
 *
 *   const ev = new Evidencia('TSK-12345', 'CT01', page, testInfo, {
 *     titulo: 'Cadastra cliente com dados válidos',
 *     criterios: ['CA01'],
 *     precondicao: 'usuário autenticado como Admin',
 *     esperado: 'POST /api/clientes → 201, toast de sucesso e registro na listagem',
 *   })
 *
 *   await ev.capturar('formulário preenchido', 'ok', [
 *     { alvo: campoCnpj, nome: 'CNPJ alfanumérico' },
 *     { alvo: botaoSalvar, nome: 'Salvar' },
 *   ])
 *   await ev.passo('interceptou POST /api/clientes → 201')
 *   ev.finalizar('aprovado')
 */

export type StatusPasso = 'ok' | 'falha' | 'info'
/**
 * `inconclusivo` é o estado inicial de todo cenário: ele só sai daí quando
 * `finalizar()` roda. Um teste que estoura antes disso — timeout, exceção,
 * asserção que derrubou o `test()` — fica registrado como inconclusivo, e não
 * como aprovado. Publicar APROVADO para um cenário que nem terminou é o pior
 * erro possível nesta esteira.
 */
export type StatusCenario = 'aprovado' | 'reprovado' | 'bloqueado' | 'inconclusivo'

/** Cenário obrigatório nasce de critério de aceite e decide o veredito.
 *  Complementar é julgamento do agente: falha vira achado, nunca REPROVADO. */
export type TipoCenario = 'obrigatorio' | 'complementar'

/**
 * Uma marcação é o retângulo desenhado no print em volta do elemento que
 * sustenta a asserção, com número e nome. É o que faz a evidência dizer
 * *onde olhar*: "① Data da entrega" no print e a mesma legenda no PDF.
 */
export interface Marcacao {
  alvo: Locator
  nome: string
  /** Sobrepõe a cor. Por padrão: vermelho em passo de falha, teal nos demais. */
  cor?: string
}

/** O que sobra da marcação no resultado.json — o PDF lista por número e nome. */
export interface MarcacaoRegistrada {
  numero: number
  nome: string
}

export interface PassoEvidencia {
  ordem: number
  descricao: string
  status: StatusPasso
  arquivo?: string
  observacao?: string
  marcacoes?: MarcacaoRegistrada[]
  horario: string
}

export interface OpcoesCenario {
  titulo?: string
  tipo?: TipoCenario
  /** IDs dos critérios de aceite que este cenário cobre: ['CA01', 'CA03']. */
  criterios?: string[]
  objetivo?: string
  precondicao?: string
  esperado?: string
  obtido?: string
}

export interface ResultadoCenario extends OpcoesCenario {
  cenario: string
  status: StatusCenario
  passos: PassoEvidencia[]
  /** Execução que gravou este parcial. Ver `RUN_ID`. */
  runId?: string
  /** `false` = parcial sobrou de execução anterior. Preenchido na consolidação. */
  desteRun?: boolean
}

export interface ResultadoTarefa {
  tarefa: string
  cliente: string
  sistema: string
  alvo: string
  ambiente: string
  baseURL: string
  evidenciaOficial: boolean
  branch?: string
  commit?: string
  /** Identificador desta execução. Todos os cenários com este `runId` rodaram agora. */
  runId: string
  /** Cenários que vieram de execução anterior. Ausente quando não há nenhum. */
  cenariosDeOutraExecucao?: string[]
  inicio: string
  fim?: string
  cenarios: ResultadoCenario[]
}

/**
 * Identificador da execução atual.
 *
 * `playwright.config.ts` define `QA_RUN_ID` no processo pai, e o Playwright
 * propaga o `process.env` para os workers — então todos os cenários de um mesmo
 * `npm test` compartilham o valor, inclusive rodando em paralelo.
 *
 * Existe por causa de um falso verde real: `consolidar()` lê **tudo** que houver
 * em `_cenarios/`, e um CT renomeado ou removido do spec deixa um parcial órfão
 * com o status da rodada anterior — inclusive `aprovado`. Ele entrava no PDF
 * como se tivesse rodado agora. Já aconteceu, e foi contornado na mão criando
 * uma pasta `evidencias/_backup-<TAREFA>-rodada-anterior/`.
 *
 * A consolidação **não apaga** parcial antigo de propósito: re-rodar um cenário
 * sozinho, depois de corrigir o spec, é fluxo normal e precisa manter os outros.
 * O que ela faz é marcar de qual execução cada cenário veio, para nenhum parcial
 * velho passar por atual sem alguém ver.
 */
export const RUN_ID = process.env.QA_RUN_ID || new Date().toISOString()

/** Seletores de dado sensível mascarados antes de qualquer print. */
const SELETORES_SENSIVEIS = [
  'input[type="password"]',
  '[data-sensivel]',
  '[data-testid*="cpf"]',
  '[data-testid*="cnpj"]',
]

const COR_PADRAO = '#2A7A8A'
const COR_FALHA = '#C0392B'

export class Evidencia {
  private ordem = 0
  private readonly pasta: string
  private readonly pastaParciais: string
  private readonly arquivoParcial: string
  private dados: ResultadoCenario

  constructor(
    private readonly tarefa: string,
    private readonly cenario: string,
    private page: Page,
    private readonly testInfo?: TestInfo,
    opcoes?: string | OpcoesCenario,
  ) {
    this.pasta = pastaDeEvidencias(tarefa)
    this.pastaParciais = pastaDeParciais(tarefa)
    this.arquivoParcial = path.join(this.pastaParciais, `${cenario}.json`)

    fs.mkdirSync(this.pastaParciais, { recursive: true })

    // Assinatura antiga passava só o título como 5º argumento.
    const op: OpcoesCenario = typeof opcoes === 'string' ? { titulo: opcoes } : (opcoes ?? {})

    this.dados = {
      cenario,
      status: 'inconclusivo',
      tipo: 'obrigatorio',
      ...op,
      runId: RUN_ID,
      passos: [],
    }
    this.gravarParcial()
  }

  /**
   * Troca a página que os próximos prints vão fotografar.
   *
   * Cenário com **dois perfis ao mesmo tempo** (a matriz de permissão) abre
   * dois contextos, e a evidência precisa fotografar ora um, ora outro. Sem
   * isto, o print do segundo perfil sai com a tela do primeiro — legenda
   * afirmando uma coisa e imagem mostrando outra.
   */
  usarPagina(page: Page) {
    this.page = page
    return this
  }

  /**
   * Completa a ficha do cenário durante o teste — útil para o que só se sabe
   * depois de rodar (`obtido`, `precondicao` com o ID da massa gerada).
   */
  definir(op: OpcoesCenario) {
    this.dados = { ...this.dados, ...op }
    this.gravarParcial()
    return this
  }

  /**
   * Print de tela numerado + registro do passo.
   *
   * `foco` existe porque `fullPage: true` **não** rola container com scroll
   * próprio: drawer, modal e grid (Tabulator) ficam cortados, e o print sai
   * sem o campo que a legenda diz estar provando. Apontando o elemento que
   * sustenta a asserção, ele é trazido para a área visível e **marcado com
   * número e nome** antes do print — a evidência passa a mostrar o que afirma
   * e a dizer como se chama o que está mostrando.
   *
   * Aceita um Locator solto (marcação sem nome, compatível com o uso antigo),
   * uma marcação nomeada ou uma lista delas.
   */
  async capturar(
    descricao: string,
    status: StatusPasso = 'ok',
    foco?: Locator | Marcacao | Marcacao[],
  ) {
    this.ordem++
    const nome = `${String(this.ordem).padStart(2, '0')}-${this.cenario.toLowerCase()}-${slug(descricao)}.png`
    const destino = path.join(this.pasta, nome)

    await this.mascararSensiveis()
    const { registradas, limpar } = await this.marcar(foco, status)
    await this.page.screenshot({ path: destino, fullPage: true })
    await limpar()

    this.dados.passos.push({
      ordem: this.ordem,
      descricao,
      status,
      arquivo: nome,
      marcacoes: registradas.length ? registradas : undefined,
      horario: agora(),
    })
    this.gravarParcial()

    // Também anexa ao report HTML do Playwright.
    await this.testInfo?.attach(`${this.cenario} — ${descricao}`, {
      path: destino,
      contentType: 'image/png',
    })

    return destino
  }

  /** Passo sem print (ação intermediária, log de contexto). */
  async passo(descricao: string, status: StatusPasso = 'info', observacao?: string) {
    this.ordem++
    this.dados.passos.push({ ordem: this.ordem, descricao, status, observacao, horario: agora() })
    this.gravarParcial()
  }

  /** Print no momento da falha + marca o cenário como reprovado. */
  async falhar(
    descricao: string,
    erro?: unknown,
    foco?: Locator | Marcacao | Marcacao[],
    obtido?: string,
  ) {
    await this.capturar(`FALHA - ${descricao}`, 'falha', foco)
    const ultimo = this.dados.passos.at(-1)
    if (ultimo && erro !== undefined) ultimo.observacao = String(erro).slice(0, 2000)
    this.dados.status = 'reprovado'
    if (obtido) this.dados.obtido = obtido
    this.gravarParcial()
  }

  /** Marca o cenário como bloqueado (ambiente/dado/dependência, não bug). */
  bloquear(motivo: string) {
    this.dados.status = 'bloqueado'
    this.ordem++
    this.dados.passos.push({
      ordem: this.ordem,
      descricao: 'cenário bloqueado',
      status: 'info',
      observacao: motivo,
      horario: agora(),
    })
    this.gravarParcial()
  }

  /** Fecha o cenário e reconstrói o resultado.json consolidado. */
  finalizar(status: StatusCenario = 'aprovado') {
    // Cenário que já falhou ou foi bloqueado não volta para aprovado.
    if (this.dados.status === 'inconclusivo') this.dados.status = status
    this.gravarParcial()
    Evidencia.consolidar(this.tarefa)
  }

  /**
   * Junta os parciais em `tarefas/<TAREFA>/evidencias/resultado.json`.
   * Idempotente — pode ser chamada quantas vezes quiser.
   */
  static consolidar(tarefa: string): ResultadoTarefa {
    const pasta = pastaDeEvidencias(tarefa)
    const pastaParciais = pastaDeParciais(tarefa)

    const cenarios: ResultadoCenario[] = (
      fs.existsSync(pastaParciais)
        ? fs
            .readdirSync(pastaParciais)
            .filter((f) => f.endsWith('.json'))
            .sort()
            .map(
              (f) =>
                JSON.parse(
                  fs.readFileSync(path.join(pastaParciais, f), 'utf-8'),
                ) as ResultadoCenario,
            )
        : []
    ).map((c) => ({ ...c, desteRun: c.runId === RUN_ID }))

    // Parcial sem `runId` é de antes desta mudança: também não é desta execução.
    const deOutraExecucao = cenarios.filter((c) => !c.desteRun).map((c) => c.cenario)

    if (deOutraExecucao.length) {
      console.warn(
        `[evidencia] ${tarefa}: ${deOutraExecucao.join(', ')} não rodaram nesta execução — ` +
          `vieram de _cenarios/ de uma rodada anterior. Confira antes de publicar: um cenário ` +
          `renomeado ou removido do spec deixa o status antigo para trás.`,
      )
    }

    const arquivo = arquivoDeResultado(tarefa)
    const anterior: Partial<ResultadoTarefa> = fs.existsSync(arquivo)
      ? JSON.parse(fs.readFileSync(arquivo, 'utf-8'))
      : {}

    const consolidado: ResultadoTarefa = {
      tarefa,
      cliente: sistema.clienteNome,
      sistema: sistema.nome,
      alvo,
      ambiente: AMBIENTE,
      baseURL,
      evidenciaOficial: !evidenciaNaoOficial,
      branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
      commit: git('rev-parse', '--short', 'HEAD'),
      runId: RUN_ID,
      cenariosDeOutraExecucao: deOutraExecucao.length ? deOutraExecucao : undefined,
      inicio: anterior.inicio ?? agora(),
      fim: agora(),
      cenarios,
    }

    fs.mkdirSync(pasta, { recursive: true })
    fs.writeFileSync(arquivo, JSON.stringify(consolidado, null, 2), 'utf-8')
    return consolidado
  }

  // ---------- interno ----------

  /**
   * Rola cada elemento para a área visível, mede onde ele está **no documento**
   * e desenha por cima um retângulo com uma etiqueta numerada e nomeada.
   *
   * A medida é feita elemento a elemento, logo após rolar: o `boundingBox()` é
   * relativo à viewport, e somar o scroll do momento é o que faz a marcação
   * cair no lugar certo no print `fullPage`.
   *
   * Nunca derruba o teste: evidência não pode ser causa de falha.
   */
  private async marcar(
    foco: Locator | Marcacao | Marcacao[] | undefined,
    status: StatusPasso,
  ): Promise<{ registradas: MarcacaoRegistrada[]; limpar: () => Promise<void> }> {
    const nada = { registradas: [], limpar: async () => {} }
    if (!foco) return nada

    const lista: Marcacao[] = Array.isArray(foco)
      ? foco
      : ehMarcacao(foco)
        ? [foco]
        : [{ alvo: foco, nome: '' }]
    if (!lista.length) return nada

    const corPadrao = status === 'falha' ? COR_FALHA : COR_PADRAO
    const caixas: { numero: number; nome: string; cor: string; x: number; y: number; w: number; h: number }[] = []

    for (const m of lista) {
      try {
        await m.alvo.scrollIntoViewIfNeeded({ timeout: 5_000 })
        const box = await m.alvo.boundingBox({ timeout: 5_000 })
        if (!box) continue
        const scroll = await this.page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
        caixas.push({
          numero: caixas.length + 1,
          nome: m.nome ?? '',
          cor: m.cor ?? corPadrao,
          x: box.x + scroll.x,
          y: box.y + scroll.y,
          w: box.width,
          h: box.height,
        })
      } catch {
        // elemento sumiu ou não é visível — a evidência segue sem essa marcação
      }
    }

    if (!caixas.length) return nada

    try {
      await this.page.evaluate(desenharMarcacoes, caixas)
    } catch {
      return nada
    }

    return {
      registradas: caixas.map((c) => ({ numero: c.numero, nome: c.nome })),
      limpar: async () => {
        try {
          await this.page.evaluate(() => document.getElementById('__evidencia-marcacoes')?.remove())
        } catch {
          /* página navegou depois do print — irrelevante */
        }
      },
    }
  }

  private async mascararSensiveis() {
    try {
      await this.page.addStyleTag({
        content: `${SELETORES_SENSIVEIS.join(', ')} { filter: blur(6px) !important; }`,
      })
    } catch {
      // página pode estar navegando — não é motivo para derrubar o teste
    }
  }

  private gravarParcial() {
    fs.writeFileSync(this.arquivoParcial, JSON.stringify(this.dados, null, 2), 'utf-8')
  }
}

/**
 * Roda dentro da página. Cria uma camada absoluta em coordenadas de documento
 * (não da viewport) porque o print é `fullPage` — com `position: fixed` a
 * marcação sairia colada no topo da imagem, longe do elemento.
 */
function desenharMarcacoes(
  caixas: { numero: number; nome: string; cor: string; x: number; y: number; w: number; h: number }[],
) {
  document.getElementById('__evidencia-marcacoes')?.remove()
  const camada = document.createElement('div')
  camada.id = '__evidencia-marcacoes'
  camada.style.cssText =
    'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none'

  for (const c of caixas) {
    const caixa = document.createElement('div')
    caixa.style.cssText = [
      'position:absolute',
      `left:${c.x - 3}px`,
      `top:${c.y - 3}px`,
      `width:${c.w + 6}px`,
      `height:${c.h + 6}px`,
      `border:3px solid ${c.cor}`,
      'border-radius:4px',
      'box-sizing:border-box',
      `box-shadow:0 0 0 3px rgba(255,255,255,.75), 0 2px 8px ${c.cor}55`,
    ].join(';')
    camada.appendChild(caixa)

    // A etiqueta fica acima da caixa; se não houver espaço no topo da página,
    // desce para dentro dela, para nunca ser cortada no print.
    const acima = c.y > 30
    const etiqueta = document.createElement('div')
    etiqueta.style.cssText = [
      'position:absolute',
      `left:${Math.max(2, c.x - 3)}px`,
      acima ? `top:${c.y - 30}px` : `top:${c.y + 2}px`,
      `background:${c.cor}`,
      'color:#fff',
      "font:700 12px/1 'Segoe UI',Arial,sans-serif",
      'padding:5px 9px 5px 5px',
      'border-radius:4px',
      'white-space:nowrap',
      'display:flex',
      'align-items:center',
      'gap:6px',
      'box-shadow:0 2px 6px rgba(0,0,0,.28)',
    ].join(';')

    const numero = document.createElement('span')
    numero.textContent = String(c.numero)
    numero.style.cssText = [
      'display:inline-block',
      'min-width:17px',
      'height:17px',
      'line-height:17px',
      'text-align:center',
      'border-radius:50%',
      'background:#fff',
      `color:${c.cor}`,
      'font-weight:700',
      'font-size:11px',
    ].join(';')
    etiqueta.appendChild(numero)

    if (c.nome) {
      const texto = document.createElement('span')
      texto.textContent = c.nome
      etiqueta.appendChild(texto)
    }
    camada.appendChild(etiqueta)
  }

  document.body.appendChild(camada)
}

/** Distingue `capturar(desc, status, locator)` de `capturar(desc, status, { alvo, nome })`. */
function ehMarcacao(valor: Locator | Marcacao): valor is Marcacao {
  return 'alvo' in valor
}

function agora() {
  return new Date().toISOString()
}

/** Leitura best-effort do git: rastreabilidade é bônus, nunca causa de falha. */
function git(...args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined
  } catch {
    return undefined
  }
}

function slug(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}
