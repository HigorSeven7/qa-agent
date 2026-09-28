---
name: analise-branch
description: Extrai contexto de teste do código-fonte de uma tarefa — localiza a branch nos repos clonados, descobre se já foi mergeada, gera o diff correto para o caso (merge commit quando mergeada, three-dot quando branch aberta) e deriva rotas, endpoints, data-testid, validações e regras de negócio afetadas. Use antes de escrever qualquer teste, e sempre que precisar saber o que uma tarefa realmente mudou no sistema.
---

# Análise de branch para QA

O código-fonte é a fonte da verdade do que a tarefa entregou. A descrição no ClickUp é
sempre um resumo — e frequentemente um resumo desatualizado. Esta skill converte a branch
da tarefa em contexto de teste utilizável.

> Os repositórios dos clientes são **read-only**. Apenas `fetch`, `diff`, `log`, `show`,
> `branch`, `rev-parse`. Nunca `commit`, `push`, `add`, `stash`, `reset`, `rebase`, `merge` ou
> edição de arquivo — são os repositórios de trabalho dele, não área de rascunho.

## 0. Resolver o cliente e o caminho do repositório

Os clones **não** ficam dentro do projeto. Leia `config/clientes.json` e pegue o caminho real:

```bash
# caminhos do cliente (ex.: acme)
cat config/clientes.json      # clientes.<id>.repos.front / .back / branchBase
```

Trabalhe sempre com `git -C "<caminho>"`, sem `cd`:

```bash
REPO="C:/dev/acme/acme-web"      # de clientes.<id>.repos.front
BASE="develop"                       # de clientes.<id>.branchBase
```

Se o caminho não existir, pare e avise — provavelmente o cliente não está clonado nessa
máquina, ou `config/clientes.json` está apontando para o lugar errado. `npm run doctor`
confirma isso em um comando.

### Repositórios grandes — regra de ouro

Alguns clones têm vários GB. **Nunca** faça busca ampla na raiz. Sempre parta do diff (qual
diff, na seção 2). Isso reduz de dezenas de milhares de arquivos para os poucos que a tarefa
tocou. Ao buscar dentro do repositório, exclua sempre: `bin/`, `obj/`, `packages/`,
`node_modules/`, `dist/`, `.vs/`, `wwwroot/lib/`, `*.min.js`, `*.dll`.

### `$BASE` é o ambiente de homologação

Confirmado com o devops: subir a tarefa para hmlg **é** mergear na `$BASE` (`develop`). Duas
consequências que atravessam toda esta skill:

- Tarefa em `EM TESTE (QA)` **já está mergeada**. É o caso normal; branch aberta é a exceção.
- **`origin/$BASE` é o código no ar em hmlg.** Escopo sai da tarefa; seletor sai do que está
  no ar. Não são a mesma ref.

## 1. Localizar a branch e descobrir se já foi mergeada

O convencional é o ID da tarefa aparecer no nome da branch.

```bash
git -C "$REPO" fetch --all --prune
git -C "$REPO" branch -a --list "*TSK-12345*"

# mergeada? esta resposta decide o diff (seção 2) e o ambiente (seção 4)
git -C "$REPO" log --oneline --merges --grep="TSK-12345" -5 origin/$BASE
```

Não achou? Tente, em ordem:

```bash
# 1) pelo ID no assunto dos commits recentes
git -C "$REPO" log --all --oneline --grep="TSK-12345" -20

# 2) branches mexidas nos últimos dias, mais recente primeiro
git -C "$REPO" for-each-ref --sort=-committerdate \
  --format='%(committerdate:short) %(refname:short) %(authorname)' refs/remotes | head -30

# 3) o ID pode estar num comentário do ClickUp ou no link do PR
```

Se ainda não achar, **pergunte ao usuário** qual é a branch. Não adivinhe: analisar a branch
errada produz um plano de teste inteiro errado, e o erro só aparece na execução.

Se nem o nome da branch nem o merge aparecerem, mas houver commits com o ID direto na `$BASE`
(merge fast-forward ou squash), pegue o range pelos próprios commits:

```bash
git -C "$REPO" log origin/$BASE --oneline --grep="TSK-12345" -20
```

## 2. Gerar o diff — o comando depende do resultado da seção 1

Guarde o diff escolhido numa variável e use **só ela** daqui para frente:

```bash
# CASO NORMAL — mergeada, alvo hmlg: o que o merge trouxe para a base
RANGE="<sha-do-merge>^1 <sha-do-merge>"

# EXCEÇÃO — branch aberta, alvo local: o que a branch introduziu (three-dot)
RANGE="origin/$BASE...origin/feature/TSK-12345"

# squash/fast-forward, sem merge commit: o próprio commit na base
RANGE="<sha-do-commit>^ <sha-do-commit>"

git -C "$REPO" diff --stat $RANGE
git -C "$REPO" diff        $RANGE
```

> ⚠️ **Não use three-dot em tarefa mergeada.** `origin/$BASE...origin/feature/X` volta **vazio**
> depois do merge — o merge-base vira a própria ponta da branch. E vazio não dá erro: você fica
> sem código, o plano cai para a descrição do card e os `CA0N` `[inferido do diff]` somem. Se o
> diff vier vazio, **é isso que aconteceu** — volte para a seção 1 e pegue o merge commit.

Diff grande? Fatie por tipo de arquivo em vez de ler tudo de uma vez:

```bash
git -C "$REPO" diff $RANGE --name-only | grep -E '\.(vue|tsx|jsx|cshtml|razor)$'  # telas
git -C "$REPO" diff $RANGE --name-only | grep -iE 'router|routes'                 # rotas
git -C "$REPO" diff $RANGE --name-only | grep -iE 'controller|service|handler'    # backend
git -C "$REPO" diff $RANGE --name-only | grep -iE 'migration|\.sql$'              # banco
git -C "$REPO" diff $RANGE --name-only | grep -iE 'appsettings|\.env|config'      # config
```

Migração de banco no diff é sinal de alerta: pode exigir dado novo, quebrar registro
existente, ou precisar de validação direta no banco além da UI.

## 3. Extrair o que interessa para o teste

Aqui a ref muda: o **escopo** veio do diff da tarefa, mas o **seletor tem que sair do código
que está no ar no ambiente alvo**. Nunca leia do disco — o `HEAD` da máquina é a branch que
o QA tiver ativa, e não tem relação com a tarefa.

```bash
REF="origin/$BASE"                      # alvo hmlg (padrão)
# REF="origin/feature/TSK-12345"        # alvo local (branch não mergeada)
ARQ="src/views/Clientes.vue"            # caminho relativo, vindo do diff
```

Para cada arquivo de tela **que está no diff** (nunca busca ampla na raiz):

```bash
# seletores reais
git -C "$REPO" show "$REF:$ARQ" | grep -n "data-testid\|data-pc-name\|aria-label"

# validações e mensagens literais
git -C "$REPO" show "$REF:$ARQ" | grep -nE "required|obrigat|min|max|pattern|rule|validat"

# chamadas de API disparadas pela tela
git -C "$REPO" show "$REF:$ARQ" | grep -nE "axios|fetch|HttpClient|api\."
```

Precisa do arquivo inteiro? Materialize em `tarefas/<TAREFA>/contexto/fontes/` com
`git -C "$REPO" show "$REF:$ARQ" > tarefas/<TAREFA>/contexto/fontes/<arquivo>` e leia de lá. **Nunca**
escreva dentro do repositório do cliente.

Divergência de seletor entre a branch e a `$BASE` (outra tarefa mexeu na mesma tela e entrou
depois) é **achado de QA**: registre e comente no ClickUp, não escolha um dos dois em silêncio.

Para rotas: leia o arquivo de router alterado e extraia path, nome, guards e permissões.

Para backend: nos controllers alterados, extraia verbo HTTP, path, DTO de entrada,
validações do modelo, códigos de status retornados e regras de autorização por perfil.

## 4. Confirmar o ambiente

Você já respondeu isso na seção 1 — aqui é só confirmar e registrar. Se sobrar dúvida:

```bash
git -C "$REPO" log origin/$BASE --oneline | grep -i "TSK-12345"   # entrou na base?
git -C "$REPO" branch -r --contains <sha-da-branch>              # onde o commit está
```

Está em `$BASE` → a feature está em hmlg → alvo `hmlg`, `REF="origin/$BASE"`.

**Não** está em `$BASE` → a feature não subiu → alvo `local`, `REF="origin/<branch>"`, diff
three-dot. Isso precisa estar explícito no comentário do ClickUp, porque evidência de
localhost não é evidência de homologação.

Discrepância a gritar, não a resolver sozinho: a tarefa está em `EM TESTE (QA)` (ou seja, o
devops disse que subiu) mas o commit **não** aparece na `$BASE`. Registre como achado — pode
ser deploy que não saiu, branch errada, ou merge que ficou para trás.

## 5. Entregável

Escreva `tarefas/<TAREFA>/contexto/02-codigo.md`:

```markdown
# Análise de código — <TAREFA>

| | |
|---|---|
| Cliente | <id> — <nome> |
| Repositório | <caminho> |
| Branch | <branch> |
| Base | <branchBase> |
| Commit HEAD | <sha curto> — <mensagem> |
| Mergeada na base | sim / não |
| Presente em hmlg | sim / não / incerto |
| Diff usado | merge commit `<sha>^1..<sha>` / three-dot `origin/<base>...<branch>` |
| Ref lida para seletor | `origin/<base>` (hmlg) / `origin/<branch>` (local) |

## Resumo técnico da mudança
<o que o código faz, em 3-6 linhas — derivado do diff, não da descrição da tarefa>

## Arquivos alterados

| Arquivo | Tipo | O que mudou | Impacto no teste |
|---|---|---|---|

## Rotas afetadas
| Rota | Tela | Permissão / guard |
|---|---|---|

## Endpoints afetados
| Método | Path | Payload | Status esperados | Validações |
|---|---|---|---|---|

## Seletores encontrados no código
| Elemento | Seletor | Arquivo:linha |
|---|---|---|

## Validações e mensagens literais
| Campo | Regra | Mensagem exata | Arquivo:linha |
|---|---|---|---|

## Regras de negócio derivadas do código
- ...

## Migrações / mudanças de banco
- ...  (ou "nenhuma")

## Critérios de aceite inferidos do diff
> Preencher **só** quando a descrição do card não trouxe nenhum critério (`01-tarefa.md`
> marcado "a inferir do diff"). O comportamento observável que a branch mudou **é** o critério
> implícito. Devolva estes CAs para a seção `## Critérios de aceite` do `01-tarefa.md`.

| ID | Critério (comportamento verificável) | Fonte | Onde no diff |
|---|---|---|---|
| CA01 | ... | `[inferido do diff]` | `<arquivo:linha>` |

- ...  (ou "não se aplica — a descrição já trazia critério")

## Divergências entre o critério de aceite e o código
- ...  ← achado de QA: testa-se contra o **CA**, registra-se a divergência
  ("CA02 pede X; o diff implementa Y"). Código fazendo **menos** que o CA tende a `REPROVADO`;
  fazendo **mais**, é achado de escopo e pode virar cenário complementar.

## Áreas de risco para regressão
- <o que este diff toca e que já funcionava antes>
```

## Armadilhas

- **Diff vazio** — quase sempre é three-dot em tarefa já mergeada, não tarefa sem mudança.
  Volte para a seção 1, pegue o merge commit. Nunca conclua "a tarefa não mudou nada" a partir
  de um diff vazio.
- **Inferir CA quando não precisa** — se a descrição do card já trazia critério de aceite, o
  diff **não** cria CA nenhum. Ele é a fonte da verdade de seletor, rota, endpoint, payload e
  texto de mensagem; o escopo continua sendo o do card. Critério inferido só existe quando a
  descrição não trouxe nada, e sai marcado `[inferido do diff]` e em destaque no ClickUp.
- **Diff contra a branch errada** — `main` em vez de `develop` traz centenas de arquivos
  irrelevantes e afoga o contexto real. Confirme a base.
- **Dois pontos versus três pontos** — o `...` só vale para **branch aberta**. Com `..` você
  vê também o que a base avançou depois, o que não é da tarefa; em tarefa mergeada nenhum dos
  dois serve, use o range do merge commit.
- **Seletor da branch com alvo hmlg** — depois do merge quase sempre coincide, mas quando não
  coincide o teste quebra em hmlg parecendo bug do sistema. Leia de `origin/$BASE`.
- **Confiar no arquivo de teste do dev** — teste unitário do dev não substitui teste de QA,
  e às vezes está errado junto com o código.
- **Ignorar arquivos de config e env** — mudança em `.env.example`, feature flag ou config
  de cliente costuma ser exatamente o que faz a feature "não funcionar" em hmlg.
