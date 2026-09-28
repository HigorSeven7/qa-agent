# NÃO copie os repositórios para cá

Esta pasta é opcional e, na maioria dos casos, deve ficar **vazia**.

O agente não precisa que o código esteja dentro do projeto — precisa apenas **poder ler** o
código onde ele já está. Copiar um repositório C# de 5 GB para cá significa 5 GB duplicados
que ficam desatualizados no dia seguinte.

## Como fazer certo

1. Em `config/clientes.json`, aponte `repos.front` / `repos.back` para o caminho **real** do
   clone na sua máquina:

   ```json
   "repos": {
     "front": "C:/dev/acme/acme-web",
     "back":  "C:/dev/acme/acme-api"
   }
   ```

   Use barra normal (`/`) mesmo no Windows — funciona e evita problema de escape.

2. Em `.claude/settings.json`, liste os mesmos caminhos em `permissions.additionalDirectories`.
   É isso que autoriza o Claude Code a ler fora da pasta do projeto.

3. Confirme com `npm run doctor` — ele diz se cada caminho existe, se é um clone git e se a
   branch base está disponível.

Alternativa em tempo de execução, sem editar settings:

```bash
claude --add-dir C:/dev/acme/acme-web --add-dir C:/dev/acme/acme-api
```

## Por que não usar junction ou symlink

Dá para criar um link no Windows (`mklink /J repos\acme-web C:\dev\acme\acme-web`) e
ele não ocupa espaço. Mas as buscas do agente usam ripgrep, que **por padrão não segue
symlink nem junction** — a busca voltaria vazia e você levaria um tempo até descobrir por quê.
`additionalDirectories` não tem esse problema.

## Repositório grande: o que importa de verdade

O tamanho do clone quase não pesa, porque o agente **não varre a árvore inteira**. O fluxo é:

```bash
git diff --name-only origin/develop...origin/feature/TSK-12345   # 8 arquivos, não 40 mil
```

e só então ele lê esses arquivos — **por ref, não do disco**:

```bash
git show origin/feature/TSK-12345:src/views/Clientes.vue
```

O agente nunca faz checkout, então o disco e o `HEAD` são a branch que estiver ativa aqui, que
não tem relação com a tarefa em teste. Como efeito colateral bom: **você pode continuar
trabalhando normalmente no clone**, trocando de branch à vontade, sem interferir na análise
que o agente está rodando.

O que causa lentidão é busca ampla em pasta de build. A skill `analise-branch` já instrui a
partir sempre do diff, e a excluir `bin/`, `obj/`, `packages/`, `node_modules/`, `dist/`,
`.vs/`.

Se ainda quiser reduzir o escopo, aponte para a subpasta de código em vez da raiz:

```json
"repos": {
  "front": "C:/dev/acme/acme-web/src",
  "back":  "C:/dev/acme/acme-api/src"
}
```

O contra: comandos git precisam da raiz do repositório. Prefira apontar para a raiz e deixar
o agente filtrar — é o comportamento que as skills já assumem.
