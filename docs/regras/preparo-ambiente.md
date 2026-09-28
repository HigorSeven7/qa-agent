> Regra do projeto — parte de `CLAUDE.md`. Mesma força do arquivo principal.

## 🧪 Preparo do ambiente — acessos e massa

Muita coisa vira `BLOQUEADO` ou teste incompleto sem precisar: o usuário de teste não tem o
acesso que a tarefa exige, a tarefa descreve o comportamento usando dado de **produção** que não
existe em hmlg, um fluxo ou parâmetro não está configurado. Quase tudo isso o próprio QA
consegue resolver. Esta etapa roda **antes da exploração** e existe para isso.

Esta etapa se chama **Preparo do ambiente** — cite-a pelo nome, nunca pelo número. A ordem de
trabalho deste arquivo e as etapas do `/testar-tarefa` são duas numerações diferentes, e cada
lote novo desloca as duas. O que manda é a posição: depois de decidir o ambiente, antes de
abrir o navegador para explorar.

Tudo o que for preparado fica registrado em `tarefas/<TAREFA>/contexto/04b-preparo-ambiente.md` e ecoado
em `docs/massa-em-hmlg.md`. Ambiente de cliente que muda sem registro é dívida que ninguém
consegue cobrar depois.

### `BLOQUEADO` é último recurso, não primeira saída

> Antes de declarar `BLOQUEADO`, o agente é **obrigado** a tentar destravar o que está ao alcance
> dele em hmlg: configurar fluxo, parâmetro, cadastro básico, perfil, acesso, feature flag, e
> gerar a massa que falta. Cada tentativa e o resultado dela ficam registrados em
> `tarefas/<TAREFA>/contexto/04b-preparo-ambiente.md`.

| Destravável pelo agente (resolve e segue) | `BLOQUEADO` legítimo |
|---|---|
| acesso/permissão do usuário de teste | ambiente fora do ar / erro 5xx generalizado |
| massa inexistente, ou dado de produção citado na tarefa | integração de terceiro indisponível |
| fluxo, parâmetro ou cadastro básico não configurado | credencial inválida ou conta bloqueada |
| perfil de acesso, filial | VPN exigida e ausente (`requerVpn: true`) |
| feature flag em hmlg | banco marcado `db.producao: true` (trava intencional) |
| | a feature não subiu para hmlg |

Declarar `BLOQUEADO` exige dizer, no comentário, **o que foi tentado e por que não destravou**.
"Faltou massa" sem tentativa registrada não é `BLOQUEADO` — é trabalho não feito.

#### Raio de alcance — o que separa destravar de mexer no ambiente dos outros

Nem toda configuração custa o mesmo. Classifique **antes** de agir:

| Raio | Exemplos | O agente pode? |
|---|---|---|
| Só o usuário de teste | acesso, perfil, filial, preferência de tela | **sim**, sem perguntar |
| Registro novo, identificado com o prefixo `QA-` | cadastro, fluxo, proposta, pedido de teste | **sim**, sem perguntar |
| Alteração de registro **pré-existente** | inativar/reativar cadastro que já estava lá, editar fluxo em uso | **captura o estado antes, restaura depois** — e diz no comentário |
| Configuração **compartilhada ou global** | parâmetro do sistema, feature flag global, cadastro básico usado por outras telas, integração | **não** — para e me pergunta, sempre |

A regra é o **raio**, não a dificuldade. Configurar um parâmetro global é fácil, e é justamente o
que não pode: quebra o teste de outra pessoa no mesmo hmlg e some sem rastro.

#### A trava mais importante: não configure à mão o que o `CA0N` pedia que o sistema fizesse

Se o critério de aceite diz "ao criar o fluxo, o sistema deve gerar a etapa inicial" e o agente
cria a etapa na mão para destravar, ele acabou de produzir um `APROVADO` em cima do bug.

Antes de configurar qualquer coisa, responda **por escrito** no `04b-preparo-ambiente.md`:

> **Isto é pré-condição, ou é o comportamento sob teste?**

Se for o comportamento sob teste, **não configure** — é `REPROVADO` ou achado.

Mesma lógica para "a feature não subiu para hmlg": isso **nunca** se destrava. Continua sendo
achado, com a regra que já está na etapa "Decidir o ambiente" do `/testar-tarefa`.

#### Orçamento de tentativa

No máximo **3 tentativas** de destravar o mesmo obstáculo. Na terceira que falhar, pare, registre
o que fez e me pergunte — não fique meia hora girando. Se o destrave exigir mais de ~10 minutos
de setup, pare e me consulte **antes** de seguir.

### Acesso e permissão — vale para todos os sistemas

**Detectar (etapa 1, `qa-analista`).** Ao ler descrição, comentários e **todos** os anexos,
procure qualquer menção a acesso, permissão, claim, perfil, "liberar para o usuário", menu que
aparece ou some, tela que exige direito. **Print do dev mostrando um menu ou botão que o usuário
de teste não enxerga conta como menção.** Registre em `01-tarefa.md`, na seção
`## Acessos necessários`, com a fonte de cada um.

**Conceder.** Para cada acesso listado, conceda ao usuário de teste na tela de acessos do
sistema (TODO(empresa): caminho do menu, ex.: **Cadastros → Acessos do usuário**), antes de
explorar. Sem o acesso, o explorador mapeia
uma tela que não é a da tarefa e o mapa de seletores nasce errado.

**A concessão é sempre feita na filial `<FILIAL-DE-CONCESSÃO>`** (ver "Configuração da empresa" no `CLAUDE.md`) — sem exceção. Se o sistema não tem filial, ignore a parte de filial desta seção. A
execução dos cenários continua na filial que **eu informei** junto com a tarefa. São duas sessões
diferentes, logo **dois `storageState`**:

```bash
CLIENTE=<c> SISTEMA=<s> FILIAL="<FILIAL-DE-CONCESSÃO>" npm run auth              # sessão da concessão
CLIENTE=<c> SISTEMA=<s> FILIAL="<a que eu informei>" npm run auth     # sessão do teste
```

**Trocar de filial exige rodar `npm run auth` de novo.** O `storageState` leva a filial no nome;
sem regerar, a sessão anterior é reaproveitada **em silêncio** e a rodada mede a filial errada.

Se `<FILIAL-DE-CONCESSÃO>` não existir para aquele usuário/cliente, o erro do login lista as disponíveis:
**pare e me pergunte.** Não escolha outra por conta própria.

**Não reverter.** O acesso concedido **fica**. Registre em `04b-preparo-ambiente.md` — usuário,
acesso, filial, data/hora, print — e cite no comentário do ClickUp, para o time saber que o
ambiente mudou.

O print da tela de acessos com o direito concedido é evidência de **pré-condição** do cenário
(campo `precondicao` da ficha da `Evidencia`), **nunca** um CT.

### Massa quando a tarefa fala de dado de produção

ID, CNPJ, número de pedido e nome de cliente citados na tarefa servem para **entender o caso**,
nunca como massa. Nunca tente reproduzir o registro real em hmlg com os mesmos valores.

- **Gere massa nova e aleatória em hmlg** que satisfaça as **mesmas condições** que o dado de
  produção satisfazia — mesmo status, mesmo tipo, mesma combinação de flags —, suficiente para
  validar cada `CA0N` que dependia dele.
- **Aleatória e rastreável ao mesmo tempo:** prefixo fixo do projeto + carimbo do run
  (`QA-<TAREFA>-<runId curto>`); documentos gerados por `support/cnpj.ts`. Nunca CPF/CNPJ real,
  nunca nome de pessoa real.
- **Prefira criar registro novo a alterar um pré-existente.** Se precisar mesmo alterar um que já
  existia, capture o estado antes, restaure depois, e diga isso no comentário do ClickUp.
- **Nunca em base com `db.producao: true`** — a trava do `validarSelecao()` continua valendo e não
  se contorna.
- **Registre tudo** o que foi criado ou alterado em `04b-preparo-ambiente.md`: o quê, onde, com
  quais valores, e como identificar depois. Esse arquivo é a lista do que sobrou no ambiente do
  cliente.

A skill vendorizada `test-data-management` entra aqui como apoio, **subordinada** a esta regra.

### As quatro travas da geração de massa

| Trava | Regra |
|---|---|
| **Teto por rodada** | No máximo **20 registros** criados por tarefa. Passou disso, pare e me pergunte. Massa de teste não é carga. |
| **O que o agente nunca cria** | **usuário, empresa, filial, configuração de integração, parâmetro global do sistema.** Sobrevivem à tarefa e afetam todo mundo que usa aquele hmlg. Precisou de um desses → me pergunte. |
| **Nada de dado pessoal plausível** | Nome, e-mail e telefone **obviamente sintéticos**: `QA Teste <TAREFA>`, `qa-<tarefa>@exemplo.invalid`. Não gere nome brasileiro realista — em print de evidência ninguém distingue de cliente real. |
| **Eco antes da primeira escrita** | Imprima `CLIENTE / SISTEMA / FILIAL / baseURL` e confira contra o `01-tarefa.md` **antes** de criar qualquer coisa. Divergiu, pare. |

### `docs/massa-em-hmlg.md` — o índice do que ficou

Além do `04b-preparo-ambiente.md` de cada tarefa, mantenha `docs/massa-em-hmlg.md`: uma tabela
**append-only** com data, tarefa, cliente/sistema, filial, o que foi criado ou concedido e como
identificar depois (o prefixo). É a única lista de tudo que o robô deixou para trás nos ambientes
dos clientes.

O agente **acrescenta uma linha ao fim** de cada rodada em que escreveu no ambiente. Nunca
reescreve o arquivo, nunca reordena, nunca remove linha — inclusive as suas próprias de rodadas
passadas.

---

