import test from 'node:test'
import assert from 'node:assert/strict'
import {
  digitosVerificadores,
  comDigitos,
  formatar,
  semMascara,
  gerarAlfanumerico,
  gerarNumerico,
} from '../cnpj'

/**
 * CNPJ alfanumérico — regra da IN RFB 2.229/2024, valendo a partir de 2026.
 *
 * O caso de referência é o exemplo oficial da Receita: `12.ABC.345/01DE-35`.
 * Se este arquivo ficar vermelho, todo cenário com CNPJ está medindo errado.
 */

test('dígitos verificadores do exemplo oficial da Receita', () => {
  assert.equal(digitosVerificadores('12ABC34501DE'), '35')
  assert.equal(comDigitos('12ABC34501DE'), '12ABC34501DE35')
})

test('a raiz é normalizada para maiúscula antes do cálculo', () => {
  assert.equal(digitosVerificadores('12abc34501de'), '35')
  assert.equal(comDigitos('12abc34501de'), '12ABC34501DE35')
})

test('CNPJ puramente numérico continua valendo (retrocompatibilidade)', () => {
  // O peso do dígito alfanumérico é `charCode - 48`, que para '0'..'9' devolve
  // o próprio valor — logo o cálculo antigo tem de sair idêntico.
  assert.equal(comDigitos('112223330001'), '11222333000181')
})

test('raiz fora do formato de 12 caracteres [0-9A-Z] estoura', () => {
  assert.throws(() => digitosVerificadores('12ABC34501D'), /12/)
  assert.throws(() => digitosVerificadores('12ABC34501DEX'), /12/)
  assert.throws(() => digitosVerificadores('12ABC-4501DE'), /12/)
})

test('formatar aplica a máscara e semMascara desfaz', () => {
  assert.equal(formatar('12ABC34501DE35'), '12.ABC.345/01DE-35')
  assert.equal(semMascara('12.ABC.345/01DE-35'), '12ABC34501DE35')
  assert.equal(semMascara('12.abc.345/01de-35'), '12ABC34501DE35')
})

test('formatar devolve a entrada intacta quando ela não tem 14 caracteres', () => {
  assert.equal(formatar('123'), '123')
  assert.equal(formatar(''), '')
})

test('formatar é idempotente — aplicar duas vezes não duplica a máscara', () => {
  assert.equal(formatar(formatar('12ABC34501DE35')), '12.ABC.345/01DE-35')
})

test('gerador alfanumérico produz CNPJ com DV coerente e prefixo pedido', () => {
  for (let i = 0; i < 50; i++) {
    const gerado = gerarAlfanumerico('QA')
    assert.equal(gerado.length, 14)
    assert.ok(gerado.startsWith('QA'), `esperava prefixo QA, veio ${gerado}`)
    assert.equal(gerado.slice(12), digitosVerificadores(gerado.slice(0, 12)))
  }
})

test('gerador numérico não emite letra', () => {
  for (let i = 0; i < 50; i++) {
    const gerado = gerarNumerico()
    assert.match(gerado, /^\d{14}$/)
    assert.equal(gerado.slice(12), digitosVerificadores(gerado.slice(0, 12)))
  }
})
