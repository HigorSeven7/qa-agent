---
name: captura-evidencia
description: Captura evidencia DURANTE a execucao do teste — screenshots numeradas, passos e resultado.json em tarefas/<TAREFA>/evidencias/. Use ao escrever ou rodar specs Playwright. Para gerar o PDF final no padrão do projeto, use o comando /evidencia, que consome estes arquivos.
---

# Captura de evidência durante o teste

> **Divisão de responsabilidade — leia antes.**
>
> | Etapa | Quem faz | Saída |
> |---|---|---|
> | Capturar durante o teste | **esta skill** + `support/evidencias.ts` | `tarefas/<TAREFA>/evidencias/*.png` e `resultado.json` |
> | Gerar o PDF de evidência e anexar no ClickUp | comando **`/evidencia`** | PDF com capa, anexado na tarefa `QA0N-` da rodada atual |
>
> Esta skill **não** gera PDF, HTML, capa ou template. Isso é do `/evidencia`, que roda o
> script Python oficial. Nunca improvise um PDF aqui.
>
> O contrato entre as duas é o `resultado.json`: se ele estiver completo e correto,
> o `/evidencia` monta o documento sozinho.


# Evidência de QA

> O gerador oficial (`/evidencia`) está instalado em `.claude/commands/evidencia.md`.
> Esta skill documenta o **contrato do `resultado.json`** — o insumo que ele consome — e a
> disciplina de captura durante o teste. A seção "Fallback" só serve se o `/evidencia` falhar
> por motivo de ambiente (Python/Edge ausentes); nesse caso, resolva o ambiente e rode o
> comando, não monte o documento à mão.

## Insumos gerados automaticamente pelo projeto

```
tarefas/<TAREFA>/evidencias/
├── resultado.json                        ← contrato abaixo (consolidado — leia este)
├── _cenarios/CT01.json                   ← parcial por cenário (não precisa ler)
├── _cenarios/CT02.json
├── 01-ct01-formulario-aberto.png
├── 02-ct01-formulario-preenchido.png
└── 03-ct02-falha-toast-nao-apareceu.png

tarefas/<TAREFA>/contexto/
├── 01-tarefa.md            ← briefing do ClickUp
├── 02-codigo.md            ← análise da branch
├── 03-mapa-seletores.md    ← seletores confirmados
└── 04-plano.md             ← plano de teste
```

## Contrato do `resultado.json`

Produzido por `support/evidencias.ts` (classe `Evidencia`).

```json
{
  "tarefa": "TSK-12345",
  "cliente": "Acme",
  "sistema": "Acme CRM",
  "alvo": "Acme / Acme CRM",
  "ambiente": "hmlg",
  "baseURL": "https://hmlg.sistema.com.br",
  "evidenciaOficial": true,
  "branch": "main",
  "commit": "4a47be9",
  "runId": "2026-08-17T17:30:00.000Z",
  "inicio": "2026-08-17T17:30:00.000Z",
  "fim": "2026-08-17T17:33:12.000Z",
  "cenarios": [
    {
      "cenario": "CT01",
      "titulo": "Cadastra cliente com dados válidos",
      "status": "aprovado",
      "runId": "2026-08-17T17:30:00.000Z",
      "desteRun": true,
      "tipo": "obrigatorio",
      "criterios": ["CA01"],
      "precondicao": "autenticado como Admin na filial Matriz",
      "esperado": "POST /Cliente/Salvar → 200, toast de sucesso e registro na listagem",
      "obtido": "cliente 4711 gravado com FL_ATIVCLIE=1 e visível no grid",
      "passos": [
        {
          "ordem": 1,
          "descricao": "formulário preenchido",
          "status": "ok",
          "arquivo": "01-ct01-formulario-preenchido.png",
          "marcacoes": [
            { "numero": 1, "nome": "CNPJ" },
            { "numero": 2, "nome": "Salvar" }
          ],
          "horario": "2026-08-17T17:30:04.120Z"
        },
        {
          "ordem": 2,
          "descricao": "interceptou POST /Cliente/Salvar → 200",
          "status": "info",
          "horario": "2026-08-17T17:30:06.400Z"
        }
      ]
    }
  ]
}
```

**Cabeçalho da execução:**

| Campo | Valores | Observação |
|---|---|---|
| `tarefa` · `cliente` · `sistema` · `alvo` | texto | `alvo` é `"<cliente> / <sistema>"`, preenchido pelo catálogo |
| `ambiente` | `hmlg` · `local` | |
| `evidenciaOficial` | `true` / `false` | `false` quando `ambiente != hmlg`. Evidência não oficial **não aprova tarefa** |
| `branch` · `commit` | texto ou ausente | ref **deste repositório de QA**, não do sistema testado. Leitura best-effort: some sem aviso se o `git` falhar |
| `runId` | ISO 8601 | carimbo desta execução. Todo cenário com este `runId` rodou agora |
| `cenariosDeOutraExecucao` | `["CT07"]` ou ausente | **leia sempre.** Cenários que sobraram de uma rodada anterior em `_cenarios/` — CT renomeado ou removido do spec deixa o status antigo para trás, inclusive `aprovado`. A consolidação não apaga (re-rodar um CT sozinho é fluxo normal), ela marca. **Nunca publique um cenário desta lista como resultado da rodada atual** |
| `inicio` · `fim` | ISO 8601 | `inicio` é preservado entre consolidações |

**Ficha do cenário** — preenchida na construção da `Evidencia`, e é ela que o PDF vira linha a
linha. Campo vazio vira buraco no documento:

| Campo | Valores | Observação |
|---|---|---|
| `cenario` | `CT01` | ID do cenário |
| `desteRun` | `true` / `false` | `false` = parcial de rodada anterior. Ver `cenariosDeOutraExecucao` acima |
| `titulo` | texto | título no índice e na seção do PDF |
| `status` | `aprovado` · `reprovado` · `bloqueado` · **`inconclusivo`** | `inconclusivo` é o **estado inicial**: um cenário que estourou antes do `finalizar()` fica aqui. **Nunca publique APROVADO para cenário `inconclusivo`.** Cenário que já falhou ou foi bloqueado não volta para aprovado |
| `tipo` | `obrigatorio` · `complementar` | `obrigatorio` nasce de critério de aceite e **decide o veredito**; `complementar` que falha vira achado — vira `REPROVADO` só se o QA responder `reprova` no gate do achado (gate do achado) |
| `criterios` | `["CA01","CA03"]` | os critérios de aceite que o cenário cobre. **É o que constrói a matriz CA → CT**, a prova de cobertura. Cenário obrigatório sem `criterios` não tem como ser rastreado até o card |
| `precondicao` | texto | estado exigido antes do cenário (perfil, filial, massa) |
| `esperado` | texto | o que a entrega promete, escrito **antes** de rodar |
| `obtido` | texto | o que aconteceu de fato — via `ev.definir({ obtido })` |

**Passos:**

| Campo | Valores | Observação |
|---|---|---|
| `passos[].status` | `ok` · `falha` · `info` | `info` = passo sem screenshot |
| `passos[].arquivo` | nome do PNG | ausente em passos sem print |
| `passos[].marcacoes` | `[{ numero, nome }]` | as caixas numeradas desenhadas no print. Viram a legenda numerada no PDF. **Ausente = print de tela cheia sem indicação**, que não sustenta asserção |
| `passos[].observacao` | texto | em falhas, carrega a mensagem de erro (até 2000 caracteres) |

> Este contrato espelha as interfaces `OpcoesCenario`, `ResultadoCenario`, `ResultadoTarefa`,
> `PassoEvidencia` e `MarcacaoRegistrada` de `support/evidencias.ts`. Se divergir, vale o código.

## Política de captura — quantos prints por cenário

`tipo` não é só rótulo no PDF: ele decide **quanto** se captura. Obrigatório é a evidência que
o PO valida; complementar é apêndice, e apêndice que ocupa 40 páginas ninguém lê.

| `tipo` | Resultado | Prints | Onde o `/evidencia` põe |
|---|---|---|---|
| `obrigatorio` | qualquer | um por **asserção principal**, com `marcacoes` nomeadas; mais o do momento da falha, se falhar | corpo principal, seção por cenário |
| `complementar` | passou | **1** — o estado final que sustenta a asserção | apêndice "Cenários complementares" |
| `complementar` | passou, e a asserção **compara com estado anterior** (duplicidade, contador, saldo) | **2** — o "antes", capturado **antes da ação**, e o final | idem |
| `complementar` | falhou | o "antes" + o do **momento da falha** (`ev.falhar()`). "Depois" **só** se houver efeito tardio: registro que só aparece no F5, saldo que recalcula | seção **Achados** |

Três coisas que essa tabela quer impedir:

- **Complementar sem print nenhum.** É indistinguível de complementar que não rodou. O
  `qa-revisor` trata como falso verde.
- **Print "antes" tirado depois.** Estado anterior não se fotografa retroativamente — por isso
  ele é capturado antes da ação, e não dentro do `catch`.
- **Print "depois" reflexo**, tirado só porque o cenário acabou. Não responde a nenhuma
  objeção; só engorda o PDF.

Variações agrupadas (seis CNPJs inválidos num `CX` data-driven) geram **1 print** e o resto
como passos `'info'` via `ev.passo()` — a tabela de valores fica no `resultado.json`, não em
seis imagens.

> **`status: 'reprovado'` num cenário `complementar` não reprova a tarefa.** Ele só marca o
> cenário. Complementar que falha vira `Achado`; só o gate da gate do achado do `/testar-tarefa`,
> respondido pelo QA, transforma isso em `REPROVADO`.

## Fallback — montar `evidencia.md`

Se nenhuma skill de evidência estiver disponível, gere
`tarefas/<TAREFA>/evidencias/evidencia.md` neste formato:

```markdown
# Evidência de Teste — TSK-12345

| | |
|---|---|
| **Tarefa** | TSK-12345 — <título> · [link] |
| **Tarefa de QA** | QA0N-<título> · [link] · rodada <N> |
| **Cliente** | Acme |
| **Ambiente** | hmlg — https://hmlg.sistema.com.br |
| **Branch** | feature/TSK-12345 @ a1b2c3d |
| **Executado em** | 17/08/2026 14:30 — 14:33 |
| **Resultado** | ✅ APROVADO (5/6) · ❌ 1 reprovado |
| **Evidência oficial de homologação** | Sim |

## Resumo

| CT | Cenário | Tipo | Resultado |
|---|---|---|---|
| CT01 | Cadastra cliente com dados válidos | Happy path | ✅ |
| CT03 | Rejeita CNPJ duplicado | Negativo | ❌ |

---

## CT01 — Cadastra cliente com dados válidos ✅

**Pré-condição:** usuário autenticado como Admin
**Resultado esperado:** `POST /api/clientes` → `201`; toast de sucesso; registro na listagem

### Passo 1 — Formulário aberto
![](01-ct01-formulario-aberto.png)

### Passo 2 — Interceptou `POST /api/clientes` → `201`

### Passo 3 — Registro salvo e visível na listagem
![](03-ct01-registro-salvo.png)

---

## CT03 — Rejeita CNPJ duplicado ❌

**Esperado:** erro `"CNPJ já cadastrado"`
**Obtido:** registro salvo com toast de sucesso; dois registros com o mesmo CNPJ
**Reproduzido manualmente:** sim

### Falha
![](05-ct03-cnpj-duplicado-aceito.png)

```
Error: expect(locator).toBeVisible() failed
Locator: locator('.p-error').filter({ hasText: /já cadastrado/i })
Timeout: 10000ms
```

---

## Achados

1. **CT03 — CNPJ duplicado aceito** — passos de reprodução, esperado, obtido, print.

## Observações de testabilidade

- ...
```

Se `evidenciaOficial` for `false`, inclua um aviso em destaque no topo:

> ⚠️ Executado em `localhost` (branch local), **não** em homologação. Esta evidência é
> parcial e não substitui a validação em hmlg.

## Antes de anexar — confira

- [ ] Toda screenshot referenciada existe no diretório
- [ ] Todo cenário do plano aparece no documento
- [ ] Nenhum print mostra senha, token, CPF/CNPJ real ou dado de cliente
- [ ] Falha tem print **e** mensagem de erro **e** confirmação de reprodução manual
- [ ] O documento diz claramente o ambiente e se a evidência é oficial
