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

```bash
REPO="<clientes.<id>.repos.front de config/clientes.json>"

git -C "$REPO" fetch --all --prune
git -C "$REPO" log --oneline <sha-anterior>..HEAD    # commits novos na branch
git -C "$REPO" diff --stat <sha-anterior>..HEAD      # o que a correção mexeu
git -C "$REPO" diff <sha-anterior>..HEAD             # o diff em si
```

Se a correção tocou arquivos **fora** do escopo do bug, amplie a regressão: o dev pode ter
corrigido uma coisa e quebrado outra. Isso é o cenário mais comum de reprova em segunda volta.

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

Mesmo padrão do `/testar-tarefa`, etapa 10 — **dois passos, e só eles**:

1. `clickup_attach_task_file` na **tarefa de QA da rodada atual**: PDF de evidência,
   `resultado.json` e o zip das imagens, se forem muitas.
2. `clickup_create_comment` **nas duas tarefas** — completo na de QA, curto na do dev.

Você **não move coluna e não cria a rodada seguinte**. O veredito vira texto no comentário;
a movimentação no quadro é minha, manual.

Comentário na tarefa de QA:

```
🔁 Reteste — <TAREFA> (rodada <N>)

Cliente: <nome>  ·  Ambiente: hmlg

Corrigido pelo dev: <o que ele disse>
Verificado: <o que você confirmou>

Cenários que falhavam:
| CT   | Antes | Agora |
|------|-------|-------|
| CT03 | ❌    | ✅    |

Regressão do módulo: ✅ <n>/<n>
Novos achados nesta rodada: <nenhum | lista>

Veredito sugerido: <APROVADO|REPROVADO|BLOQUEADO> — <justificativa em 1 linha>
Ação sua (humano): <a movimentação que o veredito pede>
```

Comentário na tarefa do dev: versão curta com o antes/agora dos CTs, o veredito sugerido e
o link da tarefa de QA onde está a evidência.

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
