import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { lerXlsx, normalizarNumero } from '../xlsx'
import { escreverXlsx, coluna } from '../xlsx-escrever'

/**
 * `normalizarNumero` é a função que decide se o valor da tela e o valor do Excel
 * são "o mesmo número" — ou seja, decide o veredito dos cenários de exportação
 * Errar o separador aqui é falso verde ou falso
 * vermelho direto no comentário do ClickUp.
 */
test('normalizarNumero — pt-BR: ponto é milhar, vírgula é decimal', () => {
  assert.equal(normalizarNumero('9.256,44'), 9256.44)
  assert.equal(normalizarNumero('9256,44'), 9256.44)
  assert.equal(normalizarNumero('R$ 1.500,00'), 1500)
  assert.equal(normalizarNumero('1.234.567,89'), 1234567.89)
})

test('normalizarNumero — en-US: vírgula é milhar, ponto é decimal', () => {
  // O ClosedXML grava número puro com ponto decimal; um export mal configurado
  // pode sair com agrupamento en-US. Os dois lados precisam cair no mesmo valor.
  assert.equal(normalizarNumero('9256.44'), 9256.44)
  assert.equal(normalizarNumero('1,234.56'), 1234.56)
  assert.equal(normalizarNumero('1,234,567.89'), 1234567.89)
})

test('normalizarNumero — separador único seguido de 3 dígitos é MILHAR', () => {
  // "1.234" numa tela pt-BR é mil duzentos e trinta e quatro, não 1,234.
  // Este é o caso que estava devolvendo 1.234 e comparando errado.
  assert.equal(normalizarNumero('1.234'), 1234)
  assert.equal(normalizarNumero('1.234.567'), 1234567)
  assert.equal(normalizarNumero('12.345'), 12345)
  assert.equal(normalizarNumero('1,234'), 1234)
})

test('normalizarNumero — zero à esquerda derruba a leitura de milhar', () => {
  // "0.123" não pode virar 123: não existe grupo de milhar começando em zero.
  assert.equal(normalizarNumero('0.123'), 0.123)
  assert.equal(normalizarNumero('0,123'), 0.123)
})

test('normalizarNumero — cabeça longa demais para agrupamento é decimal', () => {
  // "9256.448" tem 4 dígitos antes do ponto: agrupamento de milhar teria
  // separador ali ("9.256"). Logo o ponto é decimal.
  assert.equal(normalizarNumero('9256.448'), 9256.448)
})

test('normalizarNumero — negativo, inteiro e ruído', () => {
  assert.equal(normalizarNumero('12'), 12)
  assert.equal(normalizarNumero('-1.234,50'), -1234.5)
  assert.equal(normalizarNumero('-42'), -42)
  assert.equal(normalizarNumero(' 1.500,00 '), 1500)
})

test('normalizarNumero — sem número reconhecível devolve NaN', () => {
  for (const v of ['', '-', '   ', 'n/d', '--', '.', ',']) {
    assert.ok(Number.isNaN(normalizarNumero(v)), `esperava NaN para ${JSON.stringify(v)}`)
  }
  assert.ok(Number.isNaN(normalizarNumero(undefined as unknown as string)))
  assert.ok(Number.isNaN(normalizarNumero(null as unknown as string)))
})

test('coluna() converte índice em letra de coluna do Excel', () => {
  assert.equal(coluna(0), 'A')
  assert.equal(coluna(25), 'Z')
  assert.equal(coluna(26), 'AA')
  assert.equal(coluna(51), 'AZ')
  assert.equal(coluna(52), 'BA')
  assert.equal(coluna(701), 'ZZ')
})

/**
 * Ida e volta: escrever com `escreverXlsx` e ler com `lerXlsx`.
 *
 * É o teste que mais paga da suíte — cobre de uma vez o gerador de ZIP, o CRC32,
 * a tabela de strings compartilhadas, o parser de sheet e o de célula. Se a
 * planilha que o projeto monta para uma carga sair corrompida, é aqui
 * que aparece, e não numa execução de 3 minutos contra homologação.
 */
test('escreverXlsx → lerXlsx preserva cabeçalho, linhas e acentuação', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-xlsx-'))
  const arquivo = path.join(pasta, 'carga.xlsx')

  const linhas = [
    ['CNPJ', 'RAZÃO SOCIAL', 'STATUS CADASTRO', 'OBSERVAÇÃO'],
    ['12ABC34501DE35', 'Ação & Cia <Ltda>', 'ATIVO', 'aspas "duplas" e \'simples\''],
    ['11222333000181', 'Empresa Ç Ñ Ü', 'INATIVO', ''],
    ['99999999000191', 'Terceira', '', null],
  ]

  try {
    escreverXlsx(arquivo, linhas, 'ClienteResponsavel')
    assert.ok(fs.existsSync(arquivo), 'o arquivo não foi gravado')

    const planilha = lerXlsx(arquivo)
    assert.deepEqual(planilha.cabecalho, linhas[0])
    assert.equal(planilha.linhas.length, 3)

    assert.equal(planilha.linha(1)['RAZÃO SOCIAL'], 'Ação & Cia <Ltda>')
    assert.equal(planilha.linha(1)['OBSERVAÇÃO'], 'aspas "duplas" e \'simples\'')
    assert.equal(planilha.linha(2)['RAZÃO SOCIAL'], 'Empresa Ç Ñ Ü')
    assert.equal(planilha.linha(2)['STATUS CADASTRO'], 'INATIVO')

    // Célula vazia e célula nula viram string vazia, nunca `undefined`:
    // o importador do sistema distingue "coluna ausente" de "coluna vazia".
    assert.equal(planilha.linha(3)['STATUS CADASTRO'], '')
    assert.equal(planilha.linha(3)['OBSERVAÇÃO'], '')

    assert.deepEqual(planilha.coluna('CNPJ'), [
      '12ABC34501DE35',
      '11222333000181',
      '99999999000191',
    ])
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true })
  }
})

test('escreverXlsx → lerXlsx aguenta planilha larga (mais de 26 colunas)', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-xlsx-'))
  const arquivo = path.join(pasta, 'larga.xlsx')
  const cabecalho = Array.from({ length: 40 }, (_, i) => `COL${i + 1}`)
  const dados = Array.from({ length: 40 }, (_, i) => `v${i + 1}`)

  try {
    escreverXlsx(arquivo, [cabecalho, dados])
    const planilha = lerXlsx(arquivo)
    assert.deepEqual(planilha.cabecalho, cabecalho)
    assert.equal(planilha.linha(1)['COL27'], 'v27')
    assert.equal(planilha.linha(1)['COL40'], 'v40')
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true })
  }
})

test('lerXlsx recusa arquivo que não é ZIP com mensagem legível', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-xlsx-'))
  const arquivo = path.join(pasta, 'nao-e-xlsx.xlsx')
  try {
    fs.writeFileSync(arquivo, 'isto aqui é um CSV disfarçado\n1;2;3\n')
    assert.throws(() => lerXlsx(arquivo), /ZIP/i)
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true })
  }
})
