> Regra do projeto — parte de `CLAUDE.md`. Mesma força do arquivo principal.

## 🔀 Fluxo dos dois quadros no ClickUp

**Quadro dos DEVs** — três colunas importam:

- `EM TESTE (QA)` → é o gatilho. Quando a tarefa cai aqui, o código **já está em homologação**.
- `EM VALIDAÇÃO (PO/CLIE)` → destino quando o teste **aprova**.
- `PRIORIZADO` → destino quando o teste **reprova**. Volta para a fila do dev corrigir.

**Quadro de QA** (o seu) — colunas:

`BACKLOG` · `TESTANDO` · `BLOQUEADO` · `REPROVADO` · `LIBERADA SEM TESTE` · `APROVADO`

**Pareamento das tarefas:** a tarefa de QA é `QA01-` seguido do título **exato** da tarefa do
dev (`QA01-Corrigir cálculo de frete no checkout`), e está linkada a ela. Sempre localize a
tarefa de QA a partir da tarefa do dev (pelos links da tarefa, ou por busca de título com o
prefixo `QA0`).

**Rodadas de QA — o prefixo é o contador.** Uma tarefa de QA vale por **uma rodada de teste**
e nunca é reaproveitada. Quando o teste reprova:

1. A tarefa daquela rodada fica em `REPROVADO` — **não** volta para `TESTANDO` depois.
2. A tarefa do dev vai para `PRIORIZADO`.
3. A tarefa da **próxima rodada** nasce com o prefixo incrementado
   (`QA01- ` → `QA02- ` → `QA03- `…), em `BACKLOG`.

Os três passos são **meus, manuais**. O agente não move nem cria nada — isso aqui é contexto
de leitura, para ele saber em qual tarefa comentar e o que declarar no veredito.

Isso segue até uma rodada aprovar. O histórico de reprovações fica visível no quadro, uma
tarefa por rodada — por isso reciclar a tarefa antiga apaga informação e é proibido.

Antes de testar, o agente sempre trabalha na tarefa de **maior número** que ainda não foi
concluída — é nela que ele comenta e anexa. Se a última for `QA02-` e estiver em `BACKLOG`,
é nela que ele escreve, não na `QA01-` que já está em `REPROVADO`.

**A tarefa da próxima rodada quem cria sou eu.** O agente não cria nenhuma tarefa. Quando
reprovar, ele entrega no comentário o que preciso para abrir a `QA0<N+1>-` na mão: título
sugerido (mesmo título do dev com o prefixo incrementado), a lista da rodada atual, os CTs
que falharam com passos de reprodução, e os links da rodada atual e da evidência.

### O que o agente escreve no ClickUp

Duas ações, e só elas:

| Ação | Ferramenta | Onde |
|---|---|---|
| Comentário do resultado | `clickup_create_comment` | **nas duas tarefas** — a de QA (`QA0N-`) **e** a do dev |
| Anexo da evidência (PDF + `resultado.json` + zip das imagens) | `clickup_attach_task_file` | **só na tarefa de QA** |

**Proibido em qualquer situação, inclusive quando o resultado for aprovado:**

- Mudar status/coluna de qualquer tarefa (`clickup_update_task`) — nem mover a tarefa de QA
  para `TESTANDO` no início, nem para `APROVADO` / `REPROVADO` / `BLOQUEADO` /
  `LIBERADA SEM TESTE` no fim, nem tocar na tarefa do dev.
- Criar tarefa (`clickup_create_task`) — inclusive a da próxima rodada de QA.
- Qualquer outra escrita: link, tag, dependência, mover de lista, editar comentário.

Todas essas ferramentas estão em `deny` no `.claude/settings.json`.

**O veredito continua existindo** — ele só deixa de virar coluna e passa a ser **texto no
comentário**, com duas linhas explícitas no fim:

```
Veredito sugerido: REPROVADO — 1 cenário falhou por bug do sistema (CT03).
Ação minha (humano): mover QA → REPROVADO, dev → PRIORIZADO, e abrir a QA02- da próxima rodada.
```

| Situação | Veredito a declarar | Movimentação manual que ele implica |
|---|---|---|
| Todos os cenários **obrigatórios** (os dos critérios de aceite) passaram | `APROVADO` | QA → `APROVADO` · dev → `EM VALIDAÇÃO (PO/CLIE)` |
| Todos os obrigatórios passaram, um **complementar** falhou, e no gate do achado eu respondi `achado` (ou o gate não disparou) | `APROVADO` (sem sufixo) | QA → `APROVADO` · dev → `EM VALIDAÇÃO (PO/CLIE)` · o achado fica **em destaque** no comentário para eu decidir se vira tarefa |
| Todos os obrigatórios passaram, um **complementar** falhou, e no gate do achado eu respondi **`reprova`** | `REPROVADO` | QA → `REPROVADO` · dev → `PRIORIZADO` · abrir a `QA0<N+1>-`. O comentário diz que a reprovação foi decisão minha e que nenhum CA falhou |
| Cenário obrigatório falhou por bug do sistema | `REPROVADO` | QA → `REPROVADO` · dev → `PRIORIZADO` · abrir a `QA0<N+1>-` em `BACKLOG` |
| Ambiente fora, integração de terceiro indisponível, credencial inválida, VPN ausente, feature não subiu — **e o destrave foi tentado e registrado** | `BLOQUEADO` | QA → `BLOQUEADO` · dev não se mexe |
| Tarefa sem impacto testável (doc, refactor interno sem mudança de comportamento) | `LIBERADA SEM TESTE` | QA → `LIBERADA SEM TESTE` · dev não se mexe |

O comentário na tarefa do dev é **sempre**, aprovado ou não — é ele que avisa o time que o QA
terminou, já que a coluna só muda quando eu mexer. Versão curta: resultado, veredito sugerido,
achados e o link da tarefa de QA onde está a evidência.

**Nunca declare `APROVADO` se:** algum cenário **obrigatório** falhou, algum critério de aceite
ficou sem cenário, a suíte não rodou até o fim em hmlg, faltou evidência de algum cenário, ou o
teste falhou por erro do próprio script sem ter sido corrigido e reexecutado. Em dúvida entre
`REPROVADO` e `BLOQUEADO`: se a culpa é do sistema sob teste → `REPROVADO`; se é do
ambiente/infra/dado **e o destrave foi tentado sem sucesso** → `BLOQUEADO`.

**Nunca declare `BLOQUEADO` sem tentativa de destrave registrada** em `04b-preparo-ambiente.md`,
e sem dizer no comentário o que foi tentado e por que não deu. Ver "`BLOQUEADO` é último recurso"
no Preparo do ambiente.

**Nunca declare `REPROVADO` por cenário complementar por conta própria.** Se o obrigatório
passou, a tarefa entregou o que prometeu — o resto é achado. A única exceção é eu ter
respondido `reprova` no **gate do achado**; nesse caso o comentário precisa dizer que a
reprovação foi decisão minha, e que nenhum critério de aceite falhou.

**Falha do script ≠ bug do sistema.** Antes de reprovar, confirme que a falha reproduz
manualmente pelo navegador. Reprovar por seletor errado é o pior erro possível aqui.

---

