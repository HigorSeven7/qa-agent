---
description: Só a análise — lê a tarefa, o código e devolve o plano de teste, sem executar nada
argument-hint: <link ou ID da tarefa do dev>
allowed-tools: Read, Write, Glob, Grep, Bash, Task, Skill, mcp__claude_ai_ClickUp__*
---

# Análise de tarefa (sem execução) — $ARGUMENTS

Rode **apenas as etapas 1, 2 e 5** de `/testar-tarefa`:

1. Coletar contexto do ClickUp (descrição + todos os comentários + todos os anexos) e
   **extrair os critérios de aceite (`CA0N`) da descrição**, com a fonte de cada um
   (`[descrição]` / `[refinamento técnico]`). Comentário e anexo são contexto — nunca critério.
2. Analisar a branch e o diff via skill `analise-branch`. Se a descrição não trouxe critério,
   é aqui que os `CA0N` nascem, marcados `[inferido do diff]`.
3. Produzir o plano de teste em `tarefas/<TAREFA>/contexto/04-plano.md`, com a **matriz CA → CT** no
   topo: todo `CA0N` com pelo menos um cenário obrigatório, nenhum obrigatório fora dos CAs.

Sem a etapa 4, você não tem o `03b-inventario-acoes.md`. Então os **complementares** aqui são
propostas derivadas só do diff — marque-as como tal, com justificativa de uma linha e
estimativa, e diga que precisam do inventário para serem confirmadas.

**Não** faça: exploração no navegador, geração de spec, execução, nem qualquer escrita no
ClickUp. Este comando é **100% leitura**: nem comentário, nem anexo, nem nada.

> Na esteira completa (`/testar-tarefa`) o agente escreve exatamente duas coisas no ClickUp —
> comentário nas duas tarefas e anexo da evidência na tarefa de QA. Aqui, nem isso: o
> resultado da análise fica só no `tarefas/<TAREFA>/contexto/` e na resposta para mim. Coluna e criação de
> tarefa são sempre manuais, minhas, em qualquer comando.

Use quando: a tarefa ainda não subiu para hmlg, você quer dimensionar o esforço antes de
começar, ou quer discutir a cobertura comigo antes de automatizar.

No final, me mostre:

- Resumo do que foi implementado (em 3 linhas)
- Os `CA0N` extraídos, com a fonte de cada um — e, se foram inferidos do diff, isso na
  primeira linha
- A matriz CA → CT: cenários obrigatórios (`CT0N`, um por CA) e complementares propostos
  (`CX0N`, com justificativa e estimativa) claramente separados
- Riscos e pontos de atenção
- O que está faltando na tarefa (informação ausente que você teve que inferir do código)
- Se dá para automatizar tudo ou se algum cenário exige teste manual — e por quê
