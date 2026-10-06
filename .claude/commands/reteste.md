---
description: Reexecuta o teste de uma tarefa que voltou de REPROVADO após correção do dev
argument-hint: <ID da tarefa> [--local]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill, mcp__claude_ai_ClickUp__*
---

# Reteste — $ARGUMENTS

A tarefa já foi testada e reprovada antes. Reaproveite o que existe, não recomece do zero.

## 0. Achar a tarefa da rodada atual

O reteste **não** acontece na tarefa que reprovou. Ela ficou em `REPROVADO` como histórico e
uma tarefa nova foi criada com o número incrementado (`QA01-` → `QA02-` → …), em `BACKLOG`.

Busque todas as `QA0*-` pareadas com a tarefa do dev e use a de **maior número** — é nela que
você vai comentar e anexar no passo 5. Você não move nem cria tarefa: se só existir a tarefa
reprovada, a rodada nova ainda não foi criada por mim — pare e me avise antes de seguir.

## Estado da esteira

Rode `npx tsx scripts/estado.ts mostrar <TAREFA>` antes do passo 0. As regras de retomada e de
gravação são as mesmas do `/testar-tarefa` (seção "Estado da esteira"). Os passos deste
comando têm IDs próprios: `R0` a `R5`.

- **Primeiro reteste da tarefa:** `npx tsx scripts/estado.ts iniciar <TAREFA> --fluxo reteste --tarefaQA <QA0N- atual>`.
  As etapas do `/testar-tarefa` ficam como estão.
- **Rodada nova** (os `R*` já estão concluídos de uma `QA0N-` anterior): acrescente
  `--nova-rodada`. Isso zera só os `R*` e o gate do achado.
- **Reteste já em andamento:** mostre a `etapaAtual` e retome dali, sem refazer passo concluído.
- No fim de cada passo: `concluir <TAREFA> R<n> --arquivo …` — o resumo sai do `## Resumo` do
  arquivo (até 20 linhas). Passo sem arquivo: `--resumo "…"`, cortado em 20 linhas.
- Se um complementar falhar e reproduzir, o gate do achado grava a minha resposta:
  `gate <TAREFA> achado --resposta <reprova|achado> --cenario CX0N`.
- Cenário novo complementar que precise do meu OK (passo 3):
  `gate <TAREFA> complementares --resposta "…" --propostos …`.

Os resumos das etapas concluídas no `estado.json` são o ponto de partida do passo 1. Abra o
arquivo de contexto inteiro só onde o resumo não bastar.

## 1. Recuperar o histórico

- Leia `tarefas/<TAREFA>/contexto/` inteiro — `01-tarefa.md` (os `CA0N` e suas fontes), plano com a
  matriz CA → CT, mapa de seletores, inventário de ações e análise de código anteriores.
  **Os `CA0N` não mudam no reteste** a menos que a descrição do card tenha mudado — confira, e
  se mudou, refaça a matriz.
- Leia os comentários **novos** da tarefa do dev desde a última execução: o que ele diz ter
  corrigido, e se mudou algo além do apontado.
- Leia o `tarefas/<TAREFA>/evidencias/resultado.json` anterior para saber exatamente quais cenários
  falharam.

## 2. Ver o que mudou no código

Invoque a skill **`analise-branch`**. Valem as regras dela, e uma acima de todas: **toda leitura
sai de ref explícita, nunca do disco.** `HEAD` é a branch que eu tiver aberta na máquina, não a
da tarefa. Diff contra `HEAD` pode vir vazio e fazer parecer que o dev não corrigiu nada.

Faça para **cada** repositório do sistema (`repos.front` e `repos.back` de `config/clientes.json`):

```bash
REPO="<clientes.<c>.sistemas.<s>.repos.front|back>"
BASE="<branchBase>"                       # develop = o que está no ar em hmlg
ANT="<sha analisado na rodada anterior>"  # do 02-codigo.md ou do estado.json; nunca HEAD
git -C "$REPO" fetch --all --prune
git -C "$REPO" rev-parse --short "$ANT"   # confirma que o sha existe
```

**Caso normal — a correção já foi mergeada na base (alvo hmlg).** Liste só os merges e commits
**da tarefa** que entraram depois da rodada anterior:

```bash
git -C "$REPO" log --oneline "$ANT..origin/$BASE" --grep="<TAREFA>"
```

Para cada merge listado, o diff é o que ele trouxe: `git -C "$REPO" diff <merge>^1 <merge>`.
Commit sem merge (squash/fast-forward): `git -C "$REPO" diff <sha>^ <sha>`.

**Não** use `git diff "$ANT..origin/$BASE"`: ele traz junto tudo o que os outros devs
mergearam no meio, e a regressão vira palpite.

**Exceção — branch ainda aberta (alvo `--local`):**

```bash
BRANCH="origin/<branch da tarefa>"        # resolvida pelo passo 1 da analise-branch
git -C "$REPO" log  --oneline "$ANT..$BRANCH"
git -C "$REPO" diff --stat    "$ANT" "$BRANCH"
git -C "$REPO" diff           "$ANT" "$BRANCH"
```

**Diff vazio não prova que o dev não corrigiu.** Antes de concluir isso:

1. Confira se você usou a ref certa (mergeada → base; aberta → branch).
2. Procure o ID em `git -C "$REPO" log --all --oneline --grep="<TAREFA>" -20`.
3. Leia o comentário do dev. Ele pode ter corrigido em outro repositório ou em outra branch.

Se continuar vazio, diga isso no comentário com os comandos rodados. Nunca reprove só por isso.

Grave o sha novo no `02-codigo.md` (seção da rodada) — ele é o `ANT` do próximo reteste.

Se a correção tocou arquivos **fora** do escopo do bug, amplie a regressão: o dev pode ter
corrigido uma coisa e quebrado outra. Isso é o cenário mais comum de reprova em segunda volta.

Seletor novo ou alterado sai de `git -C "$REPO" show "origin/$BASE:<arquivo>"` (ou da
`$BRANCH` no `--local`), nunca do arquivo em disco.

## 3. Atualizar o que ficou obsoleto

Se a correção renomeou `data-testid`, mudou rota, mudou payload ou mudou mensagem de
validação → atualize o mapa de seletores, o `03b-inventario-acoes.md` e o Page Object
**antes** de rodar. Ação nova que a correção trouxe entra no inventário; se ela sugerir um
cenário novo, ele é **complementar** e precisa do meu OK — a menos que cubra um `CA0N` que
estava descoberto, e aí é obrigatório.

## 4. Executar em três camadas

```bash
CLIENTE=<c> SISTEMA=<s> npm run acompanhar -- tarefas/<TAREFA>/specs -g "CT03"  # 1) o que falhava, ele acompanhando
CLIENTE=<c> SISTEMA=<s> npm test -- tarefas/<TAREFA>/specs -g "CT03"            # 2) os mesmos cenários, rodada oficial
CLIENTE=<c> SISTEMA=<s> npm test -- tarefas/<TAREFA>/specs                      # 3) a suíte do módulo (regressão)
```

E rode também os módulos vizinhos que o diff da correção toca.

### 4.1 Se o cenário falhou de novo — classifique antes de reprovar

Reprovar duas vezes seguidas por erro de script é o pior desfecho possível: o dev perde duas
rodadas por um bug que não existe. Antes de concluir qualquer coisa:

| Sintoma | Ação |
|---|---|
| Falhou de novo, **do mesmo jeito**, e reproduz manualmente | é bug real que não foi corrigido → `REPROVADO`, com a evidência das duas rodadas |
| Falhou **de outro jeito** (seletor sumiu, timeout novo) | a correção mexeu na tela → volte ao passo 3, atualize o mapa, rode de novo |
| **Passa às vezes**, ou passa em `local` e falha em `hmlg` | invoque a skill **`test-reliability`** — ela classifica a causa (não-determinismo × ambiente × dado) antes de você decidir entre bug, script e ambiente |
| Não reproduz de jeito nenhum | não feche como "não reproduz": registre ambientes, nº de execuções e dado tentados, e declare `inconclusivo` |

Teste instável entre rodadas de QA é a dor nº 1 deste projeto, e `REPROVADO` em cima de flaky
queima a credibilidade do robô inteiro. Use a skill — não decida no olho.

## 5. Publicar (só anexo e comentário)

Antes de publicar, rode `npx tsx scripts/verificar-esteira.ts <TAREFA>`. Corrija as FALHAS e
confira à mão só os itens MANUAL, como na etapa 11 do `/testar-tarefa`.

Você **não move coluna e não cria a rodada seguinte**. O veredito vira texto no comentário;
a movimentação no quadro é minha, manual.

### 5.1 — Rascunho do veredito (você decide)

Grave `tarefas/<TAREFA>/contexto/rascunho-veredito.md` com as mesmas seções da etapa 9 do
`/testar-tarefa`, **mais** estas três:

```
## Corrigido pelo dev
<o que ele disse nos comentários novos>

## Verificado
<o que você confirmou>

## Comparativo antes/agora
| CT   | Antes | Agora |
|------|-------|-------|
| CT03 | ❌    | ✅    |
Regressão do módulo: ✅ <n>/<n>
```

**Veredito `APROVADO`** se todos os **obrigatórios** passaram, incluindo a regressão → implica
QA `APROVADO` e dev `EM VALIDAÇÃO (PO/CLIE)`, movidos por mim. Se só um **complementar**
(`CX0N`) falhou, o veredito continua `APROVADO`, **sem sufixo**, e o achado sai **em destaque** no
comentário — complementar não reprova. "APROVADO com ressalva" não existe como veredito.

**Veredito `REPROVADO`** só quando um cenário **obrigatório** (o que veio de um `CA0N`) ainda
falha por bug do sistema, reproduzido manualmente → implica QA `REPROVADO`, dev `PRIORIZADO` e a
abertura da `QA0<N+1>-` em `BACKLOG`, tudo por mim. Nesse caso seja específico sobre o que
**continua** errado versus o que foi corrigido, para o dev não ter que adivinhar, e entregue
no comentário os dados da próxima rodada (título sugerido, lista, CTs que falharam, links) —
mesmo conteúdo que a etapa 10 do `/testar-tarefa` pede. Isso se repete a cada rodada até
aprovar.

### 5.2 — Gerar evidência e publicar (subagente)

Delegue ao **`qa-publicador`** com `fluxo: reteste`. Passe: `<TAREFA>`, ID da tarefa do dev,
ID da tarefa de QA da **rodada atual** (a de maior número, achada no passo 0) e o nível do PDF.

Ele gera o PDF, anexa PDF + `resultado.json` na tarefa de QA e comenta nas duas tarefas. Ele
**não** decide nem muda o veredito.

- Algum item `falhou` → corrija a causa e chame de novo **só** para o que falhou.
- `Veredito publicado` diferente do rascunho → pare e me avise.
