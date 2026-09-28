---
name: clickup-qa-workflow
description: Regras de operação no ClickUp para o fluxo de QA — pareamento da tarefa do dev com a tarefa QA01-, qual veredito declarar no comentário, formato dos comentários e como anexar evidência. O agente nunca move coluna nem cria tarefa. Use sempre que for ler ou escrever em tarefa do ClickUp.
---

# Fluxo de QA no ClickUp

## O que o agente escreve no ClickUp

Duas ações, e só elas:

| Ação | Ferramenta | Onde |
|---|---|---|
| Comentário do resultado | `clickup_create_comment` | **nas duas tarefas** — a de QA (`QA0N-`) **e** a do dev |
| Anexo da evidência (PDF + `resultado.json` + zip das imagens) | `clickup_attach_task_file` | **só na tarefa de QA** |

**Proibido em qualquer situação, inclusive quando o resultado for aprovado:**

- Mudar status/coluna de qualquer tarefa (`clickup_update_task`).
- Criar tarefa (`clickup_create_task`) — inclusive a rodada seguinte quando reprovar.
- Qualquer outra escrita: link, tag, dependência, mover de lista, editar comentário.

Todas essas ferramentas estão em `deny` no `.claude/settings.json`. O veredito continua
existindo — ele só deixa de virar coluna e passa a ser **texto no comentário**. Quem move o
quadro e abre a próxima rodada é o QA, na mão.

Tudo o que vem abaixo sobre quadros, colunas, rodadas e pareamento é **contexto de leitura**:
o agente precisa entender o fluxo para achar a tarefa certa e declarar o veredito certo.

## Os dois quadros

**Quadro dos DEVs** — três colunas importam para você:

| Coluna | Significado |
|---|---|
| `EM TESTE (QA)` | Gatilho. O código **já está em homologação**. É aqui que seu trabalho começa. |
| `EM VALIDAÇÃO (PO/CLIE)` | Destino quando você **aprova**. O PO/cliente valida em hmlg. |
| `PRIORIZADO` | Destino quando você **reprova**. Volta para a fila do dev corrigir. |

Consequência prática disso: **hmlg é o alvo padrão de execução**, porque é o ambiente onde
o PO vai validar em seguida. Aprovar em localhost e o PO reprovar em hmlg é retrabalho seu.

**Quadro de QA** (seu):

`BACKLOG` · `TESTANDO` · `BLOQUEADO` · `REPROVADO` · `LIBERADA SEM TESTE` · `APROVADO`

## Identificar o cliente da tarefa

O workspace atende vários clientes, cada um com URL, credencial e repositório próprios.
Antes de qualquer teste, descubra o cliente nesta ordem:

1. **Custom field** da tarefa (cliente / projeto / sistema) — `clickup_get_custom_fields`.
2. **Space / folder / lista** da tarefa — `clickup_get_workspace_hierarchy`.
   Cacheie o resultado em `.cache/clickup-hierarquia.json`; a hierarquia muda pouco e a
   chamada é cara.
3. **Aliases** em `config/clientes.json` (`clientes.<id>.clickup.aliases`).
4. **Pergunte.** Nunca assuma o `clientePadrao`.

Se o quadro de QA for compartilhado entre clientes, o cliente vem da tarefa do **dev**, não da
sua. Se cada cliente tiver quadro próprio, preencha `clientes.<id>.clickup.listaDevs` /
`listaQA` em `config/clientes.json` e a busca fica direta.

## Pareamento das tarefas

A tarefa de QA = `QA01-` + o título **exato** da tarefa do dev, linkada a ela.
Ex.: dev `Corrigir cálculo de frete no checkout` → QA `QA01-Corrigir cálculo de frete no checkout`.

Sempre parta da tarefa do dev. Para achar a de QA:

1. Tarefas linkadas / relacionadas no retorno de `clickup_get_task`
2. `clickup_search` pelo título com o prefixo `QA0` (pega todas as rodadas de uma vez)
3. `clickup_search` pelo ID da tarefa do dev na lista de QA

Não achou nenhuma? **Pare e pergunte.** Não crie a `QA01-` por conta própria — se ela não
existe, provavelmente a tarefa não entrou no fluxo de QA ainda.

## Rodadas — o prefixo é o contador

Cada tarefa de QA vale por **uma rodada de teste** e nunca é reaproveitada. Reprovou:
a tarefa fica em `REPROVADO` para sempre, e a rodada seguinte é uma **tarefa nova**, com o
número incrementado — `QA01-` → `QA02-` → `QA03-`, até uma rodada aprovar.

**Comente e anexe sempre na tarefa de maior número que ainda não foi concluída.** Se existem
`QA01-` (em `REPROVADO`) e `QA02-` (em `BACKLOG`), é na `QA02-` que você escreve. A `QA01-`
é histórico fechado — não comente, não anexe, não toque.

### A próxima rodada quem cria é o humano

O agente **não cria** a `QA0<N+1>-`. Quando o veredito for `REPROVADO`, ele entrega no
comentário os dados prontos para o QA abrir a tarefa na mão:

| Dado a entregar no comentário | Valor |
|---|---|
| Título sugerido | `QA0<N+1>-` + o mesmo título da tarefa do dev (copie o padrão exato da rodada atual) |
| Lista onde criar | a mesma da rodada atual — diga o nome |
| CTs que falharam | com passos de reprodução e esperado vs obtido |
| Links | tarefa do dev, tarefa da rodada atual e a evidência anexada |

Para referência do humano, a tarefa nova nasce em `BACKLOG`, com o QA como responsável
e linkada à tarefa do dev e à rodada anterior.

## Veredito no comentário

O agente **declara** o veredito no texto; ele não move nada. A coluna é consequência manual.

| Situação | Veredito a declarar | Movimentação manual que ele implica | Comentar na tarefa do dev? |
|---|---|---|---|
| Todos os cenários obrigatórios passaram | `APROVADO` | QA → `APROVADO` · dev → `EM VALIDAÇÃO (PO/CLIE)` | **sim** (sempre) |
| Obrigatórios passaram, um **complementar** (`CX0N`) falhou, e no gate do achado o QA respondeu `achado` (ou o gate não disparou) | `APROVADO` (sem sufixo) | QA → `APROVADO` · dev → `EM VALIDAÇÃO (PO/CLIE)` | **sim** — com o achado **em destaque**, para o QA decidir se vira tarefa |
| Obrigatórios passaram, um **complementar** falhou, e no gate do achado o QA respondeu **`reprova`** | `REPROVADO` | QA → `REPROVADO` · dev → `PRIORIZADO` · abrir a `QA0<N+1>-` em `BACKLOG` | **sim** — com a frase de decisão humana (abaixo) e passos de reprodução |
| Cenário obrigatório falhou por **bug do sistema**, reproduzido manualmente | `REPROVADO` | QA → `REPROVADO` · dev → `PRIORIZADO` · abrir a `QA0<N+1>-` em `BACKLOG` | **sim** — com passos de reprodução e print |
| Ambiente fora, integração de terceiro indisponível, credencial inválida, VPN ausente, feature não subiu — **e o destrave foi tentado e registrado** | `BLOQUEADO` | QA → `BLOQUEADO` · dev não se mexe | **sim** — dizendo o que foi tentado e o que ainda destrava |
| Sem impacto testável (doc, refactor interno sem mudança de comportamento) | `LIBERADA SEM TESTE` | QA → `LIBERADA SEM TESTE` · dev não se mexe | **sim** (curto) |

**Os vereditos são exatamente quatro:** `APROVADO` · `REPROVADO` · `BLOQUEADO` ·
`LIBERADA SEM TESTE`. **"APROVADO com ressalva" não existe** — não escreva o sufixo em lugar
nenhum.

**Só cenário obrigatório reprova por decisão do agente.** Obrigatório é o que nasce de um
`CA0N` (critério de aceite da descrição do card, refinamento técnico incluído; ou inferido do
diff quando a descrição não trouxe nenhum). Complementar (`CX0N`) que falha vira **achado** no
comentário das duas tarefas, com passos de reprodução. O veredito continua `APROVADO`, puro, e
o achado sai **em destaque** no comentário.

### A exceção: o gate do achado

Quando um `CX0N` falha **e a falha reproduz manualmente**, a esteira para antes de publicar e
pergunta ao QA se aquilo reprova a tarefa (gate do achado do `/testar-tarefa`). Só a resposta
`reprova` autoriza `REPROVADO` em cima de complementar — e nesse caso o comentário das duas
tarefas precisa trazer, **literalmente**, esta frase:

> Reprovação decidida pelo QA humano sobre cenário complementar `CX0N` — nenhum critério de
> aceite falhou.

Ela existe para o dev não interpretar a reprovação como CA quebrado, e para o histórico do
quadro continuar legível meses depois.

**Sem o `reprova` registrado, não escreva `REPROVADO`.** O agente nunca decide isso sozinho, e
`APROVADO` continua sendo o padrão quando todos os obrigatórios passaram.

### `BLOQUEADO` é último recurso, não primeira saída

Antes de declarar `BLOQUEADO`, o agente é **obrigado** a tentar destravar o que está ao alcance
dele em hmlg: configurar fluxo, parâmetro, cadastro básico, perfil, acesso, feature flag, e gerar
a massa que falta. Cada tentativa e o resultado dela ficam registrados em
`tarefas/<TAREFA>/contexto/04b-preparo-ambiente.md`.

| Destravável pelo agente (resolve e segue) | `BLOQUEADO` legítimo |
|---|---|
| acesso/permissão do usuário de teste | ambiente fora do ar / erro 5xx generalizado |
| massa inexistente, ou dado de produção citado na tarefa | integração de terceiro indisponível |
| fluxo, parâmetro ou cadastro básico não configurado | credencial inválida ou conta bloqueada |
| perfil de acesso, filial | VPN exigida e ausente (`requerVpn: true`) |
| feature flag em hmlg | banco marcado `db.producao: true` (trava intencional) |
| | a feature não subiu para hmlg |

Declarar `BLOQUEADO` exige dizer, **no comentário**, o que foi tentado e por que não destravou.
"Faltou massa" sem tentativa registrada não é `BLOQUEADO` — é trabalho não feito.

Duas travas que não se afrouxam (regra completa em `CLAUDE.md` → "🧪 Preparo do ambiente"):

- **Raio de alcance.** Só o usuário de teste e registro novo com prefixo `QA-` → o agente resolve
  sozinho. Registro **pré-existente** → captura antes, restaura depois, e diz no comentário.
  Configuração **compartilhada ou global** (parâmetro do sistema, feature flag global, cadastro
  básico usado por outras telas, integração) → **para e pergunta ao QA, sempre**.
- **Não configure à mão o que um `CA0N` pedia que o sistema fizesse sozinho.** Isso produz
  `APROVADO` em cima do bug. Se é o comportamento sob teste, não configure — é `REPROVADO` ou
  achado.

Orçamento: no máximo **3 tentativas** para o mesmo obstáculo, e nada de destrave que passe de
~10 minutos de setup sem consultar o QA.

**Dois avisos que precisam sair em destaque no comentário, quando existirem:**

- `CA0N` `[inferido do diff]` — a descrição do card não trazia critério de aceite:
  > Testei contra estes critérios inferidos do código porque a **descrição** do card não trazia
  > critério de aceite. Se a intenção era outra, o veredito muda.
- Comentário ou anexo contradizendo um `CA0N` da descrição — o CA continua valendo:
  > ⚠️ CA03 pode estar fora de escopo: o comentário de @autor (data) diz que o campo foi
  > removido desta entrega, mas a descrição do card ainda pede. Testei contra a descrição,
  > conforme a regra do projeto. Se o escopo mudou mesmo, a descrição precisa ser atualizada.

Ordem: anexar a evidência na tarefa de QA → comentar na tarefa de QA → comentar na tarefa do
dev. O comentário na tarefa do dev é sempre, aprovado ou não — é ele que avisa o time que o
QA terminou, já que a coluna vai demorar até eu mover.

O comentário sempre fecha com duas linhas explícitas:

```
Veredito sugerido: REPROVADO — 1 cenário falhou por bug do sistema (CT03).
Ação sua (humano): mover QA → REPROVADO, dev → PRIORIZADO, e abrir a QA02- da próxima rodada.
```

### Regras de segurança

- **Nunca declare `APROVADO`** se: algum cenário **obrigatório** falhou, algum `CA0N` ficou sem
  cenário, a suíte não rodou até o fim em hmlg, faltou evidência de algum cenário, ou o
  `qa-revisor` deu veredito diferente de confiável. Complementar (`CX0N`) que falha **não**
  impede o `APROVADO`.
- **Declarar `REPROVADO` exige reprodução manual.** Falha de script não é bug. Reprovar por
  seletor errado queima a credibilidade do processo inteiro.
- **`REPROVADO` versus `BLOQUEADO`:** culpa do sistema sob teste → reprovado. Culpa do
  ambiente ou da infra, **e o destrave foi tentado e registrado sem sucesso** → bloqueado.
- **Nunca declare `BLOQUEADO` sem tentativa de destrave registrada** em
  `04b-preparo-ambiente.md`, e sem dizer no comentário o que foi tentado.
- **Evidência de localhost nunca aprova.** Se o teste rodou com `AMBIENTE=local`, diga isso
  explicitamente no comentário e trate como parcial.

## Formato do comentário de resultado

```
🤖 Teste automatizado — MVF-XXXXX

Cliente: Acme
Ambiente: hmlg · https://hmlg.sistema.com.br
Branch: feature/MVF-XXXXX @ a1b2c3d
Execução: 2026-08-17 14:32

Cenários: 6 executados — ✅ 5 aprovados · ❌ 1 reprovado · ⛔ 0 bloqueados

| CT   | Cenário                              | Resultado |
|------|--------------------------------------|-----------|
| CT01 | Cadastra cliente com dados válidos   | ✅        |
| CT02 | Bloqueia nome vazio                  | ✅        |
| CT03 | Rejeita CNPJ duplicado               | ❌        |

## Achados

**CT03 — CNPJ duplicado é aceito**
Passos: 1) ... 2) ... 3) ...
Esperado: erro "CNPJ já cadastrado"
Obtido: registro salvo, toast de sucesso, dois registros com o mesmo CNPJ na listagem
Evidência: 03-ct03-cnpj-duplicado-aceito.png
Reproduzido manualmente: sim

## Observações de testabilidade
- Botão de exclusão do grid sem `data-testid` — usei getByRole como fallback

Specs: tarefas/MVF-XXXXX/specs/clientes.spec.ts

Veredito sugerido: REPROVADO — CT03 falhou por bug do sistema, reproduzido manualmente.
Ação sua (humano): mover QA → REPROVADO, dev → PRIORIZADO, e abrir a próxima rodada:
  Título: QA02-Cadastrar cliente PJ na gestão de carteira
  Lista: QA — CRM Acme
  Reconferir: CT03 (CNPJ duplicado)
```

### Comentário na tarefa do dev (versão curta, sempre)

```
🤖 Teste automatizado — MVF-XXXXX (rodada QA01)

Cenários: 6 executados — ✅ 5 · ❌ 1 · ⛔ 0
Veredito sugerido: REPROVADO

Achados:
**CT03 — CNPJ duplicado é aceito**
Passos: 1) ... 2) ... 3) ...
Esperado: erro "CNPJ já cadastrado" · Obtido: registro salvo, dois com o mesmo CNPJ
Reproduzido manualmente: sim

Evidência completa (PDF + resultado.json) anexada na tarefa de QA: <link da QA01->
```

### Comentário de bloqueio

```
⛔ Teste bloqueado — MVF-XXXXX

Motivo: <o que impede>
Ambiente: hmlg
Tentativas: <o que você tentou>
Para destravar preciso de: <ação concreta e de quem>

Cenários já validados antes do bloqueio: CT01 ✅ CT02 ✅
```

## Anexos

- `clickup_attach_task_file` na **tarefa de QA**, não na do dev.
- Anexe: o arquivo de evidência consolidado e, se as imagens forem muitas, um `.zip` delas.
- Anexe o `resultado.json` também — é o registro estruturado da execução.
- Não anexe: `node_modules`, trace do Playwright (pesado, só se pedirem), vídeo de teste que
  passou.

## Ao ler tarefa

Sempre leia **descrição + todos os comentários + todos os anexos**. A regra que decide o
teste está no comentário mais vezes do que na descrição. Ver `qa-analista` para o roteiro.
