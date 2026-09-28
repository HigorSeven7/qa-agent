# Skills arquivadas

Skills vendorizadas de [`petrkindlmann/qa-skills`](https://github.com/petrkindlmann/qa-skills)
(MIT, commit `b3bb61b`) que saíram de `.claude/skills/` em **22/09/2026**.

**Nada foi apagado.** O material está inteiro aqui, com `references/`. O que mudou é que
elas não ocupam contexto em toda sessão e não disparam sozinhas.

## Por que saíram

Nenhuma delas era invocada por comando ou subagente. As três únicas invocações do projeto são
`analise-branch`, `test-data-management` e `clickup-qa-workflow`, todas no `/testar-tarefa`.
As arquivadas apareciam só na tabela de `docs/regras/skills.md` — ou seja, nunca rodavam por
decisão da esteira, só por acaso, se a `description` casasse com alguma frase do chat.

| Skill | Por que não se aplica | O que foi resgatado, e para onde |
|---|---|---|
| `exploratory-testing` | A etapa 4 delega ao `qa-explorador` com entregável fixo (`03-mapa-seletores.md` + `03b-inventario-acoes.md`), não sessão SBTM timeboxed. Os bancos de ideias viraram o `catalogo-exploratorio.md`, organizado por tipo de elemento. | **os 10 oráculos (HICCUPS / FEW HICCUPS)** → seção "Os dez oráculos" do `catalogo-exploratorio.md` |
| `risk-based-testing` | Obrigatório é a projeção exata dos `CA0N` — risco não decide o que entra no plano. Heatmap e entrevista com stakeholder são ferramenta de release, não de card. | **escala Impacto 1-5 × Probabilidade 1-5** → seção "Como ordenar os 6 por risco" do `catalogo-exploratorio.md` |
| `database-testing` | O agente não roda migration em ambiente de cliente, não usa Testcontainers, não faz seed (massa nasce pela tela) e não mexe em índice. Base `db.producao: true` é bloqueada. Acesso a banco de cliente é a skill global de acessos da empresa (fora do repositório). | **as 3 verificações de integridade** (órfão, unicidade não constrangida, tipo/precisão) → seção "Conferir no banco o que a tela gravou" do `catalogo-exploratorio.md` |
| `bug-reproduction` | `git bisect` é impossível: os repos do cliente são read-only e `bisect` faz checkout. Escrever o teste que falha antes da correção e o revert-to-verify são trabalho do dev, não do QA. | **a tabela flaky × ambiente × dado × não-reproduzível (Step 7)** e a regra de não fechar na primeira tentativa → etapa 8 do `/testar-tarefa` |
| `api-testing` | Confirmado com o QA: não há tarefa só de API neste fluxo; endpoint se valida pela tela. A `description` ainda disparava em `tests/<modulo>/`, caminho extinto desde o commit `66af4d2`. | — |

## Como reativar uma

```bash
git mv docs/skills-arquivadas/<nome> .claude/skills/<nome>
```

Ao reativar, conserte a `description` antes de usar — duas delas apontam para caminhos que não
existem mais:

- `api-testing`: `tests/<modulo>/<modulo>.api.spec.ts` → `tarefas/<ID>/specs/*.api.spec.ts`
- `risk-based-testing`: `.contexto/<TAREFA>/` → `tarefas/<ID>/contexto/`

E ligue a invocação num comando ou subagente. Skill que ninguém invoca volta a ser peso morto.
