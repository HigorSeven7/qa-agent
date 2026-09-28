import { RELATORIO_PADRAO, formatarResumo, lerRelatorio } from '../support/resumo-execucao'

/*
 * Resumo da última execução do Playwright — o que o qa-executor lê no lugar
 * do log inteiro.
 *
 * uso: npx tsx scripts/resumo-execucao.ts [caminho do relatório json]
 *      (padrão: .playwright-artifacts/ultima-execucao.json)
 *
 * Uma linha por teste; quem falhou traz a 1ª linha do erro e o caminho do
 * error-context.md. Sai com código 1 se algum teste falhou.
 * Rode a partir da raiz do projeto.
 */

try {
  const testes = lerRelatorio(process.argv[2] ?? RELATORIO_PADRAO)
  console.log(formatarResumo(testes))
  process.exit(testes.some((t) => t.status === 'unexpected') ? 1 : 0)
} catch (e) {
  console.error((e as Error).message)
  process.exit(2)
}
