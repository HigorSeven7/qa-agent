import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

/**
 * Gerador de .xlsx sem dependência externa — o par de escrita do `lerXlsx`.
 *
 * Existe pelo mesmo motivo do leitor: o projeto não ganha uma biblioteca de
 * planilha por causa de um teste, e cenário de importação exige **enviar**
 * planilhas com combinações que nenhum arquivo pronto tem
 * (coluna L ausente, coluna vazia, valor fora do domínio, documento
 * inexistente). Montar a massa à mão em cada rodada tornaria o teste
 * irreprodutível.
 *
 * O consumidor típico é um backend .NET com NPOI (`XSSFWorkbook.GetSheetAt(0)`).
 * Por isso o formato é o OOXML clássico e conservador:
 *
 *  - **uma única aba**, porque o importador lê sempre a de índice 0;
 *  - texto via **sharedStrings** (o que o ClosedXML gera e o NPOI lê sem
 *    surpresa), não `inlineStr`;
 *  - **toda célula é string** — o importador faz `GetCell(i)?.ToString()`, e
 *    documento com zero à esquerda vira número truncado se for gravado como
 *    número;
 *  - célula vazia é **omitida** do XML, que é como o Excel representa uma
 *    célula em branco de verdade — exatamente o caso "coluna L vazia" do CA02.
 *
 * Uso:
 *
 *   escreverXlsx('massa.xlsx', [
 *     ['CLIENTE', 'USUÁRIO', ..., 'STATUS CADASTRO (ATIVO/INATIVO)'],
 *     ['40227507000105', 'fulano@x.com', '', ..., 'inativo'],
 *   ])
 */

export type Celula = string | null | undefined

export function escreverXlsx(destino: string, linhas: Celula[][], aba = 'Planilha1'): string {
  const { xml: sheetXml, compartilhadas } = montarSheet(linhas)

  const arquivos: Record<string, string> = {
    '[Content_Types].xml': CONTENT_TYPES,
    '_rels/.rels': RELS_RAIZ,
    'xl/workbook.xml': workbookXml(aba),
    'xl/_rels/workbook.xml.rels': RELS_WORKBOOK,
    'xl/styles.xml': STYLES,
    'xl/sharedStrings.xml': sharedStringsXml(compartilhadas),
    'xl/worksheets/sheet1.xml': sheetXml,
  }

  fs.mkdirSync(path.dirname(path.resolve(destino)), { recursive: true })
  fs.writeFileSync(destino, zipar(arquivos))
  return destino
}

// ---------- planilha ----------

function montarSheet(linhas: Celula[][]) {
  const indice = new Map<string, number>()
  const compartilhadas: string[] = []
  const idDe = (valor: string) => {
    const existente = indice.get(valor)
    if (existente !== undefined) return existente
    const novo = compartilhadas.length
    compartilhadas.push(valor)
    indice.set(valor, novo)
    return novo
  }

  const corpo = linhas
    .map((linha, l) => {
      const numero = l + 1
      const celulas = linha
        .map((valor, c) => {
          // Célula ausente ≠ célula com string vazia. O importador distingue os
          // dois casos (`GetCell(11)` nulo vs. texto em branco), então o vazio
          // precisa mesmo sumir do XML.
          if (valor === null || valor === undefined || valor === '') return ''
          return `<c r="${referencia(c, numero)}" t="s"><v>${idDe(String(valor))}</v></c>`
        })
        .join('')
      return `<row r="${numero}">${celulas}</row>`
    })
    .join('')

  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${corpo}</sheetData></worksheet>`

  return { xml, compartilhadas }
}

/** 0 → A, 25 → Z, 26 → AA. */
export function coluna(indice: number): string {
  let n = indice
  let letras = ''
  do {
    letras = String.fromCharCode(65 + (n % 26)) + letras
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return letras
}

function referencia(indiceColuna: number, linha: number): string {
  return `${coluna(indiceColuna)}${linha}`
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sharedStringsXml(valores: string[]): string {
  const itens = valores
    .map((v) => `<si><t xml:space="preserve">${escapar(v)}</t></si>`)
    .join('')
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `count="${valores.length}" uniqueCount="${valores.length}">${itens}</sst>`
  )
}

function workbookXml(aba: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escapar(aba)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  )
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`

const RELS_RAIZ =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`

const RELS_WORKBOOK =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` +
  `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`

// NPOI aceita workbook sem styles.xml, mas reclama em algumas versões. Um
// stylesheet mínimo com uma fonte, um preenchimento e uma borda é barato.
const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
  `<borders count="1"><border/></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
  `</styleSheet>`

// ---------- zip ----------

const TABELA_CRC = (() => {
  const tabela = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabela[n] = c
  }
  return tabela
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/**
 * ZIP mínimo (deflate cru, sem data/hora significativa nem Zip64). Suficiente
 * para um .xlsx de massa de teste, que nunca passa de alguns KB.
 */
function zipar(arquivos: Record<string, string>): Buffer {
  const locais: Buffer[] = []
  const centrais: Buffer[] = []
  let deslocamento = 0

  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const cru = Buffer.from(conteudo, 'utf-8')
    const comprimido = zlib.deflateRawSync(cru)
    const nomeBuf = Buffer.from(nome, 'utf-8')
    const crc = crc32(cru)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // versão necessária
    local.writeUInt16LE(0, 6) // flags
    local.writeUInt16LE(8, 8) // método: deflate
    local.writeUInt16LE(0, 10) // hora
    local.writeUInt16LE(0x21, 12) // data (1980-01-01)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(comprimido.length, 18)
    local.writeUInt32LE(cru.length, 22)
    local.writeUInt16LE(nomeBuf.length, 26)
    local.writeUInt16LE(0, 28)
    locais.push(local, nomeBuf, comprimido)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4) // versão de criação
    central.writeUInt16LE(20, 6) // versão necessária
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(comprimido.length, 20)
    central.writeUInt32LE(cru.length, 24)
    central.writeUInt16LE(nomeBuf.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(deslocamento, 42)
    centrais.push(central, nomeBuf)

    deslocamento += 30 + nomeBuf.length + comprimido.length
  }

  const corpoCentral = Buffer.concat(centrais)
  const fim = Buffer.alloc(22)
  fim.writeUInt32LE(0x06054b50, 0)
  fim.writeUInt16LE(0, 4)
  fim.writeUInt16LE(0, 6)
  fim.writeUInt16LE(Object.keys(arquivos).length, 8)
  fim.writeUInt16LE(Object.keys(arquivos).length, 10)
  fim.writeUInt32LE(corpoCentral.length, 12)
  fim.writeUInt32LE(deslocamento, 16)
  fim.writeUInt16LE(0, 20)

  return Buffer.concat([...locais, corpoCentral, fim])
}
