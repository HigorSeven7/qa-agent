---
name: playwright-padrao
description: Padrão de automação Playwright + TypeScript do projeto — estrutura de arquivos, Page Object sobre BasePage (PrimeVue) ou a base do design system do produto, política de seletores, waits, autenticação por storageState, evidências e template de plano de teste. Use ao criar ou editar qualquer spec, page object ou fixture deste projeto.
---

# Padrão Playwright

Convenções obrigatórias deste projeto. Ao gerar ou editar teste, siga isto sem exceção.
`CLAUDE.md` é a fonte das regras gerais; esta skill é o "como escrever".

## Estrutura de arquivos

```
tarefas/<TAREFA>/alvo.json               ← { "cliente": ..., "sistema": ... } — sem isto a tarefa roda em qualquer alvo
tarefas/<TAREFA>/specs/<modulo>.spec.ts      ← cenários
tarefas/<TAREFA>/specs/<modulo>.api.spec.ts  ← cenários puramente de API (se houver)
tarefas/<TAREFA>/fixtures/<massa>.json       ← massa de dados (se data-driven)

tarefas/<TAREFA>/pages/<modulo>.page.ts ← Page Object que SÓ esta tarefa usa
pages/<sistema>/<modulo>.page.ts        ← Page Object reusado por mais de uma tarefa (um subdiretório por sistema)
                                          estende BasePage ou a base do produto — não duplique por tarefa;
                                          quando a 2ª tarefa precisar, suba de tarefas/<T>/pages/ com git mv
tarefas/<TAREFA>/scripts/               ← sonda, repro, massa, limpeza da tarefa — FORA do git
support/caminhos.ts                     ← onde mora cada arquivo de uma tarefa (nunca monte caminho na mão)
support/env.ts                          ← ambiente e credenciais (não alterar sem necessidade)
support/evidencias.ts                   ← coletor de evidência (não alterar sem necessidade)
support/auth.setup.ts                   ← login único por perfil
playwright.config.ts                    ← NÃO ALTERAR sem me avisar
```

`<modulo>` em kebab-case, sem acento: `clientes`, `ordem-coleta`, `nota-fiscal`.
`<TAREFA>` é o ID do card em maiúscula: `TSK-12345`.

Os specs ficam dois níveis abaixo da raiz, então o import de `support/` e `pages/`
é `../../../` (ex.: `../../../pages/acme/clientes.page`). O da massa é `../fixtures/` e o do
Page Object da própria tarefa é `../pages/` — as duas pastas são irmãs de `specs/`.

## Cliente, sistema e ambiente

```bash
CLIENTE=acme SISTEMA=crm npm test              # hmlg — evidência oficial
CLIENTE=acme SISTEMA=crm npm run test:local    # localhost — apoio, não oficial
CLIENTE=acme SISTEMA=crm npm run test:headed   # hmlg observando o navegador
CLIENTE=acme SISTEMA=crm npm run auth          # (re)gera o storageState
npm run doctor                                  # diagnostica todos os sistemas
npm run doctor -- acme crm                      # só um sistema
```

**Nunca** hardcode URL, usuário, senha ou caminho de repositório no spec.

- URL → `baseURL` do config (rotas relativas no Page Object)
- credencial → `credenciaisDe(perfil)` de `support/clientes.ts`
- storageState → `arquivoAuth(perfil)`
- repositório → `repoDe('front')`

O spec deve funcionar sem edição: o que muda são as variáveis `CLIENTE` e `SISTEMA`.
Se um sistema tiver comportamento diferente (campo que só existe nele), trate por condicional
explícita lendo `sistema.id` / `sistema.clienteId`, com comentário dizendo por quê — nunca
duplicando o spec inteiro.

## Seletores

Ordem: `getByTestId` → `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText`.

Proibido: classe CSS de build, `nth-child`, `data-v-*`, XPath posicional.
PrimeVue: `data-pc-section` / `data-pc-name`.

Todo seletor deve estar no `03-mapa-seletores.md` da tarefa, confirmado na tela e no código.

```typescript
// ❌ frágil
page.locator('.p-button.p-component.p-button-primary').nth(2)
page.locator('div > div > button')

// ✅
page.getByTestId('btn-salvar')
page.getByRole('button', { name: 'Salvar' })
page.getByRole('row', { name: /Cliente Teste/ }).getByRole('button', { name: 'Editar' })
```

## Waits

`page.waitForTimeout()` é **proibido**. Sem exceção, nem "só pra testar".

```typescript
// ❌
await page.click('#salvar')
await page.waitForTimeout(3000)
expect(await page.locator('.toast').isVisible()).toBe(true)

// ✅ — espera a API e usa asserção auto-retry
const resposta = await clientes.salvar()      // BasePage.acaoComApi por baixo
expect(resposta.status()).toBe(201)
await expect(clientes.toastSucesso).toBeVisible()
```

Interceptação com `page.waitForResponse()` sempre **antes** da ação, nunca depois —
senão a resposta já passou e o teste trava até o timeout.

## Page Object

### Escolha a base certa: `BasePage` ou a base do produto

Errar aqui não dá erro de compilação — dá teste que espera um toast que nunca vai existir.
Cada design system tem a sua marcação, e o Page Object herda os seletores da base que você escolher.

| Base | Quando | O que ela já resolve |
|---|---|---|
| `BasePage` (`pages/base.page.ts`) | **front Vue/PrimeVue** | `toastSucesso`/`toastErro` (`.p-toast-*`), `loader`, `mensagemErroCampo`, `aguardarCarregamento()`, `acaoComApi()`, `validarToastSucesso()` |
| `<Produto>Page` (`pages/<sistema>/<sistema>.page.ts`) | **outro design system** (DevExtreme, MUI, Angular Material…) — TODO(empresa): uma linha por base criada | toast, overlay de carregamento, combo, grid e máscara **daquele** componente |

A base do produto **estende** `BasePage`, então tudo de `BasePage` continua disponível — inclusive
`acaoComApi()`. O que muda é que os locators globais passam a apontar para a marcação certa.

> **Como saber qual é:** `config/clientes.json` → `sistemas.<id>.produto`.

Sintoma de ter escolhido errado: o Page Object herda `toastSucesso` apontando para `.p-toast-*`
numa tela de outro design system, `validarToastSucesso()` nunca acha nada, e alguém "resolve"
declarando o seletor do toast à mão no arquivo — e o mesmo seletor acaba repetido em vários
Page Objects. Crie a base do produto em vez disso.

**Componente que gera `id` a cada request** (ex.: DevExtreme gera `dx_dx-<guid>_<Campo>` no
`<input>`): ancore no `id` do **container**, nunca no do input. Os helpers da base do produto
devem fazer isso.

### Convenções

- Locators como `readonly` no construtor.
- Getter `rota` obrigatório.
- Ações compostas como métodos `async` com nome de intenção do usuário
  (`cadastrarCliente`, não `clicarBotaoESalvar`).
- Método que dispara API **retorna a resposta**, para o spec assertar o status.
- Page Object não contém `expect` de regra de negócio — só helpers de validação genéricos
  herdados. A asserção de negócio fica no spec, onde o cenário é legível.
- **`navegar()` de tela que se hidrata por AJAX espera a chamada, não o DOM.** Monte a
  interceptação **antes** do `goto` — depois já é tarde, a resposta passou e a espera trava até
  o timeout:

  ```typescript
  override async navegar() {
    const itens = await this.acaoComApi(
      async () => { await this.page.goto(this.rota, { waitUntil: 'domcontentloaded' }) },
      '/Order/GetOrderItemsByOrderId',
      'POST',
    )
    expect(itens.status(), 'a aba Itens não carregou').toBe(200)
    await this.aguardarCarregamento()
  }
  ```

  Esperar só o elemento aparecer (`expect(linha).toBeVisible()`) é o caminho para teste flaky:
  em homologação lenta o `expect` estoura antes do grid pintar, e o `retries: 1` esconde. Foi
  exatamente isso num cenário de exportação real. A base do produto pode cobrir o caso comum no `navegar()` dela.

## Spec

- `test.describe('[TSK-XXXXX] — <título>')`
- `test('CT0N — <cenário em português>')`
- `Evidencia` instanciada em cada teste, `ev.finalizar()` no fim
- Sem `page.` direto (exceto `waitForResponse`)
- Sem dependência de ordem entre testes: cada `test()` roda isolado
- Massa criada em hmlg leva sufixo único: `` `QA ${Date.now()}` ``
- Asserta persistência, não só o toast

## Data-driven

```typescript
import dados from '../../fixtures/clientes.json'

for (const caso of dados.invalidos) {
  test(`CT03 — rejeita ${caso.descricao}`, async ({ page }, testInfo) => {
    const ev = new Evidencia(TAREFA, `CT03-${caso.id}`, page, testInfo, {
      titulo: `Rejeita ${caso.descricao}`,
      criterios: ['CA03'],
      tipo: 'obrigatorio',
      esperado: `${caso.mensagem} exibida e nada gravado`,
    })
    // ...
  })
}
```

Loop com `for...of` no nível do describe. Não use `test.each` (não existe no Playwright).

## Evidência

**A ficha do cenário é obrigatória na construção**, e **todo print que sustenta uma asserção
leva marcação nomeada**. Campo vazio vira buraco no PDF; print de tela cheia sem indicação
obriga o leitor a caçar o que a legenda afirma — isso não é evidência.

```typescript
const ev = new Evidencia('TSK-12345', 'CT01', page, testInfo, {
  titulo: 'Cadastra cliente com dados válidos',
  criterios: ['CA01'],                  // constrói a matriz CA → CT. Nunca omita
  tipo: 'obrigatorio',                  // 'complementar' não reprova a tarefa
  precondicao: 'autenticado como Admin na filial Matriz',
  esperado: 'POST /Cliente/Salvar → 200, toast de sucesso e registro na listagem',
})

await ev.capturar('formulário preenchido', 'ok', [
  { alvo: tela.campoCnpj, nome: 'CNPJ' },
  { alvo: tela.botaoSalvar, nome: 'Salvar' },
])
await ev.passo('interceptou POST /Cliente/Salvar → 200')
ev.definir({ obtido: 'cliente 4711 gravado com FL_ATIVCLIE=1' })  // o que só se sabe rodando

await ev.falhar('toast de sucesso não apareceu', e, [{ alvo: tela.toastG2, nome: 'Toast' }])
ev.finalizar('aprovado')
```

| Campo da ficha | Para que serve |
|---|---|
| `titulo` | título do cenário no índice e na seção do PDF |
| `criterios` | `['CA01']` — a matriz CA → CT, prova de cobertura dos critérios de aceite |
| `tipo` | `obrigatorio` decide o veredito · `complementar` que falha vira achado |
| `precondicao` | estado exigido antes do cenário (perfil, filial, massa) |
| `esperado` | o que a entrega promete, escrito **antes** de rodar |
| `obtido` | o que aconteceu de fato — via `definir()`, quando souber |

Uma captura após cada asserção principal. Uma no momento exato de qualquer falha.
Nunca capture tela com senha, token ou dado real de cliente visível.

Cenário que estoura antes do `finalizar()` fica `inconclusivo` — nunca `aprovado`. Não force
`finalizar('aprovado')` num caminho que não executou asserção nenhuma: se faltou massa ou
pré-condição, feche com `ev.bloquear(motivo)` e `finalizar('bloqueado')`.

## Origem dos cenários — não existe cobertura mínima fixa

**O que testar vem dos critérios de aceite. Como testar vem do código.**

| Tipo | De onde nasce | ID | Conta para o veredito? |
|---|---|---|---|
| **Obrigatório** | um `CA0N` da **descrição** do card (refinamento técnico incluído), ou inferido do diff quando a descrição não traz nenhum | `CT0N` | **Sim** |
| **Complementar** | inventário de ações (`03b-inventario-acoes.md`) + risco do diff, com justificativa de 1 linha e estimativa | `CX0N` | **Não** — falha vira achado |

- Todo `CA0N` tem pelo menos um `CT`. Nenhum `CT` obrigatório nasce fora de um `CA0N`.
- A matriz CA → CT abre o `04-plano.md`.
- Complementar só vira spec depois do **OK do QA** no gate da etapa 6 do `/testar-tarefa`.
- Complementar que falha **nunca** reprova a tarefa por decisão do agente. A única porta é o
  **gate do achado** (gate do achado), respondido pelo QA.
- **Teto de 6 complementares por rodada**, e variações do mesmo elemento viram **um** cenário
  data-driven — nunca um por valor.

**A fonte principal dos complementares é o catálogo exploratório**, em
`references/catalogo-exploratorio.md`: variações conhecidas por tipo de elemento (`mascara`,
`botao-grava`, `numerico`, `data`, `texto-livre`, `selecao`, `grid`, `upload`, `endpoint`,
`navegacao`), aplicadas sobre a coluna `Tipo` do `03b-inventario-acoes.md`. É tabela de
consulta, não checklist.

A lista abaixo complementa o catálogo. Também é **inspiração**, nunca obrigação:

| Onde olhar | Quando costuma valer |
|---|---|
| Campo obrigatório vazio | há formulário novo |
| Formato / limite inválido | há validação nova |
| Duplicidade | há campo único |
| Permissão por perfil | a tarefa mexe em perfil |
| Contrato de API | o diff alterou endpoint |
| Regressão de vizinhança | o diff tocou código compartilhado |
| Ação do inventário sem cobertura | efeito colateral, ação destrutiva, endpoint sem UI |

## Referências desta skill

| Arquivo | Para quê |
|---|---|
| `references/template-tarefa.md` | template do `tarefas/<TAREFA>/contexto/04-plano.md` |
| `references/catalogo-exploratorio.md` | heurísticas por tipo de elemento, para propor os `CX0N` |
