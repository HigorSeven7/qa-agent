import fs from 'node:fs'

/**
 * Leitor de texto de PDF, sem dependência externa.
 *
 * Existe porque há sistema que gera o PDF do pedido no browser com
 * `new jsPDF('landscape', 'mm', 'a4')` — sem a opção `compress`. Os content
 * streams saem, portanto, em texto puro, e o texto desenhado aparece como
 * `(conteúdo) Tj`. Não é um parser de PDF de uso geral: é o suficiente para
 * asserir o que um PDF gerado pelo jsPDF escreveu, que é o que a evidência
 * de QA precisa provar.
 *
 * Por que não `pdftotext`: existe na máquina, mas dentro do Git for Windows
 * (`AppData/Local/Programs/Git/mingw64/bin`), fora do PATH e fora de qualquer
 * garantia de portabilidade. Um teste que depende disso quebra na máquina do
 * lado sem dizer por quê.
 *
 *   const paginas = trechosPorPagina('evidencias/TSK-12345/pedido.pdf')
 *   expect(textoDoPdf(arquivo)).toContain('Linha 7 de 7')
 */

export interface PaginaPdf {
  /** 1-based, na ordem em que os content streams aparecem no arquivo. */
  numero: number
  /** Cada string desenhada por um operador de texto, na ordem de desenho. */
  trechos: string[]
}

/** Um content stream por página desenhada, com os trechos de texto de cada uma. */
export function trechosPorPagina(arquivo: string): PaginaPdf[] {
  // latin1 preserva byte a byte: os acentos do jsPDF saem em WinAnsi, e
  // decodificar como utf-8 aqui corromperia "ç" e "ã".
  const bruto = fs.readFileSync(arquivo, 'latin1')

  const paginas: PaginaPdf[] = []
  const streams = /stream\r?\n([\s\S]*?)\r?\nendstream/g

  let m: RegExpExecArray | null
  while ((m = streams.exec(bruto)) !== null) {
    const conteudo = m[1]
    // Só content stream de página desenha texto. Fonte e imagem não têm Tj/TJ.
    if (!/\bT[jJ]\b/.test(conteudo)) continue

    const trechos = extrairTextos(conteudo)
    if (trechos.length) paginas.push({ numero: paginas.length + 1, trechos })
  }

  return paginas
}

/** Todos os trechos do documento, achatados, na ordem de desenho. */
export function trechosDoPdf(arquivo: string): string[] {
  return trechosPorPagina(arquivo).flatMap((p) => p.trechos)
}

/**
 * Texto do documento, uma linha por trecho desenhado.
 * É o formato mais prático para `toContain` / `not.toContain`.
 */
export function textoDoPdf(arquivo: string): string {
  return trechosDoPdf(arquivo).join('\n')
}

/** Texto de uma página específica (1-based). String vazia se a página não existe. */
export function textoDaPagina(arquivo: string, numero: number): string {
  const pagina = trechosPorPagina(arquivo).find((p) => p.numero === numero)
  return pagina ? pagina.trechos.join('\n') : ''
}

// ---------- interno ----------

/**
 * Extrai os literais de `(...) Tj` e dos arrays de `[...] TJ`.
 * O jsPDF usa Tj para o texto do pedido; TJ entra para o caso de o gerador
 * mudar, para o teste não emudecer em silêncio.
 */
function extrairTextos(conteudo: string): string[] {
  const saida: string[] = []
  // Um literal PDF: parênteses, com \) e \( escapados dentro.
  const literalSeguidoDeTj = /\(((?:\\.|[^\\()])*)\)\s*T[jJ]/g
  const arrayTJ = /\[((?:\\.|[^\]])*)\]\s*TJ/g

  let m: RegExpExecArray | null
  while ((m = literalSeguidoDeTj.exec(conteudo)) !== null) {
    saida.push(desescapar(m[1]))
  }
  while ((m = arrayTJ.exec(conteudo)) !== null) {
    // No array TJ os literais se alternam com números de kerning; junte só os literais.
    const partes = [...m[1].matchAll(/\(((?:\\.|[^\\()])*)\)/g)].map((x) => desescapar(x[1]))
    if (partes.length) saida.push(partes.join(''))
  }

  return saida
}

/** Desfaz o escape de string do PDF (tabela 3.2 da especificação). */
function desescapar(s: string): string {
  return s
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\([()\\])/g, '$1')
}
