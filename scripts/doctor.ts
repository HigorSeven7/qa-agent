import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import type { Sistema } from '../support/clientes'

/*
 * Este import é DINÂMICO de propósito. support/clientes.ts lança se
 * config/clientes.json não existir — e o doctor é justamente a ferramenta que
 * precisa te dizer isso em português, não estourar um stack trace.
 */

const CONFIG = path.join('config', 'clientes.json')

if (!fs.existsSync(CONFIG)) {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║  Falta o config/clientes.json — é o primeiro passo da instalação.  ║
╚════════════════════════════════════════════════════════════════════╝

Copie o exemplo e preencha à mão:

     Copy-Item config\\clientes.example.json config\\clientes.json

Um bloco por sistema: URLs de hmlg e local, perfis, repos, branchBase,
produto (login em support/logins/) e db.producao quando apontar para produção.

Depois rode 'npm run doctor' de novo.
`)
  process.exit(1)
}

const {
  catalogo,
  idsDeClientes,
  idsDeSistemas,
  resolverSistema,
  arquivoAuth,
  nomesDasVariaveis,
} = require('../support/clientes') as typeof import('../support/clientes')

/**
 * Diagnóstico da configuração. Rode depois de importar os ambientes ou editar o .env:
 *
 *   npm run doctor                  # tudo
 *   npm run doctor -- acme          # só um cliente
 *   npm run doctor -- acme crm      # só um sistema
 *
 * Nunca imprime valor de credencial — só o nome da variável que falta.
 */

const [filtroCliente, filtroSistema] = process.argv.slice(2).filter((a) => !a.startsWith('-'))

const ok = (t: string) => console.log(`  ✅ ${t}`)
const warn = (t: string) => console.log(`  ⚠️  ${t}`)

let erros = 0
let alertas = 0
const nok = (t: string) => { console.log(`  ❌ ${t}`); erros++ }
const aviso = (t: string) => { warn(t); alertas++ }

console.log('\n═══ Global ═══\n')

if (fs.existsSync('.env')) ok('.env existe')
else nok('.env não existe — copie .env.example para .env e preencha')

for (const v of ['CLICKUP_API_TOKEN', 'CLICKUP_TEAM_ID']) {
  if (process.env[v]) ok(`${v} definido`)
  else nok(`${v} ausente no .env`)
}

if (catalogo.clickup.listaDevs || catalogo.clickup.listaQA) ok('IDs de lista do ClickUp preenchidos')
else warn('IDs de lista do ClickUp vazios — o agente descobre via hierarquia (ok)')

/*
 * Uma pasta por tarefa junta, dentro de `tarefas/<ID>/`, o que pode ser
 * versionado (spec, fixture, page object da tarefa, alvo.json) e o que NUNCA
 * pode — print de tela de cliente, contexto do card, resultado de execução,
 * PDF de evidência.
 *
 * O `.gitignore` nega por padrão e reabre só esses. `scripts/` da tarefa fica
 * fora (sonda e gerador de massa carregam credencial e ID de cliente). Mas `.gitignore` só vale para arquivo ainda não rastreado: um `git add -f`, um arquivo que entrou
 * antes da regra existir, ou uma regra editada sem querer passam despercebidos,
 * e o vazamento é silencioso. Esta verificação olha o que está REALMENTE no
 * índice — é ela que prova a regra, não a leitura do `.gitignore`.
 */
const PERMITIDO_EM_TAREFAS =
  /^tarefas\/[^/]+\/(specs\/|fixtures\/|pages\/[^/]+\.page\.ts$|alvo\.json$)/

function conferirVersionadosEmTarefas() {
  if (!fs.existsSync('tarefas')) return

  let rastreados: string[]
  try {
    rastreados = execSync('git ls-files tarefas/', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  } catch {
    aviso('não deu para rodar `git ls-files tarefas/` — verificação de versionamento pulada')
    return
  }

  const indevidos = rastreados.filter((f) => !PERMITIDO_EM_TAREFAS.test(f))

  if (!indevidos.length) {
    ok(
      `tarefas/: ${rastreados.length} arquivo(s) versionado(s), ` +
        `todos em specs/, fixtures/, pages/*.page.ts ou alvo.json`,
    )
    return
  }

  nok(
    `tarefas/: ${indevidos.length} arquivo(s) versionado(s) FORA de specs/, fixtures/, ` +
      `pages/*.page.ts e alvo.json — dado de cliente pode ter entrado no git:\n` +
      indevidos
        .slice(0, 20)
        .map((f) => `        ${f}`)
        .join('\n') +
      (indevidos.length > 20 ? `\n        … e mais ${indevidos.length - 20}` : '') +
      `\n     Tire do índice com: git rm --cached <arquivo>`,
  )
}

conferirVersionadosEmTarefas()

const clientes = idsDeClientes().filter((c) => !filtroCliente || c === filtroCliente)
if (!clientes.length) {
  console.log(`\n❌ Cliente "${filtroCliente}" não existe. Disponíveis: ${idsDeClientes().join(', ')}\n`)
  process.exit(1)
}

console.log(
  `\nClientes: ${idsDeClientes().length} · ` +
    `Sistemas: ${idsDeClientes().reduce((n, c) => n + idsDeSistemas(c).length, 0)}`,
)

let prontos = 0
let totalSistemas = 0

for (const clienteId of clientes) {
  const sistemas = idsDeSistemas(clienteId).filter((s) => !filtroSistema || s === filtroSistema)

  for (const sistemaId of sistemas) {
    totalSistemas++
    let s: Sistema
    try {
      s = resolverSistema(clienteId, sistemaId)
    } catch (e) {
      console.log(`\n═══ ${clienteId}/${sistemaId} ═══\n`)
      nok((e as Error).message)
      continue
    }

    console.log(`\n═══ ${s.clienteNome} / ${s.nome}  →  CLIENTE=${clienteId} SISTEMA=${sistemaId} ═══\n`)

    let pronto = true
    const falta = () => { pronto = false }

    // Travas de segurança primeiro.
    if (s.db?.producao) {
      nok(`BLOQUEADO — banco marcado como PRODUÇÃO (${s.db.server} / ${s.db.database}). ` +
          `Corrija a string de homologação e remova "producao": true.`)
      falta()
    }
    for (const a of s.avisos ?? []) aviso(a)

    // URLs
    const hmlg = s.ambientes?.hmlg?.baseURL
    if (hmlg) ok(`hmlg: ${hmlg}${s.requerVpn ? '   [exige VPN]' : ''}`)
    else { nok('hmlg: baseURL não configurada'); falta() }

    if (s.ambientes?.local?.baseURL) ok(`local: ${s.ambientes.local.baseURL}`)
    else warn('local: não configurado — só dá para testar em hmlg')

    // Credenciais e sessão
    for (const perfil of s.perfis ?? []) {
      const { usuario, senha } = nomesDasVariaveis(perfil, s)
      if (process.env[usuario] && process.env[senha]) ok(`credencial ${perfil}`)
      else { nok(`credencial ${perfil} ausente — defina ${usuario} e ${senha} no .env`); falta() }

      const auth = arquivoAuth(perfil, s)
      if (fs.existsSync(auth)) ok(`storageState ${perfil}`)
      else warn(`storageState ${perfil} não gerado — CLIENTE=${clienteId} SISTEMA=${sistemaId} npm run auth`)
    }

    // Repositórios
    const repos = Object.entries(s.repos ?? {})
    if (!repos.length) {
      aviso('nenhum repositório configurado — o agente perde o contexto de código')
    }
    for (const [qual, caminho] of repos) {
      if (!fs.existsSync(caminho)) { nok(`repo ${qual}: ${caminho} — não existe`); falta(); continue }
      if (!fs.existsSync(`${caminho}/.git`)) { aviso(`repo ${qual}: ${caminho} não é um clone git`); continue }

      let detalhe = ''
      try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: caminho, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
        }).trim()
        detalhe = ` (branch: ${branch})`
        execSync(`git rev-parse --verify origin/${s.branchBase}`, { cwd: caminho, stdio: 'ignore' })
      } catch {
        detalhe += ` — origin/${s.branchBase} não encontrado, rode 'git fetch' nesse repo`
      }
      ok(`repo ${qual}: ${caminho}${detalhe}`)
    }

    if (pronto) prontos++
  }
}

console.log('\n' + '═'.repeat(60))
console.log(`\nPronto para rodar: ${prontos}/${totalSistemas} sistemas`)
console.log(`Bloqueios: ${erros}  ·  Alertas: ${alertas}`)
console.log(
  erros === 0
    ? '\n✅ Nenhum bloqueio.\n'
    : '\n❌ Resolva os bloqueios acima antes de rodar a esteira nesses sistemas.\n' +
      '   Dica: configure UM sistema primeiro (npm run doctor -- <cliente> <sistema>).\n',
)

process.exit(erros === 0 ? 0 : 1)
