import { formatar, verificarEsteira } from '../support/verificar-esteira'

/*
 * Autoverificação da esteira — o que a etapa 11 do /testar-tarefa pede e dá
 * para provar lendo arquivo.
 *
 * uso: npx tsx scripts/verificar-esteira.ts MVF-XXXXX
 *
 * Uma linha por item: OK / FALHA / AVISO / MANUAL. MANUAL é o que só humano
 * ou LLM confere; AVISO não reprova. Sai com código 1 se houver alguma FALHA.
 * Rode a partir da raiz do projeto.
 */

const tarefa = process.argv[2]
if (!tarefa || !/^[A-Za-z0-9_-]+$/.test(tarefa)) {
  console.error('uso: npx tsx scripts/verificar-esteira.ts MVF-XXXXX')
  process.exit(2)
}

const itens = verificarEsteira({ raiz: process.cwd(), tarefa })
console.log(`Autoverificação — ${tarefa}\n`)
console.log(formatar(itens))

const conta = (s: string) => itens.filter((i) => i.status === s).length
console.log(`\n${conta('OK')} OK · ${conta('FALHA')} FALHA · ${conta('AVISO')} AVISO · ${conta('MANUAL')} MANUAL`)
process.exit(conta('FALHA') ? 1 : 0)
