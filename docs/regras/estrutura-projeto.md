> Regra do projeto — parte de `CLAUDE.md`. Mesma força do arquivo principal.

## 📂 Estrutura do projeto

> **Uma tarefa mora numa pasta só.** Contexto, spec, massa, evidência, documento
> final — e o código que só ela usa — ficam juntos em `tarefas/<ID>/`. O que é
> reusado por mais de uma tarefa fica fora: `pages/<sistema>/`, `support/` e
> `scripts/`. Duplicar Page Object por tarefa é dívida, não isolamento.

**Onde mora o código:**

| Código | Usado por | Onde |
|---|---|---|
| Page Object | uma tarefa só | `tarefas/<ID>/pages/<modulo>.page.ts` |
| Page Object | mais de uma tarefa | `pages/<sistema>/<modulo>.page.ts` (um subdiretório por sistema) |
| Classe base | todas | `pages/base.page.ts` na raiz (PrimeVue); base própria de um sistema em `pages/<sistema>/<sistema>.page.ts` |
| Script (sonda, repro, massa, limpeza) | uma tarefa só | `tarefas/<ID>/scripts/` — **fora do git** |
| Script | o projeto | `scripts/` |

Quando uma segunda tarefa precisar de um Page Object que mora em `tarefas/<ID>/pages/`,
suba-o para `pages/<sistema>/` com `git mv` e corrija os imports — não copie.

```
qa-agent/
├── CLAUDE.md                  ← núcleo das regras (sempre em contexto, ~4,3k tok)
├── AGENTS.md                  ← ponteiro do Codex para CLAUDE.md (sem regra própria)
├── docs/regras/              ← o resto das regras, lidas sob demanda (indexadas no CLAUDE.md)
├── config/clientes.json       ← URLs, repos, perfis por cliente+sistema (SEM segredo)
├── scripts/doctor.ts          ← npm run doctor: diagnostica a configuração
├── .env                       ← credenciais e token (NUNCA ler, NUNCA imprimir)
├── playwright.config.ts       ← N clientes × 2 ambientes; testDir = ./tarefas
├── .codex/                    ← config do Codex: agents/*.toml (gerados dos .md por
│   │                            scripts/sincronizar-codex.ts), hooks.json e
│   └── .agents/qa-project-context.md  ← contexto estruturado lido pelas skills
│                              (NÃO tem cópia das skills — a árvore única é .claude/skills/)
├── .claude/
│   ├── commands/              ← /testar-tarefa, /analisar-tarefa, /reteste, /evidencia
│   ├── agents/                ← qa-analista, qa-codigo, qa-explorador, qa-implementador,
│   │                            qa-executor, qa-revisor, qa-publicador — fonte única; o Codex recebe cópia
│   │                            em .codex/agents/*.toml via scripts/sincronizar-codex.ts
│   ├── skills/                ← ÁRVORE ÚNICA: 4 locais + 4 vendorizadas (ver docs/regras/skills.md)
│   │                            Codex lê daqui também — não existe cópia em .codex/
│   └── settings.json          ← permissões + additionalDirectories dos repos
├── repos/                     ← deve ficar VAZIA (ver repos/LEIA-ME.md)
├── pages/                     ← Page Objects reusados por mais de uma tarefa
│   ├── base.page.ts           ← classe base (PrimeVue)
│   ├── exemplo-clientes.page.ts ← molde
│   └── <sistema>/             ← um subdiretório por sistema
├── scripts/                   ← scripts do projeto (doctor, estado, medir-custo…)
├── support/                   ← clientes, env, auth, evidências, caminhos — COMPARTILHADO
├── docs/massa-em-hmlg.md      ← índice append-only do que o agente deixou nos ambientes
└── tarefas/
    ├── _exemplo/              ← modelo de referência para copiar; não roda na suíte
    └── MVF-XXXXX/
        ├── alvo.json          ← { "cliente": "acme", "sistema": "crm" }
        ├── contexto/          ← 01-tarefa.md (CA0N + acessos) · 02-codigo.md (diff) ·
        │                        03-mapa-seletores.md · 03b-inventario-acoes.md ·
        │                        04-plano.md · 04b-preparo-ambiente.md · 05-execucao.md ·
        │                        estado.json · anexos/ — todo .md abre com "## Resumo"
        ├── specs/             ← os .spec.ts da tarefa
        ├── fixtures/          ← a massa da tarefa
        ├── pages/             ← Page Object que só esta tarefa usa (*.page.ts)
        ├── scripts/           ← sonda, repro, massa, limpeza — FORA do git
        ├── evidencias/        ← screenshots numeradas · _cenarios/ · resultado.json ·
        │                        arquivos/ (xlsx, pdf e outros anexos gerados no teste)
        └── documento/         ← HTML e PDF finais da evidência
```

**O que entra no git e o que não entra.** Dentro de `tarefas/<ID>/` só `specs/`,
`fixtures/`, `pages/*.page.ts` e `alvo.json` são versionados. Todo o resto contém
dado de cliente — print de tela, contexto do card, resultado de execução, PDF — e
o `.gitignore` nega por padrão, inclusive pasta nova que alguém criar depois.
`scripts/` da tarefa fica fora de propósito: sonda e gerador de massa carregam
credencial e ID de cliente. `npm run doctor` falha se algo fora
disso aparecer em `git ls-files tarefas/`: a regra é provada, não presumida.

**Registrar tarefa nova** é criar `tarefas/<ID>/alvo.json` com o par
cliente+sistema. Não existe catálogo central — tarefa sem `alvo.json` roda em
qualquer alvo, com aviso no console.

---

