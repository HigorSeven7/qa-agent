# QA Agent

Esteira de QA guiada por tarefa do ClickUp, **multi-cliente e multi-sistema**, com Claude Code +
Playwright. Você manda o link da tarefa do dev e o agente:

1. identifica o alvo (cliente + sistema);
2. analisa a tarefa, os comentários, os anexos e o **código da branch**;
3. explora o fluxo no navegador;
4. gera os specs Playwright;
5. executa em homologação;
6. produz a evidência em PDF;
7. anexa tudo na sua tarefa de QA.

Este repositório é o **esqueleto limpo**, pronto para configurar numa empresa nova. Tudo que
depende da empresa está marcado com `TODO(empresa)`:

## Rodar esse comando para listar tudo o que falta preencher, direto no código.
```bash
grep -rn "TODO(empresa)"
```

```bash
grep -rn "TODO(empresa)" --exclude-dir=node_modules .
```

---

## A decisão de arquitetura, em um parágrafo

**Contexto vem do código. Evidência vem de homologação.**

O que dá contexto ao agente não é o app rodando em localhost. É o **código-fonte**:
- os componentes, de onde saem os `data-testid` reais;
- o router, que mostra o fluxo;
- os services, com endpoints e payloads;
- o `git diff` contra a base, que diz **exatamente** o que mudou.

O ambiente onde o teste roda é só o `baseURL`, e o alvo oficial é **homologação**. Trocar de alvo
é uma variável: `CLIENTE=acme SISTEMA=crm npm test`.

---

## Instalação numa empresa nova

### 1. Máquina

| Item | Por quê |
|---|---|
| Git (no Windows, Git for Windows) | o Claude Code usa o Git Bash |
| **Node.js 22.6 ou mais novo** | o hook `guarda-spec.ts` roda com `node` puro |
| Python 3 no PATH (`python`) | `.claude/scripts/gerar-evidencia.py`, só biblioteca padrão |
| Edge ou Chrome | imprime o PDF da evidência |
| `uv` (`winget install astral-sh.uv`) | instala o graphify |
| `agent-browser` (`npm i -g agent-browser && agent-browser install`) | o `qa-explorador` mapeia a tela pelo snapshot de acessibilidade |
| Cliente do banco (hoje `sqlcmd`) | só se usar `support/db.ts` |
| VPN | se algum hmlg exigir |

### 2. Projeto

```bash
npm install                                  # o postinstall baixa o Chromium
cp config/clientes.example.json config/clientes.json
cp .env.example .env
npm run typecheck && npm run test:unit
```

### 3. O que configurar (`TODO(empresa)`)

| Onde | O quê |
|---|---|
| `CLAUDE.md` → "Configuração da empresa" | nome, prefixo do ID de tarefa, ref de hmlg, filial de concessão |
| `config/clientes.json` | um bloco por sistema: URLs, perfis, `repos`, `branchBase`, `produto`, `db.producao` |
| `.env` | token do ClickUp e `<CLIENTE>_<SISTEMA>_<PERFIL>_USER` / `_PASS` |
| `.claude/settings.json` → `additionalDirectories` | pasta dos clones dos repositórios |
| `support/logins/` | um login por produto (molde: `exemplo.ts`) |
| `support/clientes.ts` | `PRODUTO_PADRAO` e `PRODUTOS_COM_FILIAL` |
| `pages/` | base do design system de cada produto, se não for PrimeVue |
| `docs/regras/multicliente.md` | tabela "Sistemas já mapeados" |
| `docs/regras/preparo-ambiente.md` | tela de concessão de acesso |
| `.claude/skills/captura-evidencia/cover.jpg` + `EMPRESA` no `gerar-evidencia.py` | capa e rodapé do PDF |
| `.codex/.agents/qa-project-context.md` | produto, stack e riscos da empresa |

Depois de mexer em `.claude/agents/`, rode `npx tsx scripts/sincronizar-codex.ts` (só se usar
Codex).

### 4. Validar

```bash
npm run doctor                         # diz o que falta, sistema por sistema
npm run doctor -- acme crm             # só um sistema
CLIENTE=acme SISTEMA=crm npm run auth  # gera o storageState
```

No Claude Code: `/mcp` mostra o ClickUp conectado. Depois `/analisar-tarefa <link>` numa tarefa
real.

---

## Onde fica cada coisa

| Arquivo | Conteúdo | O agente lê? | Vai pro git? |
|---|---|---|---|
| `config/clientes.json` | URLs, hosts de banco, caminhos dos repos, perfis, aliases | **Sim** | **Não** |
| `.env` | usuário/senha por cliente/sistema/perfil, token do ClickUp | **Não** — bloqueado em `.claude/settings.json` | **Não** |

### Travas de segurança

- **Banco de produção:** o `validarSelecao()` **aborta a execução** de sistema com
  `db.producao: true`.
- **`requerVpn`:** o agente sabe que falha de conexão ali é VPN, não bug.
- **`avisos`:** o agente lê antes de concluir que algo quebrou (ex.: sem credencial, roda em
  localhost).
- **Credenciais:** chegam ao teste só via `credenciaisDe(perfil)`. O agente nunca as vê, então
  não tem como vazá-las.

### Os repositórios: **não copie nada para dentro do projeto**

Aponte `repos` em `config/clientes.json` para o clone real e autorize a pasta em
`additionalDirectories`. Use barra `/` mesmo no Windows. Não use junction nem symlink: o ripgrep
não segue. Detalhes em `repos/LEIA-ME.md`.

---

## Uso

```
/testar-tarefa <link da tarefa do dev>
/testar-tarefa TSK-12345 --cliente=acme --sistema=crm   # fixa o alvo
/testar-tarefa TSK-12345 --local                        # força localhost
/testar-tarefa TSK-12345 --revisar-plano                # pausa no plano e espera seu OK
/analisar-tarefa TSK-12345                              # só o plano
/reteste TSK-12345                                      # tarefa voltou de REPROVADO
```

Comece pelo `/analisar-tarefa` nas duas ou três primeiras tarefas.

### De onde saem os cenários

**O que testar vem dos critérios de aceite da descrição do card. Como testar vem do código.**

- **Obrigatórios:** todo critério de aceite (`CA01`, `CA02`…) vira pelo menos um cenário
  obrigatório. Só esses decidem o veredito.
- **Complementares:** cenário fora dos critérios. O agente propõe, você aprova. Se falhar, vira
  achado e não reprova, a menos que você responda `reprova` no gate.

## Comandos

```bash
CLIENTE=acme SISTEMA=crm npm test            # hmlg — evidência oficial
CLIENTE=acme SISTEMA=crm npm run test:local  # localhost — apoio
CLIENTE=acme SISTEMA=crm npm run test:headed # hmlg, vendo o navegador
CLIENTE=acme SISTEMA=crm npm run acompanhar  # headed + cursor, nunca para evidência
CLIENTE=acme SISTEMA=crm npm run auth        # (re)gera storageState
npm run doctor                               # diagnostica tudo
npm run typecheck                            # tsc --noEmit
npm run test:unit                            # testes do support/ (precisa de config/clientes.json)
npm run report                               # abre o report HTML
```

---

## Estrutura

```
config/clientes.json    URLs, repos, perfis por cliente+sistema (SEM segredo)
.env                    credenciais e token (agente não lê)
scripts/doctor.ts       npm run doctor

.claude/
├── commands/           /testar-tarefa · /analisar-tarefa · /reteste · /evidencia
├── agents/             qa-analista · qa-codigo · qa-explorador · qa-implementador ·
│                       qa-executor · qa-revisor · qa-publicador
├── skills/             locais:       clickup-qa-workflow · analise-branch ·
│                                     playwright-padrao · captura-evidencia
│                       vendorizadas: test-data-management · selector-drift-recovery ·
│                                     test-reliability · ai-qa-review
├── scripts/            gerar-evidencia.py · guarda-spec.ts (hook)
└── settings.json       permissões, deny do ClickUp, hooks

CLAUDE.md               as regras — sempre em contexto
docs/regras/            o resto das regras, lidas sob demanda
docs/massa-em-hmlg.md   índice append-only do que o agente deixou em hmlg
repos/                  deve ficar VAZIA
pages/                  Page Objects reusados (base.page.ts + um subdiretório por sistema)
support/                clientes · env · auth · logins · evidencias · caminhos
tarefas/                uma pasta por tarefa; é o testDir do Playwright
```

Dentro de `tarefas/<ID>/` **só `specs/`, `fixtures/`, `pages/*.page.ts` e `alvo.json` entram no
git**. O resto tem dado de cliente. O `.gitignore` nega por padrão e o `npm run doctor` reprova se
algo fora disso aparecer versionado.

---

## Os sete subagentes

| Agente | Entrada | Saída |
|---|---|---|
| `qa-analista` | link da tarefa | `01-tarefa.md` + cliente identificado |
| `qa-codigo` | tarefa | `02-codigo.md` + resumo do diff |
| `qa-explorador` | tarefa + código | `03-mapa-seletores.md` + `03b-inventario-acoes.md` |
| `qa-implementador` | plano + mapa | spec + Page Object |
| `qa-executor` | specs | `05-execucao.md` + tabela CT → classificação |
| `qa-revisor` | tudo | veredito (caça falso verde e falso vermelho) |
| `qa-publicador` | `rascunho-veredito.md` + `resultado.json` | PDF, anexo na tarefa de QA e comentário nas duas tarefas (não decide veredito) |

---

## Fluxo no ClickUp

**O agente não opera o quadro.** Ele escreve exatamente duas coisas no ClickUp:

| Ação | Onde |
|---|---|
| Comentário do resultado | **nas duas tarefas** — a de QA e a do dev |
| Anexo da evidência (PDF + `resultado.json` + zip das imagens) | **só na tarefa de QA** |

Mudar status, criar tarefa, link, tag e dependência estão em `deny` no `.claude/settings.json`,
nas duas grafias de ferramenta: o conector `mcp__claude_ai_ClickUp__*` e o MCP local
`mcp__ClickUp__*` do `.mcp.json`. O veredito vai como **texto no comentário**. Mover coluna é
manual.

**Outro gerenciador (Jira, Azure Boards…)?** Conecte o MCP dele. Libere só leitura, comentário e
anexo no `allow`, e ponha **toda outra escrita** no `deny`. Depois reescreva
`docs/regras/clickup.md` e a skill `clickup-qa-workflow`.

---

## Graphify

É um mapa do código deste projeto (`graphify-out/graph.json`): arquivos, funções e quem chama
quem. Em vez de ler arquivo inteiro, o agente consulta o mapa e gasta menos contexto.

```bash
uv tool install graphifyy               # dois "y"; instala graphify em ~/.local/bin
graphify extract . --code-only          # gera o mapa sem custo de API
graphify update .                       # atualiza depois de mexer no código (grátis)
graphify query "como funciona o login"  # pergunta livre
graphify explain "credenciaisDe"        # um símbolo e seus vizinhos
graphify affected "BasePage"            # o que é afetado se isso mudar
```

- **Onde está ligado:** hooks `graphify hook-guard` no `.claude/settings.json` e no
  `.codex/hooks.json` (exigem `graphify` no PATH), e a seção `## graphify` do `CLAUDE.md`.
- **Não versionado:** `graphify-out/` está no `.gitignore`. Gere o mapa em cada máquina.
- **Não rode dentro do repositório dos sistemas testados:** ele grava `graphify-out/` lá. Para
  mapear um desses repositórios, use `--out` apontando para fora.
- **Para remover:** rode `graphify uninstall`. Depois tire os hooks, a seção do `CLAUDE.md` e as
  entradas `graphify` do `allow`.

---

## Ordem sugerida de adoção

1. **Semana 1:** um sistema só. `/analisar-tarefa` em 3 tarefas. Ajuste o `CLAUDE.md` com o que
   o agente errou sobre o sistema.
2. **Semana 2:** esteira completa com `--revisar-plano`.
3. **Semana 3:** esteira de ponta a ponta, sem a flag.
4. **Depois:** o segundo sistema.

## Limites — o que ele não faz

- **Não substitui teste exploratório.**
- **Não julga UX.**
- **Não testa o que não vê.** Regra que não está na tarefa nem no código, ele não adivinha.
- **Não valida em produção.**
- **Não opera o quadro do ClickUp.**
- **Não assiste vídeo anexado.** Se a regra só existe num vídeo, você resume.
