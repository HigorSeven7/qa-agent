> Regra do projeto — parte de `CLAUDE.md`. Mesma força do arquivo principal.

## 🧩 Skills — quem manda quando divergem

`.claude/skills/` tem duas origens.

**Locais (do projeto)** — `playwright-padrao`, `analise-branch`, `captura-evidencia`,
`clickup-qa-workflow`. São a lei deste projeto.

**Vendorizadas** de [`petrkindlmann/qa-skills`](https://github.com/petrkindlmann/qa-skills)
(MIT, commit `b3bb61b`), corpo em inglês, cada uma com um bloco de precedência no topo.

### Quem é invocada, e onde

**Toda skill instalada tem um gancho.** Skill que ninguém invoca vira peso morto: a
`description` custa contexto em toda sessão e o corpo nunca entra. Se você instalar uma nova,
ligue-a a um comando ou subagente na mesma mudança.

| Skill | Origem | Invocada em | Para quê |
|---|---|---|---|
| `analise-branch` | local | subagente `qa-codigo` (`/testar-tarefa` etapa 2) · `/analisar-tarefa` | achar a branch, escolher o diff certo, extrair rota/endpoint/`data-testid` |
| `clickup-qa-workflow` | local | `/testar-tarefa` etapa 10 | formato dos comentários e do anexo |
| `playwright-padrao` | local | `/testar-tarefa` etapas 5 e 7 | template do plano e padrão de Page Object |
| `captura-evidencia` | local | `/evidencia` | contrato do `resultado.json` e a capa |
| `test-data-management` | vendor | `/testar-tarefa` etapa 3.5 | massa sintética, subordinada à regra de massa |
| `ai-qa-review` | vendor | subagente `qa-revisor`, antes das checagens | método das seis dimensões de smell e do falso verde |
| `selector-drift-recovery` | vendor | subagente `qa-explorador`, etapa 3 | **3 ou mais** locators quebrados no mesmo Page Object — drift, não conserto avulso |
| `test-reliability` | vendor | `/reteste` passo 4.1 | cenário que passa às vezes, ou passa em `local` e falha em `hmlg` |

### Arquivadas

`exploratory-testing`, `risk-based-testing`, `api-testing`, `database-testing` e
`bug-reproduction` saíram de `.claude/skills/` em 22/09/2026. O material está inteiro em
`docs/skills-arquivadas/`, com o motivo de cada uma e o que foi resgatado — leia o
`LEIA-ME.md` de lá antes de reativar qualquer uma.

O método que valia a pena delas vive agora no
`.claude/skills/playwright-padrao/references/catalogo-exploratorio.md` (os dez oráculos, a
escala de risco, as verificações no banco) e na etapa 8 do `/testar-tarefa` (flaky × ambiente
× dado × não-reproduzível).

### Ordem de autoridade

**Sem exceção: `CLAUDE.md` → `docs/regras/` → skills locais → vendorizadas.**

Onde uma skill vendorizada contradisser o `CLAUDE.md`, **vale o `CLAUDE.md`**. Em particular
ela pode sugerir `getByRole` antes de `data-testid`, layout `e2e/{fixtures,pages,tests}`,
`waitForTimeout`, import direto de `@playwright/test` e gate de CI — **nada disso vale aqui**.
Elas também citam skills irmãs que **não** foram instaladas (`playwright-automation`,
`ai-bug-triage`, `test-strategy`, `ci-cd-integration` e outras): são referência morta,
resolva com a skill local equivalente.

`.codex/.agents/qa-project-context.md` é o resumo estruturado que essas skills sabem consumir —
todas começam com "check `.codex/.agents/qa-project-context.md`". Mantenha-o sincronizado com
o `CLAUDE.md`; se divergirem, vale o `CLAUDE.md`.

---
