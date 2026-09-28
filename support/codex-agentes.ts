import fs from 'node:fs'
import path from 'node:path'

/**
 * Paridade Codex: cada subagente de `.claude/agents/<nome>.md` vira
 * `.codex/agents/<nome>.toml` com `name`, `description` e
 * `developer_instructions` (o corpo do .md, sem o frontmatter).
 *
 * O sentido é um só — `.claude/agents/` é a fonte, o `.toml` é gerado. Editar
 * o `.toml` à mão se perde na próxima sincronização.
 *
 * Formato igual ao dos `.toml` que já existiam: string multilinha básica, cada
 * linha terminando em `\r` (o texto chega ao Codex com CRLF).
 */

export const PASTA_CLAUDE = '.claude/agents'
export const PASTA_CODEX = '.codex/agents'

export interface Agente {
  name: string
  description: string
  corpo: string
}

export function lerAgenteMd(md: string): Agente {
  const texto = md.replace(/\r\n/g, '\n')
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(texto)
  if (!m) throw new Error('frontmatter "---" ausente')
  const campo = (nome: string) => new RegExp(`^${nome}:\\s*(.*)$`, 'm').exec(m[1])?.[1].trim()
  const name = campo('name')
  const description = campo('description')
  if (!name || !description) throw new Error('frontmatter sem name ou description')
  return { name, description, corpo: m[2].trim() }
}

/** Escapa para string básica TOML: `\` e `"`, e controles que não sejam \n/\t. */
function escapar(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

export function gerarToml(a: Agente): string {
  const corpo = escapar(a.corpo).split('\n').join('\\r\n')
  return `name = "${escapar(a.name)}"\ndescription = "${escapar(a.description)}"\ndeveloper_instructions = """\n${corpo}"""\n`
}

export interface Sincronizacao {
  arquivo: string
  mudou: boolean
}

/** Gera (ou só compara, com `escrever: false`) um `.toml` por `.md` de agente. */
export function sincronizarCodex(raiz: string, escrever = true): Sincronizacao[] {
  const origem = path.join(raiz, PASTA_CLAUDE)
  const destino = path.join(raiz, PASTA_CODEX)
  const saida: Sincronizacao[] = []
  for (const nome of fs.readdirSync(origem).filter((n) => n.endsWith('.md')).sort()) {
    const agente = lerAgenteMd(fs.readFileSync(path.join(origem, nome), 'utf-8'))
    const toml = gerarToml(agente)
    const arquivo = path.join(destino, `${agente.name}.toml`)
    const atual = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf-8') : undefined
    const mudou = atual !== toml
    if (mudou && escrever) {
      fs.mkdirSync(destino, { recursive: true })
      fs.writeFileSync(arquivo, toml, 'utf-8')
    }
    saida.push({ arquivo: path.relative(raiz, arquivo).replace(/\\/g, '/'), mudou })
  }
  return saida
}
