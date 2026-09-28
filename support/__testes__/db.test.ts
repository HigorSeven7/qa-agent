import test from 'node:test'
import assert from 'node:assert/strict'
import { texto, hexDe, deHex, montarLinhas, SEPARADOR } from '../db'

/**
 * `montarLinhas` é o parser da saída do `sqlcmd`. Ele decide o que vira
 * o valor de uma flag na leitura do banco — ou seja, decide se o cenário conclui
 * "cadastro ativo" ou "cadastro inativo".
 *
 * O modo de falha que estes testes travam: quando uma linha vinha com menos
 * campos que o esperado, o valor faltante virava `''`, e `Number('')` é `0`.
 * Resultado: coluna ausente lida como "flag desligada" — o cenário afirmava
 * "cliente inativado" sem que o banco tivesse dito isso.
 */

const S = SEPARADOR

test('quebra a saída em objetos rótulo→valor, aparando espaço de preenchimento', () => {
  const saida = [
    `abc-123${S}  Empresa Um  ${S}1${S}0`,
    `def-456${S}Empresa Dois${S}0${S}1`,
    '',
  ].join('\r\n')

  const linhas = montarLinhas(saida, ['clienteId', 'nome', 'flClie', 'flEnte'])

  assert.equal(linhas.length, 2)
  assert.deepEqual(linhas[0], {
    clienteId: 'abc-123',
    nome: 'Empresa Um',
    flClie: '1',
    flEnte: '0',
  })
  assert.equal(linhas[1].flEnte, '1')
})

test('a régua de traços do cabeçalho não vira linha de dado', () => {
  const saida = [`----${S}--------${S}-`, `abc${S}Empresa${S}1`, ''].join('\n')
  const linhas = montarLinhas(saida, ['id', 'nome', 'flag'])
  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].id, 'abc')
})

test('SELECT sem resultado devolve lista vazia, não uma linha de campos vazios', () => {
  assert.deepEqual(montarLinhas('', ['a', 'b']), [])
  assert.deepEqual(montarLinhas('\r\n  \r\n', ['a', 'b']), [])
})

test('linha com MENOS campos que colunas estoura em vez de preencher com vazio', () => {
  // Este é o defeito: `flEnte` viraria '' e `Number('')` é 0 → "inativo".
  const saida = `abc-123${S}Empresa${S}1`
  assert.throws(
    () => montarLinhas(saida, ['clienteId', 'nome', 'flClie', 'flEnte']),
    /4 coluna|3 campo|colunas/i,
  )
})

test('linha com MAIS campos que colunas estoura', () => {
  // Acontece quando o valor tem o separador dentro, ou quando o SELECT mudou
  // e a lista de colunas do chamador ficou para trás.
  const saida = `abc${S}Empresa${S}1${S}0${S}sobra`
  assert.throws(() => montarLinhas(saida, ['clienteId', 'nome', 'flClie', 'flEnte']), /colunas/i)
})

test('a mensagem do erro mostra a linha crua, para o humano conferir no banco', () => {
  try {
    montarLinhas(`abc${S}Empresa`, ['a', 'b', 'c'])
    assert.fail('deveria ter estourado')
  } catch (e) {
    assert.match(String(e), /abc/)
    assert.match(String(e), /Empresa/)
  }
})

test('valor legitimamente vazio no meio da linha é preservado', () => {
  // Coluna vazia é diferente de coluna ausente: aqui a aridade bate.
  const linhas = montarLinhas(`abc${S}${S}1`, ['id', 'nome', 'flag'])
  assert.deepEqual(linhas[0], { id: 'abc', nome: '', flag: '1' })
})

test('texto() escapa aspas simples para interpolar em SQL', () => {
  assert.equal(texto('Empresa'), "'Empresa'")
  assert.equal(texto("O'Brien & Cia"), "'O''Brien & Cia'")
  assert.equal(texto(''), "''")
})

test('deHex decodifica o que hexDe pediu ao servidor (nvarchar = UTF-16LE)', () => {
  const original = 'Importação · Ação & Cia Ç Ñ'
  const hex = Buffer.from(original, 'utf16le').toString('hex').toUpperCase()

  assert.equal(deHex(hex), original)
  assert.equal(deHex('0x' + hex), original)
  assert.equal(deHex(''), '')
})

test('hexDe monta o CAST duplo — sem ele varchar sai com os bytes trocados', () => {
  const sql = hexDe('EE.NM_ENTIEXTE')
  assert.match(sql, /nvarchar\(max\)/i)
  assert.match(sql, /varbinary\(max\)/i)
  assert.match(sql, /EE\.NM_ENTIEXTE/)
})
