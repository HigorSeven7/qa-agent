import fs from 'node:fs'
import zlib from 'node:zlib'

/**
 * Leitor de .xlsx sem dependência externa.
 *
 * Existe porque o projeto não tem (e não vai ganhar por causa de um teste) uma
 * biblioteca de planilha, e exportação de Excel precisa ser asserida **célula a
 * célula** — o bug típico é coluna vazia por chave que não casa com o rótulo.
 * Asserir "o arquivo baixou" não prova nada.
 *
 * Um .xlsx é um ZIP de XMLs (OOXML/SpreadsheetML). O que este módulo faz:
 *
 *   1. lê o *central directory* do ZIP e extrai as entradas necessárias
 *      (`xl/sharedStrings.xml`, `xl/worksheets/sheetN.xml`);
 *   2. infla o deflate cru com `zlib.inflateRawSync` (método 8) ou copia
 *      direto quando a entrada está *stored* (método 0);
 *   3. traduz `<c r="B2" t="s"><v>7</v></c>` para a matriz de strings.
 *
 * Não é um parser de OOXML de uso geral: ignora estilo, fórmula, formatação
 * numérica e múltiplas abas por nome. É o suficiente para provar o conteúdo de
 * uma planilha gerada pelo ClosedXML, que é o que a evidência de QA precisa.
 *
 * Importante sobre formatação: o ClosedXML grava número como número. A célula
 * `Valor Unitário` chega aqui como `"9256.44"` mesmo que o Excel a exiba como
 * `9.256,44` — o BE manda a string já formatada em pt-BR só em algumas colunas.
 * Por isso as comparações do spec usam `normalizarNumero()`, e não igualdade
 * de string crua.
 *
 *   const planilha = lerXlsx('evidencias/TSK-12345/Pedidos.xlsx')
 *   expect(planilha.cabecalho).toEqual([...13 rótulos...])
 *   expect(planilha.linha(1)['Cód. Item (SAP)']).toBe('1101972')
 */

export interface Planilha {
  /** Primeira linha da aba, na ordem das colunas (A→…). */
  cabecalho: string[]
  /** Linhas de dados (sem o cabeçalho), cada uma alinhada ao `cabecalho`. */
  linhas: string[][]
  /** Linha de dados como objeto rótulo→valor. `n` é 1-based. */
  linha(n: number): Record<string, string>
  /** Valores de uma coluna pelo rótulo do cabeçalho, na ordem das linhas. */
  coluna(rotulo: string): string[]
}

/** Uma entrada do ZIP já descomprimida. */
type Entradas = Map<string, Buffer>

export function lerXlsx(arquivo: string, indicePlanilha = 1): Planilha {
  const entradas = lerZip(fs.readFileSync(arquivo))

  const sheet = entradas.get(`xl/worksheets/sheet${indicePlanilha}.xml`)
  if (!sheet) {
    throw new Error(
      `xl/worksheets/sheet${indicePlanilha}.xml não existe em ${arquivo}. ` +
        `Entradas: ${[...entradas.keys()].join(', ')}`,
    )
  }

  const compartilhadas = lerSharedStrings(entradas.get('xl/sharedStrings.xml'))
  const matriz = lerSheet(sheet.toString('utf-8'), compartilhadas)

  const cabecalho = matriz[0] ?? []
  const linhas = matriz.slice(1)

  return {
    cabecalho,
    linhas,
    linha(n) {
      const alvo = linhas[n - 1]
      if (!alvo) throw new Error(`Linha de dados ${n} não existe (há ${linhas.length}).`)
      return Object.fromEntries(cabecalho.map((rotulo, i) => [rotulo, alvo[i] ?? '']))
    },
    coluna(rotulo) {
      const i = cabecalho.indexOf(rotulo)
      if (i < 0) throw new Error(`Coluna "${rotulo}" não existe. Cabeçalho: ${cabecalho.join(' | ')}`)
      return linhas.map((l) => l[i] ?? '')
    },
  }
}

/**
 * Compara valores numéricos vindos de fontes com formatação diferente —
 * a tela mostra `R$ 9.256,44`, o Excel pode trazer `9256.44` ou `9.256,44`.
 * Devolve `NaN` quando não há número reconhecível.
 *
 * A regra é sempre a mesma: achar **qual separador é o decimal** e descartar o
 * resto. Só existem três casos.
 *
 *  1. **Os dois separadores presentes** → o último é o decimal. Cobre pt-BR
 *     (`9.256,44`) e en-US (`1,234.56`) sem precisar saber o locale da fonte.
 *  2. **Um separador seguido de exatamente 3 dígitos**, com uma cabeça que
 *     poderia ser um grupo de milhar (`1`, `12`, `123`, `1.234`…) → é **milhar**.
 *     `1.234` numa tela pt-BR é mil duzentos e trinta e quatro.
 *  3. **Qualquer outro caso** → o separador é decimal.
 *
 * O caso 2 é o que estava errado: `1.234` virava `1.234` e `1.234.567` virava
 * `NaN`, e essa função é a que decide se o valor da tela bate com o do Excel
 * nos cenários de exportação. A cabeça tem de começar em 1-9 justamente para
 * `0.123` continuar sendo 0,123 — não existe grupo de milhar começando em zero.
 *
 * Efeito colateral aceito: um valor com **três casas decimais** e sem
 * agrupamento (`1.500` querendo dizer 1,5) é lido como 1500. Nas telas e nos
 * exports deste projeto o dinheiro sai com duas casas (`ToString("N2")`), então
 * a leitura de milhar é a certa na esmagadora maioria — e ambiguidade sem
 * contexto não tem resposta melhor.
 */
export function normalizarNumero(valor: string): number {
  const limpo = String(valor ?? '')
    .replace(/[^\d,.-]/g, '')
    .trim()
  if (!/\d/.test(limpo)) return NaN

  const negativo = limpo.startsWith('-')
  const corpo = limpo.replace(/-/g, '')

  const posVirgula = corpo.lastIndexOf(',')
  const posPonto = corpo.lastIndexOf('.')
  const posSeparador = Math.max(posVirgula, posPonto)

  let inteiro = corpo
  let fracao = ''

  if (posSeparador >= 0) {
    const casas = corpo.length - posSeparador - 1
    const cabeca = corpo.slice(0, posSeparador)
    const ehMilhar =
      casas === 3 &&
      !(posVirgula >= 0 && posPonto >= 0) &&
      /^[1-9]\d{0,2}(?:[.,]\d{3})*$/.test(cabeca)

    if (!ehMilhar) {
      inteiro = cabeca
      fracao = corpo.slice(posSeparador + 1)
    }
  }

  inteiro = inteiro.replace(/[.,]/g, '')
  if (!/^\d*$/.test(inteiro) || !/^\d*$/.test(fracao)) return NaN

  const numero = Number(`${inteiro || '0'}.${fracao || '0'}`)
  return negativo ? -numero : numero
}

// ─────────────────────────────── ZIP ───────────────────────────────

/**
 * Lê o *End of Central Directory* e percorre o *central directory*, que é a
 * única forma confiável de achar as entradas: os *local file headers* podem
 * trazer tamanho zerado quando o gravador usa data descriptor.
 */
function lerZip(buffer: Buffer): Entradas {
  const eocd = acharEocd(buffer)
  const total = buffer.readUInt16LE(eocd + 10)
  let ponteiro = buffer.readUInt32LE(eocd + 16)

  const entradas: Entradas = new Map()

  for (let i = 0; i < total; i++) {
    if (buffer.readUInt32LE(ponteiro) !== 0x02014b50) break // assinatura do central directory

    const metodo = buffer.readUInt16LE(ponteiro + 10)
    const tamanhoComprimido = buffer.readUInt32LE(ponteiro + 20)
    const tamanhoNome = buffer.readUInt16LE(ponteiro + 28)
    const tamanhoExtra = buffer.readUInt16LE(ponteiro + 30)
    const tamanhoComentario = buffer.readUInt16LE(ponteiro + 32)
    const deslocamentoLocal = buffer.readUInt32LE(ponteiro + 42)
    const nome = buffer.toString('utf-8', ponteiro + 46, ponteiro + 46 + tamanhoNome)

    // No local file header o campo extra costuma ter tamanho diferente do
    // registrado no central directory — por isso relemos os dois campos aqui.
    const nomeLocal = buffer.readUInt16LE(deslocamentoLocal + 26)
    const extraLocal = buffer.readUInt16LE(deslocamentoLocal + 28)
    const inicio = deslocamentoLocal + 30 + nomeLocal + extraLocal
    const bruto = buffer.subarray(inicio, inicio + tamanhoComprimido)

    entradas.set(nome, metodo === 0 ? Buffer.from(bruto) : zlib.inflateRawSync(bruto))

    ponteiro += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario
  }

  return entradas
}

function acharEocd(buffer: Buffer): number {
  // O EOCD tem 22 bytes + comentário (até 64KB). Varre de trás para frente.
  const minimo = Math.max(0, buffer.length - 22 - 0xffff)
  for (let i = buffer.length - 22; i >= minimo; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i
  }
  throw new Error('Arquivo não é um ZIP válido: End of Central Directory não encontrado.')
}

// ──────────────────────── SpreadsheetML ────────────────────────

/**
 * O ClosedXML — gerador comum em backend .NET — grava a marcação com prefixo de
 * namespace (`<x:row>`, `<x:c>`, `<x:v>`), enquanto o Excel e a maioria dos
 * geradores gravam sem prefixo (`<row>`). Retirar o prefixo uma vez na entrada
 * deixa o resto do parser com um caso só para tratar.
 */
function semNamespace(xml: string): string {
  return xml.replace(/<(\/?)[A-Za-z_][\w.-]*:/g, '<$1')
}

function lerSharedStrings(xml?: Buffer): string[] {
  if (!xml) return []

  const texto = semNamespace(xml.toString('utf-8'))
  const itens: string[] = []

  // Cada <si> pode ter um <t> só ou vários (texto com formatação por trecho),
  // e nesse caso o valor da célula é a concatenação de todos eles.
  for (const si of texto.match(/<si\b[\s\S]*?<\/si>/g) ?? []) {
    const partes = si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? []
    itens.push(partes.map((p) => desescapar(p.replace(/<[^>]+>/g, ''))).join(''))
  }

  return itens
}

function lerSheet(bruto: string, compartilhadas: string[]): string[][] {
  const xml = semNamespace(bruto)
  const linhas: string[][] = []
  let maiorColuna = 0

  for (const linhaXml of xml.match(/<row\b[\s\S]*?(?:\/>|<\/row>)/g) ?? []) {
    const celulas: string[] = []

    for (const celulaXml of linhaXml.match(/<c\b[\s\S]*?(?:\/>|<\/c>)/g) ?? []) {
      const referencia = /\br="([A-Z]+)\d+"/.exec(celulaXml)?.[1]
      const indice = referencia ? indiceDaColuna(referencia) : celulas.length
      // Célula vazia no meio da linha simplesmente não é gravada: preenche o buraco.
      while (celulas.length < indice) celulas.push('')
      celulas.push(valorDaCelula(celulaXml, compartilhadas))
    }

    maiorColuna = Math.max(maiorColuna, celulas.length)
    linhas.push(celulas)
  }

  // Sem isso, `linha(n)[rotulo]` de uma coluna final vazia estouraria o índice.
  for (const linha of linhas) while (linha.length < maiorColuna) linha.push('')

  return linhas
}

function valorDaCelula(xml: string, compartilhadas: string[]): string {
  const tipo = /\bt="([^"]+)"/.exec(xml)?.[1]

  if (tipo === 'inlineStr') {
    const partes = xml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? []
    return partes.map((p) => desescapar(p.replace(/<[^>]+>/g, ''))).join('')
  }

  const bruto = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(xml)?.[1]
  if (bruto === undefined) return ''

  if (tipo === 's') return compartilhadas[Number(bruto)] ?? ''
  return desescapar(bruto)
}

/** "A" → 0, "B" → 1, "AA" → 26. */
function indiceDaColuna(letras: string): number {
  let n = 0
  for (const letra of letras) n = n * 26 + (letra.charCodeAt(0) - 64)
  return n - 1
}

function desescapar(texto: string): string {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
}
