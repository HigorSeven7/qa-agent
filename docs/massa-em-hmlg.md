# Massa e acessos deixados em homologação

Índice **append-only** de tudo que o agente de QA escreveu nos ambientes de homologação dos
clientes: acessos concedidos ao usuário de teste e registros criados ou alterados como massa.

É a única lista consolidada do que o robô deixou para trás. O detalhe de cada rodada fica em
`tarefas/<TAREFA>/contexto/04b-preparo-ambiente.md`; aqui fica o resumo de uma linha.

## Regras deste arquivo

- **Append-only.** O agente **acrescenta uma linha ao fim** de cada rodada em que escreveu no
  ambiente. Nunca reescreve o arquivo, nunca reordena, nunca remove linha — inclusive as suas
  próprias de rodadas passadas.
- Uma linha por rodada de QA, não por registro. O detalhe está no `04b-preparo-ambiente.md`.
- **Acesso concedido não é revertido** (regra do `CLAUDE.md` → "🧪 Preparo do ambiente"). A linha
  aqui é o registro de que o ambiente mudou de forma permanente.
- **Como identificar depois** é a coluna que mais importa: sem o prefixo, ninguém separa massa de
  teste de dado real do cliente. Prefixo padrão: `QA-<TAREFA>-<runId curto>`.
- Limpeza de massa antiga é decisão do QA, manual. O agente não apaga nada em ambiente de
  cliente por conta própria.

## Registro

| Data | Tarefa | Cliente / Sistema | Filial | O que foi criado ou concedido | Como identificar depois |
|---|---|---|---|---|---|
