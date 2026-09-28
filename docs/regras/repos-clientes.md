> Regra do projeto — parte de `CLAUDE.md`. Mesma força do arquivo principal.

## 📦 Repositórios dos clientes

Os clones ficam **onde já estão** na máquina, apontados por `config/clientes.json`
(`repos.front` / `repos.back`) e autorizados em `.claude/settings.json`
(`permissions.additionalDirectories`). Nada é copiado para dentro do projeto.

São repositórios grandes (C#, alguns com vários GB). Portanto:

1. **Comece sempre pelo diff**, nunca por busca ampla. Qual diff depende de a tarefa já estar
   mergeada — a regra está em "Qual diff usar" logo abaixo. Isso reduz de dezenas de milhares
   de arquivos para os poucos que a tarefa tocou.
2. **Nunca** rode `grep`/`Glob` recursivo na raiz do repositório.
3. Ao buscar, exclua sempre: `bin/`, `obj/`, `packages/`, `node_modules/`, `dist/`, `.vs/`,
   `wwwroot/lib/`, `*.min.js`, `*.dll`.
4. Leia arquivo inteiro só quando ele estiver no diff. Fora do diff, leia o trecho relevante.

Tratamento **read-only**: apenas `fetch`, `diff`, `log`, `show`, `branch`, `rev-parse`.
Nunca `commit`, `push`, `add`, `stash`, `reset`, `rebase`, `merge` ou edição de arquivo nesses
repositórios — são os repositórios de trabalho dele, não a sua área de rascunho.

### `develop` é homologação — o que isso implica

Confirmado com o devops: **quando a tarefa sobe para homologação, ela é mergeada na
`develop`**. Logo, `develop` é o código que está de pé em hmlg, e uma tarefa em
`EM TESTE (QA)` **já está mergeada**. Branch aberta é a exceção, não o caso normal.

Daí saem as duas regras seguintes, e elas não são a mesma coisa:

| Pergunta | Ref que responde |
|---|---|
| **O que testar** — escopo, `CA0N` inferidos, arquivos tocados | a **branch da tarefa** (via diff) |
| **Com o que testar** — seletor, validação, rota, payload | **`origin/develop`**, que é o que roda em hmlg |

### Qual diff usar — depende de já estar mergeada

**Primeiro** descubra se está na base; só então escolha o diff:

```bash
git -C <repo> fetch --all --prune
git -C <repo> log --oneline --merges --grep="TSK-12345" -5 origin/<branchBase>
```

- **Achou o merge** (caso normal, alvo `hmlg`) → diff do merge commit:
  ```bash
  git -C <repo> diff <sha-do-merge>^1 <sha-do-merge>
  ```
- **Não achou** (branch aberta, alvo `local`) → three-dot contra a base:
  ```bash
  git -C <repo> diff "origin/<branchBase>...origin/<branch-da-tarefa>"
  ```

Por que isso importa: **`origin/develop...origin/feature/X` volta vazio depois do merge** — o
merge-base passa a ser a própria ponta da branch, então o range não contém nada. Como a tarefa
chega em QA já mergeada, esse é o caminho padrão, não a borda. E diff vazio não dá erro: o
agente simplesmente fica sem código, monta o plano só pela descrição do card e perde os `CA0N`
`[inferido do diff]`.

O mesmo vale para os recortes por tipo de arquivo (telas, rotas, controllers, migrations):
aplique-os sobre o diff que você escolheu acima, nunca sobre `...HEAD`.

### Qual versão do código o agente lê — sempre por ref, nunca do disco

O agente **não faz checkout**. Portanto `HEAD` e os arquivos em disco são a branch que estiver
ativa na máquina — quase sempre `develop`, às vezes a branch da tarefa anterior. Nada disso
tem relação com a tarefa em teste.

Regra: **toda** leitura de código sai de uma **ref explícita**, e a ref depende do alvo:

```bash
# alvo hmlg (padrão) — o código no ar é a develop
git -C <repo> show "origin/develop:src/views/Clientes.vue" | grep -n "data-testid"

# alvo local (branch não mergeada) — o código no ar é a branch
git -C <repo> show "origin/feature/TSK-12345:src/views/Clientes.vue" | grep -n "data-testid"
```

Nunca `grep <repo>/src/views/Clientes.vue`, nunca `...HEAD`. A falha é silenciosa: nada no
caminho acusa erro, e o sintoma aparece só na execução, como seletor que não existe no
ambiente — indistinguível de bug do sistema, e é assim que se reprova um dev por erro de
script. Ler o seletor da branch quando o alvo é hmlg tem a mesma falha silenciosa: depois do
merge os dois quase sempre coincidem, mas se outra tarefa mexeu na mesma tela e entrou na
`develop` depois, quem manda é a `develop`.

Se o seletor divergir entre a branch e a `develop`, isso é **achado de QA** — registre no
`02-codigo.md` e comente no ClickUp; não escolha um dos dois em silêncio.

Precisa do arquivo inteiro? Materialize em `tarefas/<TAREFA>/contexto/fontes/` e leia de lá. Nunca
escreva dentro do repositório do cliente.

**Duas tarefas do mesmo cliente ao mesmo tempo:** a análise roda em paralelo, porque cada uma
sai da sua ref e grava no seu `tarefas/<TAREFA>/contexto/` — a árvore de trabalho não é disputada.
O que serializa é a execução com `AMBIENTE=local`, que só sustenta uma branch por vez; em
`hmlg` não há conflito, já que o ambiente roda a `branchBase`.

Detalhe operacional em `.claude/skills/analise-branch/SKILL.md`.

---

