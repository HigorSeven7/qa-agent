import fs from 'node:fs'
import {
  CAMPOS_CABECALHO,
  adicionarPendencia,
  concluirEtapa,
  descreverEstado,
  iniciarEstado,
  iniciarEtapa,
  lerEstado,
  registrarGateAchado,
  registrarGateComplementares,
  resolverPendencia,
  type Cabecalho,
} from '../support/estado'

/*
 * Estado da esteira — tarefas/<T>/contexto/estado.json.
 *
 * uso (rode a partir da raiz do projeto):
 *   npx tsx scripts/estado.ts mostrar  <T>
 *   npx tsx scripts/estado.ts iniciar  <T> [--fluxo testar-tarefa|reteste] [--nova-rodada]
 *                                          [--cliente c --sistema s --filial f --ambiente hmlg
 *                                           --baseURL u --tarefaQA id --branch b --refSeletor r
 *                                           --comandoDiff "git diff …"]
 *   npx tsx scripts/estado.ts etapa    <T> <id>                       # marca em andamento
 *   npx tsx scripts/estado.ts concluir <T> <id> [--arquivo contexto/02-codigo.md]
 *                                          [--resumo "…" | --resumo-arquivo caminho] [--bloqueada]
 *        sem --resumo: o resumo sai do "## Resumo" do --arquivo (relativo a tarefas/<T>/)
 *   npx tsx scripts/estado.ts gate     <T> complementares --resposta "todos|nenhum|CX01,CX03"
 *                                          [--propostos CX01,CX02] | --nao-aplica
 *   npx tsx scripts/estado.ts gate     <T> achado --resposta reprova|achado [--cenario CX02] | --nao-aplica
 *   npx tsx scripts/estado.ts pendencia <T> "texto"   |   resolver <T> <índice>
 *
 * IDs de etapa: 1 2 3 3.5 4 5 6 7 8 8.4 8.5 9 10 11 (testar-tarefa) · R0–R5 (reteste).
 * Resumo: no máximo 20 linhas. --resumo é cortado; o "## Resumo" do arquivo acima disso é erro.
 */

function erro(msg: string): never {
  console.error(msg)
  process.exit(1)
}

const [comando, tarefa, ...resto] = process.argv.slice(2)
if (!comando || !tarefa) erro('uso: npx tsx scripts/estado.ts <mostrar|iniciar|etapa|concluir|gate|pendencia|resolver> <T> …')
if (!/^[A-Za-z0-9_-]+$/.test(tarefa)) erro(`tarefa inválida: ${tarefa}`)

const posicionais: string[] = []
const flags: Record<string, string | true> = {}
for (let i = 0; i < resto.length; i++) {
  const a = resto[i]
  if (!a.startsWith('--')) {
    posicionais.push(a)
    continue
  }
  const nome = a.slice(2)
  const valor = resto[i + 1]
  if (valor === undefined || valor.startsWith('--')) flags[nome] = true
  else {
    flags[nome] = valor
    i++
  }
}
const texto = (nome: string) => (typeof flags[nome] === 'string' ? (flags[nome] as string) : undefined)
const lista = (nome: string) => texto(nome)?.split(/[,\s]+/).filter(Boolean)

try {
  switch (comando) {
    case 'mostrar': {
      const estado = lerEstado(tarefa)
      if (!estado) {
        console.log(`${tarefa}: sem estado.json — esteira começa da etapa 1.`)
        break
      }
      console.log(descreverEstado(estado))
      break
    }
    case 'iniciar': {
      const cabecalho: Cabecalho = {}
      for (const c of CAMPOS_CABECALHO) if (texto(c)) cabecalho[c] = texto(c)
      const fluxo = texto('fluxo') ?? 'testar-tarefa'
      if (fluxo !== 'testar-tarefa' && fluxo !== 'reteste') erro(`--fluxo inválido: ${fluxo}`)
      console.log(descreverEstado(iniciarEstado(tarefa, { fluxo, novaRodada: flags['nova-rodada'] === true, cabecalho })))
      break
    }
    case 'etapa': {
      const id = posicionais[0] ?? erro('informe o id da etapa')
      console.log(`etapaAtual → ${iniciarEtapa(tarefa, id).etapaAtual}`)
      break
    }
    case 'concluir': {
      const id = posicionais[0] ?? erro('informe o id da etapa')
      const arqResumo = texto('resumo-arquivo')
      const resumo = arqResumo ? fs.readFileSync(arqResumo, 'utf-8') : texto('resumo')
      const e = concluirEtapa(tarefa, id, {
        arquivo: texto('arquivo'),
        resumo,
        status: flags['bloqueada'] ? 'bloqueada' : 'concluida',
      })
      console.log(`${id} → ${e.etapas[id].status} · etapaAtual → ${e.etapaAtual}`)
      break
    }
    case 'gate': {
      const qual = posicionais[0]
      const naoAplica = flags['nao-aplica'] === true
      if (qual === 'complementares') {
        const g = registrarGateComplementares(tarefa, { resposta: texto('resposta'), propostos: lista('propostos'), naoAplica }).gates.complementares
        console.log(`gate complementares: ${g.status}${g.aprovados.length ? ` → ${g.aprovados.join(', ')}` : ''}`)
      } else if (qual === 'achado') {
        const r = texto('resposta')
        if (!naoAplica && r !== 'reprova' && r !== 'achado') erro('--resposta é "reprova" ou "achado"')
        const g = registrarGateAchado(tarefa, { resposta: r as 'reprova' | 'achado' | undefined, cenario: texto('cenario'), naoAplica }).gates.achado
        console.log(`gate do achado: ${g.status}${g.resposta ? ` → ${g.resposta}` : ''}`)
      } else erro('gate é "complementares" ou "achado"')
      break
    }
    case 'pendencia': {
      const t = posicionais.join(' ') || erro('informe o texto da pendência')
      console.log(`${adicionarPendencia(tarefa, t).pendencias.length} pendência(s)`)
      break
    }
    case 'resolver': {
      const i = Number(posicionais[0])
      if (!Number.isInteger(i)) erro('informe o índice da pendência (veja "mostrar")')
      console.log(`${resolverPendencia(tarefa, i).pendencias.length} pendência(s)`)
      break
    }
    default:
      erro(`comando desconhecido: ${comando}`)
  }
} catch (e) {
  erro((e as Error).message)
}
