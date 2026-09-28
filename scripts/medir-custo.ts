import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { agregar, tabelaMarkdown, type FonteSessao } from '../support/custo-sessao'

/*
 * Mede o consumo de tokens de uma sessão do Claude Code, por agente e modelo.
 *
 * uso: npx tsx scripts/medir-custo.ts <arquivo-ou-id-da-sessão> [--tarefa MVF-XXXXX]
 *
 * - aceita o caminho do .jsonl ou o id da sessão (prefixo serve), procurado na
 *   pasta de histórico deste projeto em ~/.claude/projects/;
 * - soma a sessão principal e os subagentes em <sessão>/subagents/*.jsonl,
 *   usando o `agentType` do .meta.json ao lado de cada um;
 * - com --tarefa grava também docs/medicoes/<tarefa>-<AAAA-MM-DD>.md.
 * Não mostra preço em dólar: só tokens.
 */

// O Claude Code nomeia a pasta trocando todo caractere não alfanumérico do
// caminho do projeto por "-" (C:\Users\a.b\x → C--Users-a-b-x).
const PASTA_HISTORICO = path.join(
  os.homedir(),
  '.claude',
  'projects',
  process.cwd().replace(/[^A-Za-z0-9]/g, '-'),
)

function erro(msg: string): never {
  console.error(msg)
  process.exit(1)
}

function resolverSessao(entrada: string): string {
  if (fs.existsSync(entrada) && fs.statSync(entrada).isFile()) return path.resolve(entrada)
  if (!fs.existsSync(PASTA_HISTORICO)) erro(`Pasta de histórico não encontrada: ${PASTA_HISTORICO}`)
  const id = entrada.replace(/\.jsonl$/, '')
  const candidatos = fs
    .readdirSync(PASTA_HISTORICO)
    .filter((n) => n.endsWith('.jsonl') && n.startsWith(id))
  if (candidatos.length === 0) erro(`Nenhuma sessão começa com "${id}" em ${PASTA_HISTORICO}`)
  if (candidatos.length > 1) erro(`Prefixo "${id}" é ambíguo:\n  ${candidatos.join('\n  ')}`)
  return path.join(PASTA_HISTORICO, candidatos[0])
}

function carregarFontes(arquivoPrincipal: string): FonteSessao[] {
  const fontes: FonteSessao[] = [
    { tipoAgente: 'principal', conteudo: fs.readFileSync(arquivoPrincipal, 'utf8') },
  ]
  const pastaSub = path.join(arquivoPrincipal.replace(/\.jsonl$/, ''), 'subagents')
  if (!fs.existsSync(pastaSub)) return fontes
  for (const nome of fs.readdirSync(pastaSub).filter((n) => n.endsWith('.jsonl')).sort()) {
    const arq = path.join(pastaSub, nome)
    const meta = arq.replace(/\.jsonl$/, '.meta.json')
    let tipoAgente = ''
    if (fs.existsSync(meta)) {
      try {
        tipoAgente = JSON.parse(fs.readFileSync(meta, 'utf8')).agentType ?? ''
      } catch {
        // .meta.json ilegível: cai no attributionAgent das linhas
      }
    }
    fontes.push({ tipoAgente, conteudo: fs.readFileSync(arq, 'utf8') })
  }
  return fontes
}

function main() {
  const args = process.argv.slice(2)
  let tarefa: string | undefined
  const i = args.indexOf('--tarefa')
  if (i >= 0) {
    tarefa = args[i + 1]
    if (!tarefa) erro('--tarefa precisa de um valor, ex.: --tarefa TSK-12345')
    args.splice(i, 2)
  }
  if (args.length !== 1) {
    erro('uso: npx tsx scripts/medir-custo.ts <arquivo-ou-id-da-sessão> [--tarefa MVF-XXXXX]')
  }

  const arquivo = resolverSessao(args[0])
  const fontes = carregarFontes(arquivo)
  const tabela = tabelaMarkdown(agregar(fontes))
  const sessao = path.basename(arquivo, '.jsonl')

  console.log(`Sessão: ${sessao} (${fontes.length - 1} subagente(s))\n`)
  console.log(tabela)

  if (tarefa) {
    const data = new Date().toISOString().slice(0, 10)
    const destino = path.join('docs', 'medicoes', `${tarefa}-${data}.md`)
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    const md =
      `# Medição de custo — ${tarefa}\n\n` +
      `- Sessão: \`${sessao}\`\n` +
      `- Subagentes: ${fontes.length - 1}\n` +
      `- Gerado em: ${data}\n` +
      `- Unidade: tokens (sem preço em dólar). % sobre a soma bruta dos quatro tipos.\n\n` +
      tabela +
      '\n'
    fs.writeFileSync(destino, md, 'utf8')
    console.log(`\nGravado em ${destino}`)
  }
}

main()
