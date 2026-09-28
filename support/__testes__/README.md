# Testes unitários de `support/`

```bash
npm run test:unit
```

## Por que existem

`support/` decide o resultado do QA: monta a planilha da carga, lê a planilha que o sistema
gerou, interpreta o relatório do banco, compara número de tela com número de Excel e monta o
`resultado.json` que vira o PDF de evidência.

Bug aqui **não faz o teste falhar**. Faz a evidência sair errada em silêncio — e ninguém percebe,
porque não existe uma segunda fonte para conferir. Foi por isso que estes testes nasceram:
quatro defeitos desse tipo foram encontrados na auditoria de 2026-08-31
(`docs/melhorias/diagnostico-2026-08-31.md`, achados 01, 02, 03 e 05).

## Por que não roda no `playwright test`

O `playwright.config.ts` chama `validarSelecao()` no import e o projeto `chromium` depende do
projeto `setup`. Qualquer `playwright test` exige, antes da primeira linha: `CLIENTE`, `SISTEMA`,
`baseURL` válido, credencial no `.env` e um login real contra homologação.

Um teste de `normalizarNumero` não precisa de nada disso — e amarrá-lo ao ambiente significa que
ele para de rodar exatamente quando o ambiente cai, que é quando mais se precisa saber se o erro
é do sistema ou da ferramenta.

Runner: `node:test` + `node:assert` (nativos), executados por `tsx`. Nenhuma dependência nova.

## Regra ao escrever teste aqui

Se um teste novo reprovar o código atual, **não afrouxe o teste**. Leve o caso e o valor esperado
para o humano decidir. Teste ajustado ao código não protege nada.

## Convenções

- Arquivo `*.test.ts` nesta pasta — é o padrão que o runner do Node descobre sozinho.
- Nada de rede, banco, navegador ou `.env`. Arquivo temporário só via `fs.mkdtempSync(os.tmpdir())`.
- Nome do teste em português, descrevendo o comportamento, não a função.
