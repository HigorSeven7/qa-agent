# Contexto de QA — qa-agent

> Arquivo lido pelas skills vendorizadas de `petrkindlmann/qa-skills` em `.claude/skills/`.
> Todas elas começam com "check `.codex/.agents/qa-project-context.md`" — é este arquivo.
>
> **Hierarquia:** `CLAUDE.md` manda. Este arquivo é o resumo estruturado que as skills
> externas sabem consumir; se divergirem, vale o `CLAUDE.md`.
>
> TODO(empresa): revise as seções "Produto", "Stack técnico" e "Áreas de risco" com a realidade
> da empresa. O resto é a esteira, igual em qualquer empresa.

---

## Produto

Não é um produto único. É uma **esteira de QA guiada por tarefa do ClickUp** que testa os
sistemas da empresa (e, se for o caso, dos clientes dela). O agente recebe o link de uma tarefa,
entende o que foi implementado lendo o código da branch, testa em homologação e devolve evidência
anexada na tarefa de QA.

O alvo de um teste é sempre um par **cliente + sistema**, nunca só o cliente.

**Fluxos de usuário críticos** — TODO(empresa): liste os da empresa. Transversais a qualquer uma:

1. Login (com ou sem segundo passo de filial) — a sessão fica presa à filial, quando houver.
2. Autenticação por `storageState`, um por `cliente-sistema-perfil[-filial]`.
3. Geração e anexo da evidência de QA no ClickUp (PDF + `resultado.json` + zip de imagens).

## Stack técnico

| Camada | O que é |
|---|---|
| Sistemas sob teste | TODO(empresa): linguagem, framework e design system de cada produto. |
| Repositórios | Clonados fora do projeto, apontados por `config/clientes.json` (`repos.front` / `repos.back`) e autorizados em `.claude/settings.json` → `permissions.additionalDirectories`. **Read-only.** |
| Leitura do código da tarefa | **Sempre por ref explícita, nunca do disco e nunca `HEAD`.** O agente não faz checkout, então disco e `HEAD` são a branch ativa na máquina. Diff: `git -C "$REPO" diff "origin/$BASE...$BRANCH"`. Conteúdo de arquivo: `git -C "$REPO" show "$BRANCH:<caminho>"`. Arquivo inteiro vai para `tarefas/<TAREFA>/contexto/fontes/`. Ler do disco falha em silêncio e produz seletor da base num teste da feature. |
| Banco | Hosts por sistema em `config/clientes.json`. Sistema com `db.producao: true` é **bloqueado** por `validarSelecao()`. |
| Gestão de tarefa | **ClickUp**, via MCP. Dois quadros: o dos devs e o de QA. |

## Stack de teste

| Item | Valor |
|---|---|
| Framework E2E | **Playwright** `^1.55` + **TypeScript** `^5.7` |
| Runner | `@playwright/test`, config única em `playwright.config.ts` |
| Browser | Chromium apenas, viewport `1600×900` |
| Diretório de teste | `tarefas/<TAREFA>/specs/<modulo>.spec.ts` · API em `tarefas/<TAREFA>/specs/<modulo>.api.spec.ts` |
| Page Objects | `pages/<modulo>.page.ts`, estendendo `BasePage` |
| Massa | `tarefas/<TAREFA>/fixtures/<massa>.json` |
| Suporte | `support/` — `clientes.ts`, `env.ts`, `auth.setup.ts`, `evidencias.ts`, `teste.ts`, `acompanhar.ts` |
| Import obrigatório | `test` / `expect` **sempre** de `support/teste` — nunca de `@playwright/test` |
| Unit / componente | **Não existe.** O projeto é só E2E e API; unit é responsabilidade dos repos dos clientes. |
| Mutation testing | Não instalado. |

## CI/CD

**Não há pipeline.** A execução é **local, sob demanda**, disparada pelo QA a partir do link
da tarefa. Consequências para qualquer skill que assuma CI:

- Não existe gate de deploy, sharding, quarentena automatizada nem histórico de execução em CI.
- O que "preserva evidência" é o comando `/evidencia` (PDF de evidência anexado na tarefa `QA0N-`),
  não artefato de pipeline.
- `retries: 1` em hmlg, `0` em local. **Teste que só passa no retry é suspeito** — investigar,
  não comemorar.
- `workers: 1` em hmlg (dados compartilhados, sem isolamento de massa). `fullyParallel` só em local.

## Ambientes

| Ambiente | Variável | Papel |
|---|---|---|
| **Homologação** | `AMBIENTE=hmlg` (default, `npm test`) | **Único ambiente de evidência oficial.** É o que o PO/cliente valida depois. |
| **Localhost** | `AMBIENTE=local` (`npm run test:local`) | Ferramenta de apoio: feature ainda não subiu, forçar edge case, debugar falha, validar contrato de API antes da UI. Nunca é evidência. |
| **Produção** | — | Fora de escopo. Sistema com `db.producao: true` é bloqueado. |

**Divergência que importa:** o build de hmlg pode estar **defasado** em relação à branch da
tarefa. Seletor que existe no código e não em hmlg é o caso clássico — e um achado de QA
legítimo, não algo a esconder. Sistemas com **VPN** (`requerVpn: true`
no catálogo): falha de conexão neles quase sempre é VPN desligada, não bug.

**Regra de ouro:** contexto vem do **código** (branch + `git diff`); evidência vem de **homologação**.

## Origem dos cenários — o que decide o veredito

**O que testar vem dos critérios de aceite da descrição do card. Como testar vem do código.**

| Tipo de cenário | Vem de | Conta para o veredito? |
|---|---|---|
| **Obrigatório** | um critério de aceite (`CA0N`) da **descrição** da tarefa do ClickUp, incluindo o bloco de refinamento técnico; inferido do `git diff` e marcado como tal quando a descrição não trouxe nenhum | **Sim** |
| **Complementar** | julgamento do agente sobre risco, com justificativa de 1 linha | **Não** — falha vira achado no comentário |

- **Fonte de critério: só a descrição do card.** Comentário e anexo são contexto (pré-condição,
  texto literal, perfil, massa, risco) e **nunca** criam, alteram ou removem `CA0N` — nem quando
  dizem que algo saiu do escopo. A contradição vira achado em destaque no comentário do ClickUp.
- **Refinamento técnico na descrição conta como critério**, mas na divergência **vale o
  card**. Testa-se pelo card e registra-se a divergência.
- Todo `CA0N` tem pelo menos um CT obrigatório; todo CT obrigatório aponta para um `CA0N`.
  A matriz CA → CT **abre** o `04-plano.md` e é auditada pelo `qa-revisor`.
- **Os vereditos são exatamente quatro:** `APROVADO` · `REPROVADO` · `BLOQUEADO` ·
  `LIBERADA SEM TESTE`. **"APROVADO com ressalva" não existe** — não escreva o sufixo. Quando
  todos os obrigatórios passam e só um complementar falha, o veredito é `APROVADO`, puro, e o
  achado sai **em destaque** no comentário das duas tarefas, com passos de reprodução.
- **Complementar nunca reprova.** Obrigatório passou = tarefa entregou o que prometeu.
- **Complementar sai do inventário de ações** (`03b-inventario-acoes.md`) e do risco do diff,
  numerado `CX01`, `CX02`…, e carrega justificativa de 1 linha + estimativa em minutos.
- **Complementar precisa do OK do QA** — o gate da etapa 6 do `/testar-tarefa`. Complementar
  não aprovado fica registrado no plano e **não vira spec**. `--sem-complementares` pula a
  proposta inteira.
- Divergência entre o critério de aceite e o que o diff implementa **é achado de QA**: testa-se
  contra o critério e registra-se a divergência.

> Isto **prevalece** sobre qualquer skill externa que prescreva uma matriz de cobertura fixa.
> A lista de negativos, permissão, contrato de API e regressão de vizinhança existe como
> **checklist de inspiração** para os complementares, não como cobertura obrigatória.

## Inventário de ações — o que a entrega faz

Entregável obrigatório do `qa-explorador`, ao lado do mapa de seletores:
`tarefas/<TAREFA>/contexto/03b-inventario-acoes.md`. O mapa lista **seletores**; o inventário lista
**ações e efeitos**.

Uma linha por ação, com as colunas:
`Ação | Onde (tela/rota) | Seletor | O que dispara (método + endpoint) | Efeito observado |
Efeito colateral | Estado que exige`.

- Cobre **tudo** que o diff da etapa 2 tocou: botão, ícone de linha de grid, item de menu de
  contexto, aba, toggle, atalho de teclado e endpoint. Não só o caminho feliz.
- **Efeito observado** é o que acontece de fato (toast, navegação, linha some do grid, campo
  trava, download) — não o que a descrição promete.
- **Efeito colateral** é o que muda fora da tela (outro registro, log/auditoria, permissão, job
  em segundo plano, arquivo gerado). Não observado se escreve `não observado`, **nunca**
  "nenhum".
- **Ação destrutiva** (excluir, inativar, enviar, aprovar) entra sempre no inventário, com o
  aviso de que escreve no ambiente do cliente; só é executada na exploração se houver como
  desfazer ou se a massa for descartável.
- Vale para qualquer tipo de tarefa. Tarefa só de API preenche a tabela com endpoints no lugar
  de seletores.
- Ref lida: a que está no ar no ambiente alvo — `origin/<branchBase>` em hmlg.

O inventário é a matéria-prima dos complementares. Ele **não** cria cenário obrigatório.

## Preparo do ambiente — acessos e massa

Etapa fixa da esteira chamada **Preparo do ambiente**, posicionada depois da escolha do ambiente
e **antes da exploração**. Cite-a pelo nome, nunca por número — a ordem de trabalho do `CLAUDE.md`
e as etapas do `/testar-tarefa` são numerações diferentes. Existe porque muita coisa virava
`BLOQUEADO` sem precisar: o usuário de teste sem o acesso que a tarefa exige, a tarefa descrevendo
o comportamento com dado de **produção** que não existe em hmlg, um fluxo ou parâmetro não
configurado.

**`BLOQUEADO` é último recurso, não primeira saída.** Antes de declarar `BLOQUEADO`, o agente é
obrigado a tentar destravar o que está ao alcance dele em hmlg — configurar fluxo, parâmetro,
cadastro básico, perfil, acesso, feature flag, gerar a massa que falta — e registrar cada
tentativa e o resultado em `04b-preparo-ambiente.md`.

| Destravável pelo agente | `BLOQUEADO` legítimo |
|---|---|
| acesso/permissão do usuário de teste | ambiente fora do ar / erro 5xx generalizado |
| massa inexistente, ou dado de produção citado na tarefa | integração de terceiro indisponível |
| fluxo, parâmetro ou cadastro básico não configurado | credencial inválida ou conta bloqueada |
| perfil de acesso, filial | VPN exigida e ausente (`requerVpn: true`) |
| feature flag em hmlg | banco marcado `db.producao: true` (trava intencional) |
| | a feature não subiu para hmlg |

"Faltou massa" sem tentativa registrada não é `BLOQUEADO` — é trabalho não feito.

**Raio de alcance** (a regra é o raio, não a dificuldade): só o usuário de teste e registro novo
com prefixo `QA-` → o agente resolve sozinho; registro **pré-existente** → captura antes, restaura
depois, diz no comentário; configuração **compartilhada ou global** (parâmetro do sistema, feature
flag global, cadastro básico usado por outras telas, integração) → **para e pergunta ao QA**.

**A trava mais importante:** não configure à mão o que um `CA0N` pedia que o sistema fizesse
sozinho — isso é `APROVADO` em cima do bug. Antes de configurar, responda por escrito no
`04b-preparo-ambiente.md`: *"isto é pré-condição, ou é o comportamento sob teste?"*. Se for o
comportamento sob teste, é `REPROVADO` ou achado. "A feature não subiu para hmlg" **nunca** se
destrava.

**Orçamento:** 3 tentativas por obstáculo; destrave acima de ~10 minutos de setup para e
consulta.

**Acesso — todos os sistemas:**

- **Detecção** é do `qa-analista`: qualquer menção a acesso, permissão, claim, perfil,
  "liberar para o usuário", menu que aparece ou some, tela que exige direito. **Print do dev
  mostrando um menu ou botão que o usuário de teste não enxerga conta como menção.** Vai para
  `## Acessos necessários` do `01-tarefa.md`, com a fonte.
- **Concessão** na tela de acessos do sistema (TODO(empresa): caminho do menu), **sempre na filial `<FILIAL-DE-CONCESSÃO>`**, para
  qualquer cliente. A execução dos cenários continua na filial que o QA informou — são duas
  sessões, dois `storageState`, e **trocar de filial exige `npm run auth` de novo**.
- `<FILIAL-DE-CONCESSÃO>` inexistente para aquele usuário → **parar e perguntar**. Não escolher outra.
- **Não reverter.** O acesso fica, é registrado em `04b-preparo-ambiente.md` e citado no
  comentário do ClickUp.
- O print da tela de acessos é `precondicao` da ficha da `Evidencia`, **nunca** um CT.

**Massa quando a tarefa cita dado de produção:**

- O dado real serve para **entender o caso**, nunca como massa. Não reproduzir o registro real em
  hmlg com os mesmos valores.
- Criar registro **novo e aleatório** que satisfaça a **mesma condição** (status, tipo,
  combinação de flags), suficiente para cada `CA0N` que dependia dele.
- Rastreável: prefixo `QA-<TAREFA>-<runId curto>`; documentos por `support/cnpj.ts`.
- Preferir criar a alterar. Alterou pré-existente → capturar antes, restaurar depois, dizer no
  comentário.
- Nunca em base com `db.producao: true`.

**As quatro travas (nenhuma se afrouxa):** ≤ **20 registros** por rodada · **nunca** criar
usuário, empresa, filial, configuração de integração ou parâmetro global · dado pessoal só
sintético óbvio (`QA Teste <TAREFA>`, `qa-<tarefa>@exemplo.invalid`, nada de nome brasileiro
realista) · **eco de `CLIENTE / SISTEMA / FILIAL / baseURL`** conferido contra o `01-tarefa.md`
antes da primeira escrita. Estourou uma trava → parar e perguntar.

**Registro em dois lugares:** `tarefas/<TAREFA>/contexto/04b-preparo-ambiente.md` por tarefa, e
`docs/massa-em-hmlg.md` — tabela **append-only**, uma linha por rodada que escreveu no ambiente,
com data, tarefa, cliente/sistema, filial, o que foi criado ou concedido e o prefixo para achar
depois. O agente só acrescenta ao fim; nunca reescreve, reordena ou remove linha.

> A skill vendorizada `test-data-management` é **apoio subordinado** a esta regra: onde ela
> sugerir dado realista, limpeza automática de massa ou factory que cria usuário, vale isto aqui.

## Metas de qualidade

Ainda **não formalizadas em número** — o projeto nasceu como esteira de evidência, não como
programa de métrica. Metas de fato em vigor hoje, qualitativas:

- **Zero falso verde.** Cenário que passa validando cliente, sistema ou filial errada é o pior
  defeito possível aqui. É a razão de existir do subagente `qa-revisor`. Critério de aceite sem
  cenário entra na mesma conta: suíte verde cobrindo menos do que a tarefa prometeu.
- **Cobertura de critério: 100%.** Todo critério de aceite da tarefa tem cenário. Essa é a única
  meta numérica em vigor.
- **Escopo aprovado.** Nenhum cenário complementar vira spec sem o OK do QA no gate da
  etapa 6. Agente ampliando escopo sozinho é a mesma classe de erro de reprovar por cenário
  que ninguém pediu.
- **Zero reprovação por erro de script.** Toda falha precisa reproduzir manualmente no navegador
  antes de virar veredito `REPROVADO`. Vale também para escopo: reprovar por cenário
  complementar, que a tarefa não pediu, é a mesma classe de erro.
- **Toda evidência sai de `hmlg`**, com a suíte tendo rodado até o fim.
- **Zero `waitForTimeout`** no código de teste.

> A definir com o QA, se e quando fizer sentido: taxa de flake alvo, duração máxima da suíte,
> cobertura por módulo. Não invente número aqui.

## Áreas de risco

| Área | Risco | Impacto de negócio | Notas |
|---|---|---|---|
| Escopo do teste | **Crítico** | Alto | Critério de aceite sem cenário aprova menos do que a tarefa prometeu; cenário complementar usado para reprovar devolve o dev para a fila por algo que ninguém pediu. Os dois são auditados pelo `qa-revisor`. |
| Seleção de cliente + sistema | **Crítico** | Alto | Dois sistemas parecidos do mesmo cliente são aplicações diferentes. Errar produz teste que passa validando a coisa errada. Nunca chutar — perguntar. |
| Seleção de **filial** (sistemas com filial) | **Crítico** | Alto | A sessão fica presa à filial. Trocar de filial exige `npm run auth` de novo, senão reaproveita a sessão anterior sem avisar. O QA informa a filial em toda tarefa. |
| Seletores em tela sem `data-testid` | **Crítico** | Alto | Chutar seletor a partir de print da tarefa é a **principal causa de flaky**. Confirmar sempre no código-fonte. |
| Defasagem hmlg × branch | Importante | Médio | Teste verde em local e vermelho em hmlg é achado, não ruído. |
| Banco de produção | **Crítico** | Alto | `db.producao: true` bloqueia a execução. Nunca remover a flag. |
| Credencial / AD | Importante | Médio | Sistema com login integrado ao Active Directory: a senha expira e o lockout é real. `retries: 0` no projeto `setup` existe para isso. |
| VPN | Monitorar | Baixo | Sistemas com `requerVpn: true`. Erro de conexão neles é ambiente, não bug. |
| Dado sensível em evidência | Importante | Alto | CPF/CNPJ real, senha ou token visível em print é vazamento. Mascarar antes de capturar, ou usar massa sintética. |
| Massa deixada em hmlg | Importante | Médio | O agente **escreve** no ambiente do cliente ao conceder acesso e gerar massa, e não reverte o acesso. Sem `04b-preparo-ambiente.md` + linha em `docs/massa-em-hmlg.md`, ninguém sabe depois o que é lixo de teste. Teto de 20 registros por rodada. |
| Criação de entidade global | **Crítico** | Alto | Usuário, empresa, filial, configuração de integração e parâmetro global sobrevivem à tarefa e afetam todo mundo naquele hmlg. O agente **nunca** cria — pergunta. |

## Time

QA de **uma pessoa**, com o agente como automatizador. Devs em outro quadro do ClickUp.
Razão dev:QA alta — o modelo é: QA dono da estratégia, do E2E de caminho crítico e do teste
exploratório; automação escrita pelo agente sob revisão humana.

**O agente nunca movimenta o board.** Comenta nas duas tarefas e anexa evidência na tarefa de QA.
Mover coluna e abrir a rodada seguinte (`QA0<N+1>-`) é manual, do QA.

## Convenções

**Política de seletor — ordem obrigatória, sem exceção:**

1. `data-testid` → `page.getByTestId()`
2. `role` + nome acessível → `page.getByRole('button', { name: 'Salvar' })`
3. `aria-label` → `page.getByLabel()`
4. `placeholder` → `page.getByPlaceholder()`
5. Texto visível → `page.getByText()` — último recurso, cuidado com i18n

**Proibido:** classe CSS gerada por build, `nth-child`, `data-v-*`, XPath posicional, seletor
copiado do DevTools sem revisão.
**PrimeVue:** usar `data-pc-section` / `data-pc-name`.
**Sempre confirmar o seletor no código-fonte antes de escrever.** Componente sem `data-testid`
é um achado — registrar como sugestão de testabilidade no comentário do ClickUp e usar o melhor
fallback disponível.

> Esta ordem **prevalece** sobre a de qualquer skill externa (o upstream do `qa-skills` prega
> `getByRole` primeiro). Aqui é `data-testid` primeiro.

**Waits:**

- `page.waitForTimeout()` — **proibido**, sem exceção.
- `page.waitForResponse()` — **obrigatório** em toda ação que dispara chamada de API.
- Asserção auto-retry: `await expect(locator).toBeVisible()`.
- `waitForLoadState('networkidle')` só na navegação inicial, nunca no meio do fluxo.

**Autenticação:** login uma vez por `cliente+sistema+perfil+filial` via `storageState` em
`support/.auth/`. Nunca no `beforeEach`. Credenciais só via `credenciaisDe(perfil)`.
**Nunca ler, imprimir ou pedir o conteúdo do `.env`** — está em `deny` no `settings.json`.

**Idioma:** código, nome de teste, comentário e comunicação em **português do Brasil**.
Arquivo em kebab-case sem acento; variável em camelCase.

**Evidência:** screenshots numeradas `NN-ct0N-descricao.png` em `tarefas/<TAREFA>/evidencias/`, uma após
cada asserção principal e uma no momento exato de qualquer falha, mais `resultado.json`.
O PDF final é do comando `/evidencia` — nunca improvisar documento.

## Comandos

```bash
CLIENTE=<c> SISTEMA=<s> npm run auth          # gera o storageState
CLIENTE=<c> SISTEMA=<s> npm test              # hmlg — evidência oficial
CLIENTE=<c> SISTEMA=<s> npm run test:local    # localhost — apoio
CLIENTE=<c> SISTEMA=<s> npm run acompanhar    # headed + slowMo, só para assistir
CLIENTE=<c> SISTEMA=<s> FILIAL="<FILIAL-DE-CONCESSÃO>" npm test
npm run doctor                                # diagnostica a configuração
npm run typecheck
```

`ACOMPANHAR` **nunca** no run que gera a evidência oficial: o `slowMo` mascara race condition e
o cursor falso entra no screenshot.

## Skills e comandos do projeto

| Local (`.claude/skills/`) | Papel |
|---|---|
| `playwright-padrao` | Como escrever spec, Page Object, fixture. Estrutura, seletor, wait, auth. |
| `analise-branch` | Extrair contexto de teste do `git diff` da branch da tarefa. |
| `captura-evidencia` | Contrato do `resultado.json` e disciplina de captura durante o teste. |
| `clickup-qa-workflow` | Pareamento `QA0N-`, veredito, formato de comentário, anexo. |

| Vendorizada de `qa-skills` | Quando entra |
|---|---|
| `test-data-management` | `tarefas/<ID>/fixtures/`, massa determinística, dado sintético. |
| `selector-drift-recovery` | Refactor de UI quebrou vários specs de uma vez. |
| `test-reliability` | Um teste flaky; passa em local, falha em hmlg. |
| `ai-qa-review` | `qa-revisor` auditando spec antes do run oficial. |

| Comando | Papel |
|---|---|
| `/analisar-tarefa` · `/testar-tarefa` · `/reteste` · `/evidencia` | Esteira principal. |

**Entregáveis por tarefa em `tarefas/<TAREFA>/contexto/`:**
`01-tarefa.md` (ClickUp + `CA0N` + acessos + dado de produção citado) · `02-codigo.md` (diff) ·
`03-mapa-seletores.md` · `03b-inventario-acoes.md` · `04-plano.md` (matriz CA → CT no topo) ·
`04b-preparo-ambiente.md` (o que foi concedido e criado no ambiente do cliente).

**Fora da pasta da tarefa:** `docs/massa-em-hmlg.md` — índice append-only de tudo que o agente
deixou nos ambientes dos clientes.

| Subagente | Papel |
|---|---|
| `qa-analista` · `qa-codigo` · `qa-explorador` · `qa-implementador` · `qa-executor` · `qa-revisor` | Divisão de trabalho da esteira. |
