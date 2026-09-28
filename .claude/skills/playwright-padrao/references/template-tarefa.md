# 🎭 Plano de Teste — `MVF-XXXXX`

> Preencha a partir de `01-tarefa.md` (ClickUp + `CA0N`), `02-codigo.md` (diff),
> `03-mapa-seletores.md` e `03b-inventario-acoes.md` (navegador). Toda afirmação aqui deve ter
> fonte rastreável.

---

## 📋 Identificação

| Campo | Valor |
|---|---|
| **Cliente** | `<id>` — <nome> · fonte: custom field / space / alias / confirmado |
| **Tarefa do dev** | `MVF-XXXXX` — [link] |
| **Tarefa de QA** | `QA0N-...` (rodada atual) — [link] |
| **Título** | |
| **Módulo / sistema** | |
| **Repositório** | `<caminho de clientes.<id>.repos.front>` |
| **Branch analisada** | `feature/MVF-XXXXX` @ `<sha curto>` |
| **Ambiente de execução** | `hmlg` / `local` — `<baseURL do cliente>` |
| **Motivo (se local)** | |
| **Tipo de teste** | UI / API / UI+API |
| **Perfis envolvidos** | |

---

## 🎯 Matriz CA → CT

> Abre o plano. É a prova de cobertura dos critérios de aceite. `CA` sem `CT` é bloqueio:
> volte e escreva o cenário. `CT` obrigatório sem `CA` é erro de classificação.

| CA | Critério (resumo) | Fonte | CT(s) |
|---|---|---|---|
| CA01 | | `[descrição]` | CT01, CT02 |
| CA02 | | `[refinamento técnico]` | CT03 |

**Cobertura:** `<n>/<n>` CAs com pelo menos um cenário obrigatório.

**Fonte válida:** `[descrição]` · `[refinamento técnico]` (bloco dentro da descrição) ·
`[inferido do diff]` (só quando a descrição não trouxe critério — e isso sai em destaque no
comentário do ClickUp). **Nunca** `[comentário]` nem `[anexo]`.

**Divergências registradas** *(não resolvidas em silêncio — viram achado no comentário)*

| O quê | Registro |
|---|---|
| Card × refinamento técnico | vale o card; divergência anotada |
| CA × diff | testa-se contra o CA; divergência anotada |
| Comentário contradizendo CA | CA mantido; achado em destaque |

---

## 🧭 Cenários complementares propostos (gate da etapa 6)

> Saem do `03b-inventario-acoes.md` cruzado com o **catálogo exploratório**
> (`references/catalogo-exploratorio.md`, por `Tipo` da ação) e do risco do diff.
> **Opcionais**, numerados `CX0N`, **no máximo 6 por rodada**, e nenhum vira spec sem o OK do
> QA. Complementar que falha vira achado — só o gate do achado (gate do achado), respondido pelo
> QA, transforma em `REPROVADO`.
>
> Variações do **mesmo elemento** entram como **um** cenário data-driven, com os valores
> listados na coluna "Variações" — nunca um `CX` por valor.

| ID | Tipo | Cenário | Variações | Por que importa (1 linha) | Estimativa | Massa | Aprovado? |
|---|---|---|---|---|---|---|---|
| CX01 | `botao-grava` | | — | | `<X> min` | `<N> reg` | sim / não / pendente |
| CX02 | `mascara` | | 4 valores inválidos | | `<X> min` | nenhum | sim / não / pendente |

**Total estimado se aprovar tudo:** `<X> min` · **massa:** `<N>` registros (teto da rodada: 20)
**Cortados pelo teto de 6:** `<CXnn — motivo>` (ou "nenhum")

---

## 🧠 O que foi implementado

> Técnico e objetivo, derivado do **diff** — não copie a descrição da tarefa.

---

## ⚠️ Riscos e pontos de atenção

- **Regressão:** o diff toca `<arquivo/componente compartilhado>` → cobrir `<módulo vizinho>`
- **Pré-condição frágil:** ...
- **Divergência tarefa × código:** ...
- **Migração de banco:** ...

---

## 📁 Arquivos a criar/editar

- [ ] `tarefas/<TAREFA>/pages/<modulo>.page.ts` *(ou `pages/<sistema>/` se outra tarefa já usa)*
- [ ] `tarefas/<TAREFA>/specs/<modulo>.spec.ts`
- [ ] `tarefas/<TAREFA>/fixtures/<massa>.json` *(se data-driven)*

---

## ✅ Cenários

### 🟢 CT01 — <nome do cenário>

| | |
|---|---|
| **Tipo** | Obrigatório |
| **Critério de aceite** | `CA01` |
| **Perfil** | Admin |
| **Pré-condição** | |

**Passos**

1.
2.
3.

**Resultado esperado**

- [ ] `POST /api/<recurso>` retorna `201`
- [ ] Toast: `"<texto literal>"`
- [ ] Registro aparece na listagem com os dados informados *(persistência, não só o toast)*

**Seletores** *(do mapa — todos ✅ confirmados)*

| Nome | Seletor | Status |
|---|---|---|
| `btnNovo` | `getByTestId('btn-novo')` | ✅ |

**Evidências a capturar**

1. formulário aberto
2. formulário preenchido
3. sucesso confirmado na listagem

---

### 🔴 CT02 — <cenário negativo>

| | |
|---|---|
| **Tipo** | Obrigatório |
| **Critério de aceite** | `CA02` |
| **Pré-condição** | |

**Passos**

1.
2.

**Resultado esperado**

- [ ] Mensagem: `"<texto literal do código>"`
- [ ] Nenhuma chamada de API disparada *(ou `400` retornado)*
- [ ] Registro **não** persistido

---

### 🟡 CX01 — <complementar: edge case / permissão / regressão>

| | |
|---|---|
| **Tipo** | Complementar — `<mascara\|botao-grava\|numerico\|data\|texto-livre\|selecao\|grid\|upload\|endpoint\|navegacao>` |
| **Critério de aceite** | — *(complementar não aponta para CA)* |
| **Origem** | `03b-inventario-acoes.md` — <qual ação> · catálogo exploratório · risco do diff |
| **Por que importa** | <1 linha — risco observado, não palpite> |
| **Variações (se data-driven)** | <lista dos valores; senão "—"> |
| **Estimativa** | `<X> min` |
| **Massa que grava** | `<N> registros` / nenhum |
| **Prints previstos** | 1 (estado final) · 2 se a asserção compara com estado anterior |
| **Aprovado no gate** | sim / não |
| **Perfil** | |
| **Pré-condição** | |

**Passos**

1.

**Resultado esperado**

- [ ]

> Se falhar, é **achado** no comentário. Vira `REPROVADO` só se o QA responder `reprova`
> no gate do achado (gate do achado) — o agente nunca decide isso sozinho.

---

*(Um CT obrigatório para cada `CA0N`, sem exceção. Complementares só os aprovados no gate.)*

---

## 🔌 Endpoints envolvidos

| Método | Endpoint | Cenário | Status esperado | Como validar |
|---|---|---|---|---|
| `POST` | `/api/<recurso>` | CT01 | `201` | `waitForResponse` + body |
| `GET` | `/api/<recurso>/:id` | CT01 | `200` | persistência |
| `PUT` | `/api/<recurso>/:id` | CT04 | `200` | |
| `DELETE` | `/api/<recurso>/:id` | CT05 | `204` | |

---

## 🧪 Massa de dados

| Dado | Valor / estratégia | Precisa limpar? |
|---|---|---|
| Nome do cliente | `QA Teste ${Date.now()}` | Sim — deletar no `afterAll` |

> Em hmlg, dado criado e não limpo é dívida. Se o sistema não permite exclusão, use prefixo
> `QA ` para o time reconhecer e registre no comentário do ClickUp.

---

## 🚫 Fora do escopo / teste manual

| O que | Por que não automatizar |
|---|---|
| | |

---

## 📎 Observações

> Feature flags, config de cliente, histórico de reprovas, sugestões de testabilidade
> (componentes sem `data-testid`).

---

## ✅ Checklist de entrega

- [ ] Matriz CA → CT preenchida, sem nenhum `CA0N` sem cenário
- [ ] Nenhum cenário obrigatório fora dos `CA0N`
- [ ] Complementares com justificativa e estimativa; só os aprovados viraram spec
- [ ] Page Object criado/atualizado
- [ ] Spec com um `test()` por cenário obrigatório
- [ ] `criterios` preenchido em todo cenário obrigatório (`['CA01']`)
- [ ] Fixture criada (se data-driven)
- [ ] Zero `waitForTimeout`
- [ ] `npm run typecheck` passa
- [ ] `npm run list` lista todos os cenários
- [ ] Suíte passa em `--headed`
- [ ] Suíte passa em headless (`npm test`)
- [ ] Evidência de **cada** cenário em `tarefas/MVF-XXXXX/evidencias/`
- [ ] `resultado.json` gerado
- [ ] Nenhum print com dado sensível
- [ ] `qa-revisor` deu veredito confiável
- [ ] Evidência anexada na tarefa de QA + comentário publicado nas **duas** tarefas
- [ ] Nenhuma coluna alterada e nenhuma tarefa criada *(isso é manual, do QA)*
