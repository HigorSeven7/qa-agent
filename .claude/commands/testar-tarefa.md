---
description: Esteira completa de QA a partir do link da tarefa do dev no ClickUp
argument-hint: <link ou ID da tarefa do dev> [--cliente=<id>] [--sistema=<id>] [--local] [--revisar-plano] [--sem-complementares]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill, mcp__claude_ai_ClickUp__*
---

# Esteira de QA — tarefa: $ARGUMENTS

Execute a esteira abaixo **na ordem**, de ponta a ponta. Não pule etapas. Não invente dado,
não chute seletor.

**Você coordena; o trabalho pesado é de subagente.** Os subagentes devolvem **resumo**, nunca
o conteúdo inteiro dos arquivos. Você decide, pergunta nos gates e publica — e lê arquivo
inteiro só quando a sua etapa exige.

A esteira para em exatamente **dois** casos: falta de dado essencial (lista abaixo) e o
**gate da etapa 6**, quando houver cenário complementar proposto. Fora isso, siga direto.

**Flags:**
- `--cliente=<id>` → fixa o cliente (chave em `config/clientes.json`).
- `--sistema=<id>` → fixa o sistema dentro do cliente (`crm`, `portal`, `api`...).
  Um cliente pode ter vários; sem isso, você identifica na etapa 1 — e se não tiver
  certeza, pergunta. **Nunca chute entre `crm-a` e `crm-b`.**
- `--local` → força `AMBIENTE=local` (branch rodando em localhost). Sem a flag, o alvo é `hmlg`.
- `--revisar-plano` → pausa **também** no plano dos obrigatórios na etapa 6, não só nos
  complementares. Sem a flag, os obrigatórios seguem sem aprovação.
- `--sem-complementares` → não proponha complementar nenhum; roda só os obrigatórios dos
  `CA0N` e a esteira não para na etapa 6.

Todo comando daqui em diante leva os dois: `CLIENTE=<id> SISTEMA=<id> npm test`.

**Escrita no ClickUp:** só `clickup_create_comment` (nas duas tarefas) e
`clickup_attach_task_file` (só na de QA) — `CLAUDE.md` → "Proibições não negociáveis". Mover
coluna e criar a tarefa da próxima rodada são ações **minhas**, manuais.

**Perguntas por falta de dado que param a esteira:** cliente ou sistema não identificado,
cliente/sistema divergente entre `qa-analista` e `qa-codigo`, filial não informada, tarefa de
QA não localizada, banco marcado como produção, credencial ausente, repositório não
encontrado, filial `<FILIAL-DE-CONCESSÃO>` inexistente para o usuário, massa passando de 20 registros,
necessidade de criar usuário / empresa / filial / configuração de integração / parâmetro
global (ver a etapa **Preparo do ambiente**), e o 3º ciclo de correção de script na etapa 8.

**A outra parada é o gate da etapa 6** — aprovação dos cenários complementares. Os
obrigatórios (os que vêm dos `CA0N`) nunca esperam aprovação.

---

## Estado da esteira — `tarefas/<TAREFA>/contexto/estado.json`

**Antes da etapa 1**, rode:

```bash
npx tsx scripts/estado.ts mostrar <TAREFA>
```

- **Sem `estado.json`:** crie com `npx tsx scripts/estado.ts iniciar <TAREFA>` e comece da etapa 1.
- **Com `estado.json`:** mostre a `etapaAtual` no chat e **retome dali**. Etapa `concluida` não
  se refaz, a menos que eu peça. O `resumo` de cada etapa concluída é o contexto de retomada:
  abra o arquivo da etapa só quando precisar de detalhe que o resumo não tem.

### Contrato de passagem entre etapas

Todo arquivo de contexto — `01-tarefa.md`, `02-codigo.md`, `03-mapa-seletores.md`,
`03b-inventario-acoes.md`, `04-plano.md`, `04b-preparo-ambiente.md`, `05-execucao.md` — **abre
com `## Resumo`** de no máximo **20 linhas**: decisões, IDs, refs e riscos, sem copiar o
arquivo. Quem lê uma etapa anterior lê primeiro o `estado.json` e esses resumos; abre seção
por cabeçalho quando precisa; lê o arquivo inteiro só quando a etapa exige (o implementador
lendo o mapa inteiro é legítimo).

**No fim de cada etapa**, grave o status e o arquivo. O resumo sai **sozinho** do `## Resumo`
do arquivo — arquivo e `estado.json` ficam iguais:

```bash
npx tsx scripts/estado.ts concluir <TAREFA> 2 --arquivo contexto/02-codigo.md
npx tsx scripts/estado.ts concluir <TAREFA> 3 --resumo "hmlg — mergeada em develop"   # etapa sem arquivo
```

- Os IDs são os títulos deste comando: `1 2 3 3.5 4 5 6 7 8 8.4 8.5 9 10 11`.
- `--arquivo` sem `## Resumo`, ou com resumo acima de 20 linhas, é **erro**: corrija o
  arquivo, não corte. `--resumo` à mão (etapa sem arquivo) é cortado em 20 linhas.
- Etapa que travou: `--bloqueada`, e o motivo vai no resumo. A `etapaAtual` fica nela.
- Quando souber, complete o cabeçalho com `iniciar <TAREFA> --cliente … --sistema … --filial …
  --ambiente … --baseURL … --tarefaQA … --branch … --refSeletor … --comandoDiff …`. Chamar
  `iniciar` de novo nunca apaga etapa concluída.
- O que ficou para depois vai em `pendencia <TAREFA> "…"` e sai com `resolver <TAREFA> <índice>`.

**Os gates gravam a minha resposta** — ver as etapas 6 e 8.4.


---

## Etapas 1 e 2 — em paralelo quando der

As duas são leitura pesada e independentes: rodam como subagentes, **na mesma mensagem**
quando o cliente já é conhecido.

| Situação | O que você faz |
|---|---|
| Com `--cliente` **e** `--sistema` | `qa-analista` e `qa-codigo` na **mesma mensagem** (`Task` tool), os dois com cliente e sistema |
| Sem as flags | `qa-analista` e `qa-codigo` na mesma mensagem, o `qa-codigo` **sem** cliente: ele procura a tarefa nos repositórios de `config/clientes.json` (`git branch -r --list "*<TAREFA>*"` + `git log origin/<base> --grep=<TAREFA>`). Achou em um só → ele segue a análise. Zero ou mais de um → ele devolve `aguardando qa-analista`, e você o chama de novo com o cliente que o analista identificou |

**Quando os dois voltarem:** cliente ou sistema divergentes entre eles → **PARE e me
pergunte**. Repositório compartilhado por vários sistemas (o `qa-codigo` devolve candidatos)
não é divergência: vale o sistema do `qa-analista`, desde que esteja entre os candidatos.

Grave o cabeçalho (`iniciar … --cliente --sistema --tarefaQA --branch --refSeletor
--comandoDiff`) e feche as etapas 1 e 2 com `concluir … --arquivo`.

## Etapa 1 — Contexto da tarefa (ClickUp)

Delegue ao subagente **`qa-analista`**. Ele coleta tudo e identifica o cliente (etapa 1.1
dele), que define URL, credencial e repositório de tudo o que vem depois:

- Tarefa do dev: título, descrição, status atual, custom fields, responsável.
- **Os critérios de aceite (`CA0N`), extraídos só da DESCRIÇÃO** (etapa 1.2 dele), cada um com
  a fonte: `[descrição]` ou `[refinamento técnico]`. É daqui que sai todo cenário obrigatório.
- **Todos** os comentários e **todos** os anexos. Comentário e anexo são contexto, nunca
  critério — `docs/regras/criterios-aceite.md` → "Comentários e anexos".
- Tarefa de QA pareada: `QA0N-` + o título exato da tarefa do dev. **Pode haver mais de uma
  rodada**: use a de **maior número** que ainda não foi concluída — `docs/regras/clickup.md`.
  Você não move nem cria nada: localiza a rodada atual só para saber **onde comentar e
  anexar** na etapa 10.

Recebe de volta o resumo; o arquivo é `tarefas/<TAREFA>/contexto/01-tarefa.md`, com
`## Resumo` e `## Critérios de aceite` (tabela `| ID | Critério | Fonte |`).

**Se a tarefa do dev não estiver em `EM TESTE (QA)`:** avise e pergunte se sigo.
**Se não achar nenhuma tarefa de QA pareada:** pare e me pergunte. Você não cria tarefa
de QA em nenhuma hipótese — nem a `QA01-`, nem a da próxima rodada.

**Se a descrição não trouxer nenhum critério de aceite:** não pare e não puxe de comentário.
Os `CA0N` vêm do diff (etapa 2), marcados `[inferido do diff]` — regra e frase obrigatória do
comentário em `docs/regras/criterios-aceite.md` → "Descrição sem critério de aceite".

---

## Etapa 2 — Contexto de código

Delegue ao subagente **`qa-codigo`**. Ele invoca a skill `analise-branch`, grava
`tarefas/<TAREFA>/contexto/02-codigo.md` e devolve **só**: mergeada sim/não, comando de diff,
ref de seletor, arquivos alterados, endpoints, `data-testid` achados, riscos e CA inferidos.

A resposta "mergeada?" decide o diff, a ref de seletor e o ambiente da etapa 3 —
`docs/regras/repos-clientes.md` → "Qual diff usar". **Diff vazio nunca é "a tarefa não mudou
nada": é o comando errado.** Se o `qa-codigo` devolver diff vazio, devolva a ele.

**Se a etapa 1 fechou sem `CA0N`:** copie os `CA0N` `[inferido do diff]` que o `qa-codigo`
devolveu para a seção `## Critérios de aceite` do `01-tarefa.md`. Critério inferido vale como
obrigatório. Com `CA0N` da descrição, os inferidos **não** entram no `01`.

CA × diff divergentes: teste contra o CA e registre a divergência como achado —
`docs/regras/criterios-aceite.md` → "Quando o critério de aceite briga com o código".

---

## Etapa 3 — Decidir o ambiente

Padrão: **`hmlg`**. Na prática a Etapa 2 já respondeu: mergeada na `branchBase` → está em hmlg.

Passe para `local` apenas se: houver `--local`, **ou** a feature não estiver presente em hmlg
(branch não mergeada / rota retorna 404), **ou** o cenário exigir manipulação que hmlg não
permite (seed de dado, mock de erro, feature flag).

Se cair em `local`, registre no `tarefas/<TAREFA>/contexto/` e **avise no comentário do ClickUp que a
evidência não é oficial de homologação**. Um teste validado só em localhost não aprova tarefa.

**Caso a gritar, não a resolver sozinho:** a tarefa está em `EM TESTE (QA)` — ou seja, o devops
disse que subiu — mas o commit não aparece na `branchBase`. Não trate como rotina caindo para
`local` em silêncio: registre como achado no comentário do ClickUp (deploy que não saiu, branch
errada, ou merge que ficou para trás) e siga testando em `local` com a evidência marcada como
não-oficial.

---

## Etapa 3.5 — Preparo do ambiente (acessos e massa)

Roda **antes da exploração**: nada de abrir o navegador para mapear antes daqui.

> Cite esta etapa pelo **nome** ("Preparo do ambiente"), nunca pelo número: a ordem de trabalho
> do `CLAUDE.md` e as etapas deste comando são duas numerações diferentes, e cada mudança
> desloca as duas. O que manda é a posição.

Pule esta etapa inteira se o `01-tarefa.md` fechou com `## Acessos necessários` = "nenhum" **e**
`## Dados de produção citados` = "nenhum" — e nada travou depois, na exploração ou na execução.
Se travar mais adiante, **volte para cá**: o destrave é sempre desta etapa, e sempre registrado.

**Leia `docs/regras/preparo-ambiente.md` agora** — destravável × `BLOQUEADO` legítimo, raio de
alcance, "isto é pré-condição ou é o comportamento sob teste?", orçamento de 3 tentativas,
massa que substitui dado de produção e as quatro travas. Nada disso se resolve de memória.

### Eco antes da primeira escrita

Antes de conceder ou criar **qualquer coisa**, imprima e confira contra o `01-tarefa.md`:

```
CLIENTE=<c>  SISTEMA=<s>  FILIAL=<f>  baseURL=<url>
```

Divergiu de qualquer um dos quatro, **pare**. Escrever no ambiente do cliente errado é pior do
que não testar.

### Conceder os acessos

Para cada linha de `## Acessos necessários`, conceda ao usuário de teste na tela de
acessos do sistema (TODO(empresa): caminho do menu), **sempre na filial `<FILIAL-DE-CONCESSÃO>`** —
sem exceção. Sistema sem filial: ignore a parte de filial. A execução dos cenários continua na filial que eu informei. São duas sessões,
logo **dois `storageState`**:

```bash
CLIENTE=<c> SISTEMA=<s> FILIAL="<FILIAL-DE-CONCESSÃO>" npm run auth              # sessão da concessão
CLIENTE=<c> SISTEMA=<s> FILIAL="<a que eu informei>" npm run auth     # sessão do teste
```

**Trocar de filial exige rodar `npm run auth` de novo** — sem isso a sessão anterior é
reaproveitada em silêncio e a rodada mede a filial errada. Se `<FILIAL-DE-CONCESSÃO>` não existir para
aquele usuário, o erro do login lista as disponíveis: **pare e pergunte.**

Apoio: se a empresa tiver um script de concessão em `scripts/` (TODO(empresa)), use-o com
`--dry-run` primeiro. Sem script, conceda pela tela e tire o print.

O acesso concedido **não é revertido**. O print da tela de acessos com o direito concedido entra
como `precondicao` da ficha da `Evidencia`, nunca como CT.

### Gerar a massa e registrar

Massa nova e aleatória que satisfaça a **mesma condição** do dado de produção citado, prefixo
`QA-<TAREFA>-<runId curto>`, dentro das **quatro travas** — `docs/regras/preparo-ambiente.md`
→ "Massa quando a tarefa fala de dado de produção" e `CLAUDE.md` → "As quatro travas". Skill
de apoio: `test-data-management`, subordinada a essa regra.

`tarefas/<TAREFA>/contexto/04b-preparo-ambiente.md` abre com `## Resumo` e recebe **tudo**: o
que foi concedido (usuário, acesso, filial, data/hora, print), o que foi criado (o quê, onde,
com quais valores, como identificar depois) e, **na ordem em que aconteceram, as tentativas de
destrave** — o obstáculo, o raio, a resposta escrita a "isto é pré-condição ou é o
comportamento sob teste?", o que foi tentado (até 3 vezes) e o resultado. Sem isso não existe
`BLOQUEADO` defensável, e o `qa-revisor` cobra.

Depois **acrescente uma linha ao fim** de `docs/massa-em-hmlg.md` (append-only):

```
| <data> | <TAREFA> | <cliente>/<sistema> | <filial> | <o que foi criado/concedido> | <prefixo p/ identificar> |
```

O que foi concedido e criado sai também no comentário da etapa 10 — o time precisa saber que
aquele hmlg mudou.

---
## Etapa 4 — Explorar o fluxo no navegador

Delegue ao subagente **`qa-explorador`**.

Ele abre o ambiente escolhido, autentica, percorre o fluxo da tarefa e produz **dois
entregáveis obrigatórios**, os dois abrindo com `## Resumo`:

| Arquivo | O que é |
|---|---|
| `tarefas/<TAREFA>/contexto/03-mapa-seletores.md` | o mapa de seletores reais, cruzando o que viu na tela com o que a etapa 2 achou no código |
| `tarefas/<TAREFA>/contexto/03b-inventario-acoes.md` | o **inventário de ações**: uma linha por botão, ícone de grid, item de menu, aba, toggle, atalho e endpoint que o diff tocou, com o que dispara, o efeito observado, o efeito colateral e o estado que exige |

O inventário cobre **tudo** que o diff tocou, não só o caminho feliz, e é ele que alimenta os
cenários complementares da etapa 5. Efeito não observado se escreve `não observado`, nunca
"nenhum". Ação destrutiva entra no inventário sempre, mas só é executada se der para desfazer
ou se a massa for descartável.

> Nada de escrever spec com seletor vindo de print da tarefa. Os dois entregáveis são
> obrigatórios — inclusive em tarefa só de API, onde o inventário se preenche com endpoints
> no lugar de seletores.

---

## Etapa 5 — Plano de teste

Consolide etapas 1, 2 e 4 num plano em `tarefas/<TAREFA>/contexto/04-plano.md`, seguindo o
template da skill **`playwright-padrao`** (`references/template-tarefa.md`). O plano abre com
`## Resumo` e, logo depois, a matriz CA → CT. Para montá-lo, os resumos bastam na maior parte;
abra `## Critérios de aceite` do `01` e o `03b` inteiro (é dele que saem os complementares).

### Cenários obrigatórios — projeção dos critérios de aceite

- **Todo `CA0N` vira pelo menos um cenário obrigatório.** Nenhum critério fica sem CT: essa é
  a cobertura que a tarefa comprou.
- **Nenhum cenário obrigatório nasce fora dos `CA0N`.** Não é o agente que decide o que a
  entrega precisava fazer.
- **A matriz CA → CT abre o plano**, antes de qualquer cenário:

  | CA | Critério (resumo) | Fonte | CT(s) |
  |---|---|---|---|
  | CA01 | ... | `[descrição]` | CT01, CT02 |
  | CA02 | ... | `[refinamento técnico]` | CT03 |

  `CA` sem `CT` é bloqueio: volte e escreva o cenário. `CT` obrigatório sem `CA` é erro de
  classificação: ou ele aponta para um critério, ou é complementar.

### Cenários complementares — opcionais, com justificativa e teto

Com `--sem-complementares`, pule esta parte inteira.

Saem do **inventário de ações** cruzado com o catálogo exploratório e do risco que o diff
mostrou, numerados `CX01`, `CX02`… — teto de 6, data-driven para variações do mesmo elemento,
só o que o diff tocou: `docs/regras/criterios-aceite.md` → "Catálogo exploratório".

Cada `CX` carrega no plano: **uma linha de justificativa** (risco real observado, não palpite),
**estimativa de tempo** em minutos, e o **custo em massa** — `CX` que grava registro consome o
teto de 20 do Preparo do ambiente. Sem justificativa, o complementar não entra no plano.
Complementar **nunca** conta para o veredito por decisão sua: se falhar e reproduzir
manualmente, vai para o **gate do achado** (etapa 8.4).

### Todo cenário, obrigatório ou complementar

Precisa de: pré-condição, passos, resultado esperado, seletores (do mapa), endpoint
interceptado quando houver chamada, e o campo `criterios` que vai para o `resultado.json`
(`['CA01']` nos obrigatórios; vazio nos complementares).

---

## Etapa 6 — Gate de aprovação dos complementares

O plano fica registrado em `tarefas/<TAREFA>/contexto/04-plano.md` sempre — é a rastreabilidade da
rodada.

**Os obrigatórios não passam por gate.** Eles vêm dos `CA0N`; a tarefa já os comprou.

**Os complementares passam.** Se você propôs pelo menos um, **pare aqui** e mostre no chat,
exatamente neste formato:

```
Obrigatórios (dos CAs): N cenários — seguem sem aprovação.

Complementares propostos (precisam do seu OK):
  CX01 — <cenário> — por que importa: <1 linha> — estimativa: <X min>
  CX02 — <cenário> — por que importa: <1 linha> — estimativa: <X min>

Total estimado se aprovar tudo: <X min>
Responda: "todos", "nenhum", ou os IDs que aprova.
```

Depois da resposta:

- `todos` → todos os complementares viram spec.
- `nenhum` → nenhum vira spec; só os obrigatórios.
- IDs (`CX01, CX03`) → só os citados viram spec.

**Complementar que eu não aprovei não é escrito como spec.** Ele fica no plano marcado
`não aprovado nesta rodada` — o registro serve para eu reconsiderar depois, não para o agente
rodar assim mesmo.

Grave a resposta no estado **antes** de seguir para a etapa 7:

```bash
npx tsx scripts/estado.ts gate <TAREFA> complementares --resposta "<minha resposta literal>" --propostos CX01,CX02
npx tsx scripts/estado.ts gate <TAREFA> complementares --nao-aplica   # nenhum proposto ou --sem-complementares
```

Numa retomada, os complementares que viram spec são os de `gates.complementares.aprovados`.
Não pergunte de novo.

Quando parar e quando seguir:

| Situação | Comportamento |
|---|---|
| Nenhum complementar proposto | segue direto para a etapa 7 |
| `--sem-complementares` | nem propõe; segue direto |
| Um ou mais complementares propostos | **para** e espera a resposta |
| `--revisar-plano` | para **também** no plano dos obrigatórios, mostrando cenários, ambiente e riscos antes de implementar |

---

## Etapa 7 — Implementar

Delegue ao subagente **`qa-implementador`**. Passe a ele **os obrigatórios + só os
complementares aprovados na etapa 6**. Ele cria/atualiza:

- `tarefas/<TAREFA>/pages/<modulo>.page.ts` — estendendo `BasePage` ou a base do produto, locators como
  propriedades. Se outra tarefa já usa o Page Object, ele mora em `pages/<sistema>/`.
- `tarefas/<TAREFA>/specs/<modulo>.spec.ts` — usando o `Evidencia` de `support/evidencias.ts`.
- `tarefas/<TAREFA>/fixtures/<massa>.json` — se for data-driven.

Ele roda `npm run typecheck` e `npm run list` e corrige até os dois passarem.

---

## Etapa 8 — Executar e classificar

Delegue ao subagente **`qa-executor`**. Ele roda `typecheck`, `list` e a **rodada oficial**
(sem `ACOMPANHAR`), lê o resultado só pelo relatório JSON e pelo `error-context.md` de quem
falhou, aplica a triagem e os quatro diagnósticos de "não reproduziu", reproduz manualmente
antes de classificar `bug`, grava `tarefas/<TAREFA>/contexto/05-execucao.md` e devolve:

```
| CT | tipo | CA | resultado | classificação (bug / script / ambiente / inconclusivo) | print |
```

Ele **não** decide veredito e **não** dispara o gate do achado — isso é seu, porque precisa
de mim. Feche a etapa com `concluir <TAREFA> 8 --arquivo contexto/05-execucao.md`.

**Falha de script — no máximo 2 ciclos de correção:**

1. O `qa-executor` classifica `script` → passe a linha "para o qa-implementador corrigir" ao
   **`qa-implementador`** → chame o `qa-executor` de novo, dizendo o ciclo.
2. Segundo ciclo, igual.
3. Se no **3º** ainda houver falha de script, **pare e me pergunte** — mostre o que foi
   tentado nos dois ciclos. Falha de script nunca vira `REPROVADO`.

**Falha de ambiente** (massa, acesso, sessão) → volte ao Preparo do ambiente, destrave,
registre no `04b` e reexecute.

**Rodada visível (`ACOMPANHAR`)** é opcional e só quando eu pedir:
`CLIENTE=<c> SISTEMA=<s> npm run acompanhar -- tarefas/<TAREFA>/specs`. Ela nunca gera a
evidência oficial — o slowMo muda o timing e o cursor falso entra nos prints.

Quantos prints por cenário e por `tipo`: `docs/regras/evidencias.md` — é por ela que o
`qa-revisor` decide se um `CX` é falso verde.

---

## Etapa 8.4 — Gate do achado (só se um complementar falhou)

Se **nenhum** complementar falhou, pule para a 8.5.

Se um `CX` falhou, a classificação é a do `qa-executor`. Falha de script **não chega ao gate**:
volta ao ciclo de correção da etapa 8. Falha `inconclusivo` também não chega: o comentário
diz isso. Só `bug` — reprodução manual confirmada — chega aqui.

Se a falha reproduz manualmente pelo navegador, **pare aqui** e pergunte, exatamente assim:

```
Complementar CX0N falhou — reprodução manual: confirmada.
  Esperado / Obtido / Impacto
  Não cobre CA. Os N obrigatórios passaram.
Reprovo a tarefa por este achado?  "reprova" | "achado"
```

| Resposta | Veredito |
|---|---|
| `achado` | `APROVADO` — o achado vai **em destaque** no comentário das duas tarefas |
| `reprova` | `REPROVADO`, com a frase obrigatória: "Reprovação decidida pelo QA humano sobre cenário complementar `CX0N` — nenhum critério de aceite falhou" |

**Sem `reprova` explícito, o padrão é `APROVADO`.**

Grave a resposta no estado:

```bash
npx tsx scripts/estado.ts gate <TAREFA> achado --resposta <reprova|achado> --cenario CX0N
npx tsx scripts/estado.ts gate <TAREFA> achado --nao-aplica    # nenhum complementar falhou
```

---

## Etapa 8.5 — Revisão adversarial (obrigatória antes de publicar)

Delegue ao subagente **`qa-revisor`**. Ele tenta derrubar a sua conclusão: caça falso verde
(teste que passou sem testar nada) e falso vermelho (falha de script reportada como bug).

Se o veredito for `não-confiável`, **não publique**. Corrija o que ele apontou e rode a
revisão de novo. Se for `confiável-com-ressalvas`, inclua as ressalvas no comentário do ClickUp.

---

## Etapa 9 — Rascunho do veredito (você decide)

Grave `tarefas/<TAREFA>/contexto/rascunho-veredito.md`. É a **única** fonte do `qa-publicador`:
o que não estiver aqui não sai no PDF nem no comentário. Seções, nesta ordem:

```
## Veredito
Veredito sugerido: <APROVADO|REPROVADO|BLOQUEADO|LIBERADA SEM TESTE> — <justificativa em 1 linha>

## Ação do humano
<movimentação de coluna que o veredito pede; se REPROVADO: título QA0<N+1>-, lista, CTs a reconferir>

## Achados
- <CT0N — o que falhou, passos, esperado vs obtido, reproduzido manualmente: sim/não>  (ou "nenhum")

## Observações de testabilidade
## Preparo do ambiente
## Ressalvas do revisor
## CA inferidos do diff (em destaque)
```

A linha `Veredito sugerido:` é obrigatória e exata: o `verificar-esteira.ts` lê o veredito por ela.

### Qual veredito declarar

O agente **não move coluna e não cria tarefa**. Ele declara o veredito no texto; a
movimentação no quadro é manual, feita pelo QA.

**A tabela de veredito está no `CLAUDE.md`** → "🏁 Veredito — texto no comentário, nunca
coluna". Ela já está em contexto: use aquela, não uma de memória. Ela é a única que tem as
duas linhas do gate do achado (`achado` → `APROVADO`, `reprova` → `REPROVADO`).

Os vereditos são **exatamente quatro**: `APROVADO` · `REPROVADO` · `BLOQUEADO` ·
`LIBERADA SEM TESTE`. **"APROVADO com ressalva" não existe** — não escreva o sufixo. E
`BLOQUEADO` só depois de tentar destravar (ver a etapa Preparo do ambiente): sem tentativa
registrada, não declare.

**Quando o veredito for `REPROVADO`**, o comentário precisa entregar tudo o que o QA
precisa para abrir a próxima rodada na mão, sem reabrir a evidência:

- Título sugerido da próxima rodada: `QA0<N+1>-` + o mesmo título da tarefa do dev
- Lista onde criar: a mesma da rodada atual (diga o nome)
- CTs que falharam, com passos de reprodução e esperado vs obtido
- Link da tarefa da rodada atual e link da evidência anexada

A rodada reprovada **fica** em `REPROVADO` — ela é o histórico. O reteste acontece na tarefa
nova, criada pelo humano.

---

## Etapa 10 — Gerar evidência e publicar (subagente)

Delegue ao subagente **`qa-publicador`** (modelo `haiku`). Passe: `<TAREFA>`, ID da tarefa do
dev, ID da tarefa de QA da rodada atual (`QA0N-`) e o nível do PDF (`resumida`, padrão, ou
`tecnica`).

Ele gera o PDF pelo `gerar-evidencia.py`, anexa PDF + `resultado.json` na tarefa de QA e comenta
nas duas tarefas — sem perguntar. Ele **não** decide nem muda o veredito: só publica o rascunho.

Confira o retorno dele:

- Algum item `falhou` → corrija a causa e chame de novo **só** para o que falhou (não comente
  duas vezes na mesma tarefa).
- `faltou: rascunho-veredito.md` → volte à etapa 9.
- `Veredito publicado` diferente do rascunho → pare e me avise.

---

## Etapa 11 — Autoverificação

Antes de dizer que terminou, **rode o script primeiro**:

```bash
npx tsx scripts/verificar-esteira.ts <TAREFA>
```

Ele devolve uma linha por item: `OK`, `FALHA`, `AVISO` ou `MANUAL`. **Corrija toda FALHA** e
rode de novo. Se uma FALHA não tiver correção (ex.: cenário `bloqueado` sem print), explique no
comentário do ClickUp. `AVISO` não reprova, mas diga no chat o que ficou (arquivo de contexto
acima de 25 KB, ou `## Resumo` ausente em tarefa antiga). Depois confira **à mão só os itens
`MANUAL`**. Na lista abaixo, `(script)` é o que o script prova e `(manual)` é o que ele não
enxerga. O script também confere o `alvo.json`, o `evidenciaOficial`, os cenários que sobraram
de outra execução e o `## Resumo` de cada arquivo de contexto.

- [ ] (manual) Cliente **e sistema** identificados com fonte explícita (não assumidos pelo padrão)
- [ ] (script) Todo `CA0N` da descrição tem pelo menos um CT obrigatório, e a matriz CA → CT abre o
      `04-plano.md`
- [ ] (manual) Nenhum cenário obrigatório nasceu fora dos `CA0N` (o resto é complementar)
- [ ] (manual) `CA0N` `[inferido do diff]`, se houver, saiu **em destaque** no comentário do ClickUp
- [ ] (script: existe e sem "nenhum" · manual: cobre o diff) `03b-inventario-acoes.md` existe,
      cobre o que o diff tocou, e efeito não visto está como `não observado` (não como "nenhum")
- [ ] (script) Todo arquivo de contexto abre com `## Resumo` de até 20 linhas
- [ ] (manual) Todo acesso de `## Acessos necessários` foi concedido **antes** da exploração, na filial
      `<FILIAL-DE-CONCESSÃO>`, com `npm run auth` próprio — e a sessão do teste foi regerada na filial que eu
      informei
- [ ] (manual) Nenhum dado de produção citado na tarefa foi usado como massa; a massa é nova, aleatória e
      prefixada `QA-<TAREFA>-…`
- [ ] (manual) Massa dentro das quatro travas: ≤ 20 registros · nada de usuário/empresa/filial/config/
      parâmetro global · dado pessoal só sintético óbvio · eco conferido antes da 1ª escrita
- [ ] (script) `04b-preparo-ambiente.md` existe (ou o preparo foi "nenhum") e `docs/massa-em-hmlg.md`
      ganhou **uma linha nova ao fim**, sem nenhuma linha antiga alterada — o script só prova o
      que ainda não foi comitado
- [ ] (manual) Se o veredito é `BLOQUEADO`: as tentativas de destrave estão em `04b-preparo-ambiente.md` e
      o comentário diz o que foi tentado e por que não destravou
- [ ] (manual) Nada que foi configurado à mão no preparo era justamente o que um `CA0N` pedia que o
      sistema fizesse sozinho (isso seria falso verde)
- [ ] (manual) Nenhuma configuração de raio **global ou compartilhado** foi mexida sem eu ter autorizado
- [ ] (script, se o rascunho estiver salvo em `contexto/rascunho-veredito.md` · senão manual) O veredito é um dos quatro (`APROVADO` · `REPROVADO` · `BLOQUEADO` ·
      `LIBERADA SEM TESTE`), sem o sufixo "com ressalva"
- [ ] (manual) Os complementares implementados são exatamente os que eu aprovei na etapa 6
- [ ] (manual) A URL testada é a do ambiente daquele par cliente+sistema em `config/clientes.json`
- [ ] (manual) O PDF de evidência foi gerado pelo `gerar-evidencia.py`, via `qa-publicador` (não montado à mão)
- [ ] (manual) Todos os comentários e anexos da tarefa foram lidos (não só a descrição)
- [ ] (script: não vazio, com comando e ref · manual: comando bate com a branch) O diff da branch foi analisado e o resumo está em `02-codigo.md` — **não veio vazio**, e
      o comando usado bate com o estado da branch (mergeada → merge commit; aberta → three-dot)
- [ ] (manual) Todo seletor usado existe no mapa e foi confirmado na tela **e** na ref que está no ar no
      ambiente alvo (`origin/<branchBase>` em hmlg)
- [ ] (script) Zero `waitForTimeout` no código gerado, e zero `test`/`expect` importados de
      `@playwright/test` nos specs
- [ ] (manual) Suíte rodou até o fim em `hmlg` (ou o motivo de não ter rodado está documentado)
- [ ] (script) Existe evidência de **cada** cenário do plano
- [ ] (manual) Nenhum print contém senha, token ou dado real de cliente
- [ ] (manual) Comentário publicado nas **duas** tarefas · evidência anexada na tarefa de QA ·
      **nenhuma coluna alterada e nenhuma tarefa criada**
- [ ] (manual) `npm run typecheck` passa

Feche a etapa com `npx tsx scripts/estado.ts concluir <TAREFA> 11 --resumo "<o que ficou FALHA justificada ou MANUAL pendente>"`.

Ao final, me entregue: cenários executados, resultado, achados, o veredito sugerido, e o
link da tarefa de QA.
