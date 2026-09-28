import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { sistema, alvo } from './clientes'

/**
 * Consulta ao banco de homologação do cliente selecionado.
 *
 * Existe porque há cenário de QA que a tela **não prova**. Exemplo típico: o
 * status de um cadastro mora em DOIS flags de tabelas diferentes, e o erro mais
 * provável da entrega é gravar só um deles. A tela mostra "inativado" nos dois
 * casos — asserir pela tela seria falso verde.
 *
 * TODO(empresa): este módulo usa o `sqlcmd` (SQL Server). Se o banco for outro,
 * troque o executável e a sintaxe de saída.
 *
 * Regras que este módulo respeita, e que não são negociáveis:
 *
 *  - **Somente leitura.** `consultar()` recusa qualquer comando que não comece
 *    por SELECT/WITH. QA lê o efeito; quem escreve é o sistema sob teste.
 *  - **Banco de produção é bloqueado** — a mesma trava de `validarSelecao()`.
 *  - **Credencial nunca aparece em log.** Vai por variável de ambiente para o
 *    `sqlcmd`, nunca na linha de comando (`-P` ficaria visível na lista de
 *    processos), e nunca é impressa.
 *
 * Servidor e database vêm de `config/clientes.json`
 * (`clientes.<c>.sistemas.<s>.db`); usuário e senha vêm do `.env`, em
 * `<CLIENTE>_<SISTEMA>_DB_USER` / `_DB_PASS` (maiúsculas, `-` vira `_`).
 */

const SQLCMD = [
  'C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/170/Tools/Binn/sqlcmd.exe',
  'C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/180/Tools/Binn/sqlcmd.exe',
  'sqlcmd',
]

function executavel(): string {
  const achado = SQLCMD.find((c) => c === 'sqlcmd' || fs.existsSync(c))
  if (!achado) {
    throw new Error(
      'sqlcmd não encontrado. Instale o "SQL Server Command Line Utilities" ou ajuste support/db.ts.',
    )
  }
  return achado
}

function chaveEnv(sufixo: string): string {
  return `${sistema.clienteId}_${sistema.id}_${sufixo}`.toUpperCase().replace(/-/g, '_')
}

export interface ConexaoBanco {
  server: string
  database: string
  usuario: string
  senha: string
}

export function conexaoDe(): ConexaoBanco {
  const db = sistema.db
  if (!db?.server || !db?.database) {
    throw new Error(
      `${alvo}: não há banco configurado em config/clientes.json ` +
        `(clientes.${sistema.clienteId}.sistemas.${sistema.id}.db).`,
    )
  }
  if (db.producao) {
    throw new Error(
      `${alvo}: o banco configurado é de PRODUÇÃO (${db.server} / ${db.database}). ` +
        `Consulta bloqueada por segurança — avise e pare, não remova a flag.`,
    )
  }

  const chaveUsuario = chaveEnv('DB_USER')
  const chaveSenha = chaveEnv('DB_PASS')
  const usuario = process.env[chaveUsuario]
  const senha = process.env[chaveSenha]

  if (!usuario || !senha) {
    throw new Error(
      `${alvo}: credencial de banco ausente. Defina ${chaveUsuario} e ${chaveSenha} no .env.`,
    )
  }

  return { server: db.server, database: db.database, usuario, senha }
}

/**
 * Separador de coluna passado ao `sqlcmd` (`-s`). U+0001 não aparece em dado real.
 * Exportado porque `montarLinhas` e o teste unitário precisam do mesmo valor.
 */
export const SEPARADOR = '\u0001'

/**
 * Roda um SELECT e devolve as linhas como objetos coluna→valor.
 *
 * Usa `-s "\u0001" -W -h -1` para ter um separador que não aparece em dado real
 * e sem a régua de hífens do sqlcmd. `-h -1` remove o cabeçalho repetido; por
 * isso as colunas são declaradas por quem chama, em `colunas`.
 */
export function consultar<T = Record<string, string>>(sql: string, colunas: string[]): T[] {
  const limpo = sql.trim()
  if (!/^(select|with)\b/i.test(limpo)) {
    throw new Error(
      `support/db.ts é somente leitura: o comando precisa começar com SELECT ou WITH.\nRecebido: ${limpo.slice(0, 80)}`,
    )
  }

  const { server, database, usuario, senha } = conexaoDe()
  const SEP = SEPARADOR

  const saida = execFileSync(
    executavel(),
    [
      '-S', server,
      '-d', database,
      '-U', usuario,
      '-l', '30',
      '-b',
      '-h', '-1',
      // Coluna `varchar(max)` sai truncada em 256 caracteres no default do
      // sqlcmd — foi assim que a mensagem do relatório da carga chegou pela
      // metade e o parser leu "Processadas: -1". `-y 8000` é o teto do sqlcmd
      // para tipo de tamanho variável. Não dá para combinar com `-W`, então o
      // espaço de preenchimento é aparado no JS, logo abaixo.
      '-y', '8000',
      '-w', '65535',
      '-s', SEP,
      '-Q', `SET NOCOUNT ON; ${limpo}`,
    ],
    {
      encoding: 'utf-8',
      // -P na linha de comando ficaria visível para qualquer processo da máquina.
      env: { ...process.env, SQLCMDPASSWORD: senha },
      maxBuffer: 32 * 1024 * 1024,
    },
  )

  return montarLinhas<T>(saida, colunas)
}

/**
 * Quebra a saída bruta do `sqlcmd` em objetos rótulo→valor.
 *
 * Separado de `consultar()` de propósito: é a única parte da leitura de banco
 * que dá para testar sem servidor, e é a parte que decide o que vira
 * a flag lida no cenário. Ver `support/__testes__/db.test.ts`.
 *
 * **Aridade é conferida, não tolerada.** A versão anterior fazia
 * `partes[i] ?? ''` — uma linha com menos campos que o esperado preenchia o
 * resto com string vazia, e `Number('')` é `0`. Na prática: coluna que não veio
 * era lida como "flag desligada", e o cenário concluía "cadastro inativado" sem
 * que o banco tivesse dito isso. Falso verde silencioso, impossível de perceber
 * olhando o print.
 *
 * Quando a aridade não bate, a causa quase sempre é uma destas três, e todas
 * merecem parar o teste em vez de seguir com dado inventado:
 *   - o `SELECT` mudou e a lista de `colunas` de quem chama ficou para trás;
 *   - o valor tem quebra de linha ou o próprio separador dentro (use `hexDe`);
 *   - a saída veio truncada.
 */
export function montarLinhas<T = Record<string, string>>(saida: string, colunas: string[]): T[] {
  const regua = new RegExp(SEPARADOR, 'g')

  return saida
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0 && !/^-+$/.test(l.replace(regua, '')))
    .map((linha) => {
      const partes = linha.split(SEPARADOR).map((p) => p.trim())

      if (partes.length !== colunas.length) {
        throw new Error(
          `Leitura de banco fora de forma: a linha tem ${partes.length} campo(s) e foram ` +
            `declaradas ${colunas.length} colunas (${colunas.join(', ')}).\n` +
            `Linha crua: ${linha.replace(regua, ' | ')}\n` +
            `Confira o SELECT, a lista de colunas e se algum valor traz quebra de linha ` +
            `(nesse caso peça a coluna com hexDe/deHex).`,
        )
      }

      const obj: Record<string, string> = {}
      colunas.forEach((c, i) => (obj[c] = partes[i]))
      return obj as T
    })
}

/** Primeira linha, ou `undefined` quando o SELECT não retornou nada. */
export function consultarUm<T = Record<string, string>>(
  sql: string,
  colunas: string[],
): T | undefined {
  return consultar<T>(sql, colunas)[0]
}

/** Escapa um literal de string para interpolar em SQL de consulta. */
export function texto(valor: string): string {
  return `'${valor.replace(/'/g, "''")}'`
}

/**
 * O `sqlcmd` devolve a saída na code page do console, e acento de coluna
 * `nvarchar` chega corrompido ("Importa??o"). Para asserir texto com acento —
 * mensagem de log, nome de filial, motivo de rejeição — a consulta pede a
 * coluna em hexadecimal e a decodificação acontece aqui, sem passar pela
 * code page.
 *
 *   SELECT ${hexDe('GN_MENSLOGSIST')} AS mensagem
 *   → deHex(linha.mensagem)
 */
export function hexDe(coluna: string): string {
  // O CAST intermediário para nvarchar é obrigatório: colunas `varchar` viram
  // 1 byte por caractere e a decodificação UTF-16LE sairia com os bytes trocados.
  return `CONVERT(varchar(max), CAST(CAST(${coluna} AS nvarchar(max)) AS varbinary(max)), 2)`
}

/** Decodifica o hexadecimal produzido por `hexDe` (nvarchar = UTF-16LE). */
export function deHex(valor: string): string {
  if (!valor) return ''
  const limpo = valor.startsWith('0x') ? valor.slice(2) : valor
  return Buffer.from(limpo, 'hex').toString('utf16le')
}
