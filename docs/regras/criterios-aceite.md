> Regra do projeto — parte de `CLAUDE.md`. Mesma força do arquivo principal.

## 🎯 Critérios de aceite — a origem dos cenários

> **O que testar vem dos CRITÉRIOS DE ACEITE DA DESCRIÇÃO. Como testar vem do CÓDIGO.**

A Regra de Ouro acima diz de onde vem o *contexto técnico* e de onde vem a *evidência*. Esta
seção diz de onde vem o **escopo**: quais cenários existem e quais decidem o veredito.

### A regra

1. **Todo critério de aceite da descrição do card vira pelo menos um CT obrigatório.** Nenhum CA
   fica sem cenário — essa é a cobertura que a tarefa comprou.
2. **Nenhum cenário obrigatório nasce fora dos critérios de aceite.** A lista de obrigatórios é
   exatamente a projeção dos CAs. Não é o agente que decide o que a entrega precisava fazer.
3. **Cenário complementar existe, mas é opcional e por julgamento.** O agente só cria quando
   enxergar risco real no diff ou na tela, e precisa justificar em **uma linha** por que aquilo
   importa. Sem justificativa, não entra no plano.

### Onde achar os critérios de aceite — **só a descrição do card**

**A descrição da tarefa do dev é a única fonte de critério de aceite.** Comentário e anexo não
criam, não alteram e não removem critério. Dentro da descrição valem:

1. Seção nomeada: "Critérios de aceite", "Aceite", "DoD", "Cenários", checklist.
2. Frases verificáveis fora de seção nomeada — "ao salvar sem CNPJ deve exibir erro" é um
   critério de aceite escrito em prosa. Converta.
3. **Critérios de um bloco de refinamento técnico**, quando o bloco estiver na própria descrição.
   Entram como critério normal — são os critérios do dev para a mesma necessidade do card.

Numere como `CA01`, `CA02`… no `01-tarefa.md`, com a **fonte** de cada um: `[descrição]` ou
`[refinamento técnico]`.

#### Card × refinamento técnico — o card manda

O refinamento é leitura técnica da mesma necessidade, não uma segunda especificação. Quando os
dois divergirem, **vale o critério original do card**:

- Teste contra o critério do card.
- Registre a divergência no plano e no comentário: "CA02 (card) pede X; o refinamento técnico
  descreve Y — testei contra o card".
- O critério do refinamento que **complementa** sem contradizer entra normalmente como CA.

### Comentários e anexos — contexto, nunca critério

Continuam sendo leitura **obrigatória** na etapa 1, e continuam decidindo *como* testar. O que
mudou é que eles não mexem na lista de CAs:

| Fonte | Serve para | Não serve para |
|---|---|---|
| Comentários | pré-condição operacional, feature flag, perfil, histórico de reprovas, massa de dados, risco | criar, alterar ou remover `CA0N` |
| Anexos | texto literal de mensagem e label para asserção, layout real da tela, payload de fixture | criar, alterar ou remover `CA0N` |

**Se um comentário contradisser um critério da descrição** — inclusive dizendo que algo saiu do
escopo — o critério da descrição continua valendo e o cenário continua rodando. A contradição
vira **achado em destaque** no comentário do ClickUp:

> ⚠️ CA03 pode estar fora de escopo: o comentário de @autor (data) diz que o campo foi removido
> desta entrega, mas a descrição do card ainda pede. Testei contra a descrição, conforme a regra
> do projeto. Se o escopo mudou mesmo, a descrição precisa ser atualizada.

Nunca resolva a contradição sozinho apagando o CA — o efeito colateral aceito dessa regra é que
o card desatualizado reprova; o que não se aceita é o agente decidir escopo em silêncio.

### Descrição sem critério de aceite

Acontece, e **não é motivo para parar a esteira**. Vale quando a **descrição** não traz critério
— mesmo que exista regra em comentário ou anexo, porque comentário e anexo não são fonte de CA:

- Derive os CAs do `git diff` — o comportamento observável que a branch mudou **é** o critério
  implícito.
- Marque cada um como `[inferido do diff]` no `01-tarefa.md` e no plano.
- **Liste os inferidos em destaque no comentário do ClickUp**, com esta frase:
  > Testei contra estes critérios inferidos do código porque a **descrição** do card não trazia
  > critério de aceite. Se a intenção era outra, o veredito muda.

Critério inferido vale como obrigatório para o veredito — mas o time precisa saber que quem o
escreveu foi o agente, não o PO.

### Quando o critério de aceite briga com o código

O CA diz **o que a entrega promete**; o diff diz **o que a entrega faz**. Divergência entre os
dois não se resolve escolhendo um lado em silêncio — **é um achado de QA**:

- Teste contra o **critério de aceite** — é o que o PO vai validar na coluna seguinte.
- Registre a divergência no plano e no comentário: "CA02 pede X; o diff implementa Y".
- Código faz **menos** que o CA → tende a `REPROVADO`.
- Código faz **mais** que o CA → não reprova; é achado de escopo, e o extra pode virar cenário
  complementar.

O código continua sendo a fonte da verdade de **seletor, rota, endpoint, payload e texto literal
de mensagem**. Isso não mudou.

### Efeito no veredito

| Tipo de cenário | Origem | Conta para o veredito? |
|---|---|---|
| **Obrigatório** | um critério de aceite **da descrição do card** (refinamento técnico incluído), ou inferido do diff quando a descrição não traz nenhum | **Sim** — é ele que aprova ou reprova |
| **Complementar** | julgamento do agente sobre risco, guiado pelo catálogo exploratório | **Não pelo agente** — falha vira `Achado`. Só eu, no gate do achado, posso transformar em `REPROVADO` |

Cenário complementar que falha com bug reproduzido manualmente **não reprova a tarefa por
decisão do agente**. Ele entra no comentário das duas tarefas como achado, com passos de
reprodução. Reprovar o dev por um cenário que ninguém pediu é o mesmo tipo de erro que reprovar
por seletor errado — quando isso acontece, é porque **eu** decidi, não o agente.

### Gate do achado — quem decide sou eu

Quando um complementar falha **e a falha reproduz manualmente**, o agente **para** e me
pergunta, antes de publicar qualquer coisa:

```
Complementar CX0N falhou — reprodução manual: confirmada.
  Esperado / Obtido / Impacto
  Não cobre CA. Os N obrigatórios passaram.
Reprovo a tarefa por este achado?  "reprova" | "achado"
```

| Minha resposta | Veredito |
|---|---|
| `achado` (ou o gate nem disparou) | `APROVADO` — o achado vai **em destaque** no comentário das duas tarefas, e eu decido se vira tarefa |
| `reprova` | `REPROVADO`, com a frase obrigatória no comentário: "Reprovação decidida pelo QA humano sobre cenário complementar `CX0N` — nenhum critério de aceite falhou" |

**Sem a minha resposta explícita `reprova`, o padrão continua sendo `APROVADO`.** O gate me dá
a opção; ele não transfere a decisão para o agente. Falha de script nunca chega ao gate: se o
seletor estava errado ou o dado faltava, corrige e reexecuta. Falha sem reprodução manual também
não chega: vira `inconclusivo`, e o comentário diz isso.

O veredito é sempre `APROVADO`, `REPROVADO`, `BLOQUEADO` ou `LIBERADA SEM TESTE` — **sem
sufixo**. "APROVADO com ressalva" **não existe**.

### Catálogo exploratório — de onde saem os complementares

Os complementares não nascem de palpite: saem do **inventário de ações** cruzado com
`.claude/skills/playwright-padrao/references/catalogo-exploratorio.md`, que lista variações
conhecidas por tipo de elemento (CNPJ com dígito inválido, duplo clique no botão que grava,
limite do `nvarchar`, grid com zero resultado, endpoint com payload incompleto).

O catálogo é **tabela de consulta, não checklist de cobertura**. Três travas:

- no máximo **6 `CX` por rodada**, ordenados por risco;
- variações do **mesmo elemento** viram **um** `CX` data-driven — seis CNPJs inválidos são um
  cenário, não seis;
- só entra o que o **diff tocou**, com uma linha de justificativa de risco real.

`CX` que grava registro consome o teto de 20 registros do Preparo do ambiente.

---

