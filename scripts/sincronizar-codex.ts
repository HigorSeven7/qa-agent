import { sincronizarCodex } from '../support/codex-agentes'

/*
 * Paridade Codex — regenera .codex/agents/*.toml a partir de .claude/agents/*.md.
 *
 * uso: npx tsx scripts/sincronizar-codex.ts             # escreve o que mudou
 *      npx tsx scripts/sincronizar-codex.ts --verificar # só compara; sai 1 se houver defasagem
 *
 * Sentido único: .claude/agents é a fonte. Rode depois de editar um agente.
 * Rode a partir da raiz do projeto.
 */

const verificar = process.argv.includes('--verificar')
const itens = sincronizarCodex(process.cwd(), !verificar)
for (const i of itens) {
  console.log(`${i.mudou ? (verificar ? 'DEFASADO' : 'gerado  ') : 'igual   '}  ${i.arquivo}`)
}
process.exit(verificar && itens.some((i) => i.mudou) ? 1 : 0)
