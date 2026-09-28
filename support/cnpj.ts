/**
 * CNPJ alfanumérico (Nota Técnica COCAD/SUARA/RFB 49/2024, IN RFB 2.229/2024).
 *
 * Formato: 14 caracteres. Posições 1–12 aceitam `[0-9A-Z]`; os dois dígitos
 * verificadores continuam `[0-9]`. O valor de cada caractere no cálculo do DV é
 * `ASCII(c) - 48` — logo `'0'..'9' → 0..9` e `'A'..'Z' → 17..42`.
 *
 * Esta é a mesma fórmula do sistema sob teste
 * (`DocumentoPrimarioAttribute.IsCnpj()` no backend e `charVal()` nas Views).
 * Reimplementada aqui de propósito: se o cálculo do sistema divergir deste, o
 * teste acusa — foi exatamente esse o bug reprovado em 27/07/2026, quando o
 * `charVal()` do CRM usava `code - 65 + 10` para letras.
 */

const PESOS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const PESOS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

/** Valor do caractere no cálculo do DV. */
function valorDe(caractere: string) {
  return caractere.charCodeAt(0) - 48
}

function digitoVerificador(soma: number) {
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

/** Calcula os dois DVs de uma base de 12 caracteres `[0-9A-Z]`. */
export function digitosVerificadores(base: string) {
  const raiz = base.toUpperCase()
  if (!/^[0-9A-Z]{12}$/.test(raiz)) {
    throw new Error(`Base de CNPJ inválida: "${base}" — esperado 12 caracteres [0-9A-Z]`)
  }

  const soma1 = PESOS_DV1.reduce((acc, peso, i) => acc + valorDe(raiz[i]) * peso, 0)
  const dv1 = digitoVerificador(soma1)

  const soma2 =
    PESOS_DV2.slice(0, 12).reduce((acc, peso, i) => acc + valorDe(raiz[i]) * peso, 0) +
    dv1 * PESOS_DV2[12]
  const dv2 = digitoVerificador(soma2)

  return `${dv1}${dv2}`
}

/** Monta o CNPJ completo (14 caracteres, sem máscara) a partir da base de 12. */
export function comDigitos(base: string) {
  const raiz = base.toUpperCase()
  return raiz + digitosVerificadores(raiz)
}

/** `QA000000000178` → `QA.000.000/0001-78` */
export function formatar(cnpj: string) {
  const cru = cnpj.replace(/[.\-/]/g, '').toUpperCase()
  if (cru.length !== 14) return cnpj
  return `${cru.slice(0, 2)}.${cru.slice(2, 5)}.${cru.slice(5, 8)}/${cru.slice(8, 12)}-${cru.slice(12)}`
}

/** Remove só os separadores de máscara, preservando letras. Nunca use `\D` em CNPJ. */
export function semMascara(cnpj: string) {
  return cnpj.replace(/[.\-/]/g, '').toUpperCase()
}

const ALFABETO = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * CNPJ alfanumérico válido e **único por execução**, prefixado com `QA` para o
 * time reconhecer a massa em homologação.
 *
 * Massa fixa não serve aqui: com `retries: 1` em hmlg, um CNPJ fixo colide com
 * ele mesmo na segunda tentativa e o teste passa a falhar por "CNPJ duplicado" —
 * que não é o defeito sob teste.
 */
export function gerarAlfanumerico(prefixo = 'QA') {
  const raiz = (prefixo.toUpperCase() + aleatorio(12 - prefixo.length)).slice(0, 12)
  return comDigitos(raiz)
}

/** CNPJ só de dígitos, válido e único — o par de retrocompatibilidade do CA2. */
export function gerarNumerico() {
  return comDigitos(aleatorio(12, '0123456789'))
}

function aleatorio(tamanho: number, alfabeto = ALFABETO) {
  let saida = ''
  for (let i = 0; i < tamanho; i++) {
    saida += alfabeto[Math.floor(Math.random() * alfabeto.length)]
  }
  return saida
}
