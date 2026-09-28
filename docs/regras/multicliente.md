> Regra do projeto — parte de `CLAUDE.md`. Mesma força do arquivo principal.

## 🏢 Multi-cliente e multi-sistema

O alvo de um teste nunca é só "o cliente" — é um par **cliente + sistema**. Um cliente pode ter
vários sistemas (ex.: `acme` com `crm`, `portal` e `api`), e cada um tem URL, credencial e
repositório próprios. Empresa de produto único usa um cliente só, com N sistemas.

**Nunca chute entre sistemas do mesmo cliente.** Dois sistemas parecidos (`crm-a` e `crm-b`) são aplicações
diferentes; errar entre eles produz um teste que passa validando a coisa errada. Se a tarefa
não deixa claro, pergunte.

| Onde | O que | Você pode ler? |
|---|---|---|
| `config/clientes.json` | URLs por ambiente, hosts de banco, caminhos dos repos, perfis, aliases | **Sim** |
| `.env` | usuário e senha por cliente/sistema/perfil, token do ClickUp | **Não** — bloqueado em `.claude/settings.json` |

Seleção em tempo de execução:

```bash
CLIENTE=acme SISTEMA=crm npm test              # em hmlg
CLIENTE=acme SISTEMA=crm npm run test:local    # em localhost
CLIENTE=acme SISTEMA=crm npm run auth          # gera o storageState
npm run doctor                                 # diagnostica tudo
npm run doctor -- acme crm                     # diagnostica só um sistema
```

### Modo acompanhamento (`ACOMPANHAR=1`) — observação, nunca evidência

Para assistir ao run em tempo real: abre o navegador (headed), põe uma pausa entre as
ações e desenha um cursor falso, já que o Playwright move um mouse virtual e o navegador
não desenha ponteiro nenhum sozinho.

```bash
CLIENTE=acme SISTEMA=crm npm run acompanhar         # hmlg, headed, 400ms por ação
CLIENTE=acme SISTEMA=crm npm run acompanhar:local   # o mesmo em localhost
ACOMPANHAR=900 CLIENTE=acme SISTEMA=crm npm test    # ritmo mais lento
```

**Nunca ligue no run que gera a evidência oficial.** O `slowMo` muda o timing e pode
mascarar race condition; o cursor falso entra nos screenshots e no vídeo. Desligado — o
default — não altera absolutamente nada da execução.

Para isso funcionar, todo spec importa `test`/`expect` de `support/teste`, **nunca** de
`@playwright/test` — é lá que mora a fixture que injeta o cursor.

### Travas de segurança — não contorne

- **Banco de produção:** um sistema com `db.producao: true` em `config/clientes.json` é
  **bloqueado** por `validarSelecao()`. Isso não é bug de config: é o catálogo de ambientes
  apontando para uma base de produção. Avise e pare. Nunca remova a flag para "destravar".
- **`requerVpn: true`:** falha de conexão nesses sistemas quase sempre é VPN desligada, não
  bug do sistema. Diga isso em vez de reportar bug.
- **`avisos`:** cada sistema pode trazer avisos no catálogo (sem credencial, roda em localhost).
  Leia antes de concluir que algo está quebrado.

### Identificar o cliente da tarefa — faça isso na etapa 1

Antes de qualquer coisa, descubra a qual cliente a tarefa pertence, nesta ordem:

1. **Custom field** da tarefa (cliente / projeto / sistema).
2. **Space / folder / lista** onde a tarefa está no ClickUp.
3. **Aliases** em `config/clientes.json` (`clientes.<id>.clickup.aliases`) casando com o
   título, a descrição ou o nome do repositório citado.
4. **Pergunte a mim.** Não adivinhe — nem o cliente, nem o sistema.

Testar a tarefa do cliente A contra o ambiente do cliente B produz um resultado sem sentido —
e, pior, pode criar massa de teste no ambiente errado. Confirme antes de navegar.

Registre **cliente e sistema** em `tarefas/<TAREFA>/contexto/01-tarefa.md` e use os dois em todos os
comandos daí em diante (`CLIENTE=<c> SISTEMA=<s> npm test`).

### Credenciais

Nunca leia, imprima, ecoe ou peça o conteúdo do `.env`. As credenciais chegam ao teste apenas
via `credenciaisDe(perfil)` de `support/clientes.ts`, em tempo de execução.

Se faltar credencial, o erro já diz o nome exato da variável a definir — repasse esse nome
para mim e siga em frente; não tente contornar.

### Filial — eu informo, você nunca adivinha

Vale para sistema cujo login tem **dois passos**: usuário e senha, e depois a seleção de uma
**filial** (ou empresa, unidade, tenant). A sessão fica presa à filial escolhida. Quais produtos
pedem filial: `PRODUTOS_COM_FILIAL` em `support/clientes.ts` (TODO(empresa)). Se nenhum sistema
da empresa tem filial, esta seção não se aplica.

**Eu informo a filial junto com a tarefa, em toda tarefa que usa sistema com filial.** Se a tarefa
não disser qual é, **pergunte** — não use a do catálogo por conveniência, e não use a que a
tela traz pré-selecionada.

Testar na filial errada é o mesmo erro que testar no cliente errado: o teste passa validando
a operação errada. É falso verde, e é o tipo de coisa que o `qa-revisor` existe para caçar.

```bash
CLIENTE=acme SISTEMA=crm FILIAL="Matriz" npm run auth   # sobrepõe o padrão
CLIENTE=acme SISTEMA=crm FILIAL="Matriz" npm test
```

- O valor em `config/clientes.json` → `sistemas.<id>.filial` é só o **padrão de fallback**.
- O `storageState` leva a filial no nome (`acme-crm-admin-matriz.json`). Trocar de
  filial **exige** rodar `npm run auth` de novo — sem isso você reaproveita a sessão da filial
  anterior sem perceber.
- Se a filial informada não existir para aquele usuário, o erro lista as disponíveis.

### Sistemas já mapeados

O que já foi confirmado no código, para não redescobrir a cada tarefa. Uma linha por sistema;
acrescente conforme for aprendendo.

| Cliente / sistema | Projeto no repo | Observações |
|---|---|---|
| `<cliente>` / `<sistema>` | `<pasta do projeto no repo>` | TODO(empresa): título da tela, host de hmlg, passos do login, branch base, particularidade de autenticação (AD, SSO, MFA). |

Para cada tela de login mapeada, registre aqui os seletores confirmados e como sincronizar
(ex.: "login é POST AJAX em `Account/Login`; sincronize por `waitForResponse`, nunca por
navegação").

---

