> Regra do projeto — parte de `CLAUDE.md`. Mesma força do arquivo principal.

## 📸 Evidências

- Screenshots numeradas em `tarefas/MVF-XXXXX/evidencias/`, nomeadas `NN-ct0N-descricao.png`.
- **Quanto capturar depende do `tipo` do cenário.** Obrigatório é a evidência que o PO valida;
  complementar é apêndice, e apêndice de 40 páginas ninguém lê:

  | Cenário | Passou | Falhou |
  |---|---|---|
  | **Obrigatório** (`CT`, de um `CA0N`) | uma captura após **cada asserção principal** | + a captura no momento exato da falha |
  | **Complementar** (`CX`) | **1** — o estado final que sustenta a asserção | o print **antes** + o do momento da falha |
  | **Complementar cuja asserção compara com estado anterior** (duplicidade, contador, saldo) | **2** — o "antes", tirado **antes da ação**, e o final | idem |

  Três coisas que isso impede: complementar sem print nenhum (indistinguível de cenário que
  não rodou — o `qa-revisor` trata como falso verde); print "antes" tirado depois da ação
  (estado anterior não se fotografa retroativamente); e print "depois" reflexo, tirado só
  porque o cenário terminou — não responde a nenhuma objeção e só engorda o PDF.

  Variações agrupadas num `CX` data-driven geram **1 print** e o resto como passos `info`.
- No PDF, o `/evidencia` separa por `tipo`: obrigatórios no corpo principal com a matriz
  CA → CT; complementares que passaram num **apêndice** compacto; complementares que falharam
  numa seção **Achados**, explicitamente fora do veredito.
- **Todo print que sustenta uma asserção leva marcação com nome:**
  `ev.capturar('drawer aberto', 'ok', [{ alvo: campoData, nome: 'Data da entrega' }])`.
  A marcação vira uma caixa numerada no print e a mesma legenda numerada no PDF. Print de tela
  cheia sem indicação obriga o leitor a caçar o que a legenda afirma — isso não é evidência.
- **Preencha a ficha do cenário na construção da `Evidencia`:** `titulo`, `criterios`
  (`['CA01']`), `tipo` (`obrigatorio` / `complementar`), `precondicao`, `esperado` — e `obtido`
  via `definir()` quando souber. Cada campo vira uma linha do PDF; campo vazio vira buraco.
  `criterios` é o que constrói a matriz CA → CT, a prova de cobertura dos critérios de aceite.
- O resumo estruturado da execução vai em `tarefas/MVF-XXXXX/evidencias/resultado.json`
  (formato em `.claude/skills/captura-evidencia/SKILL.md`). **O PDF do `/evidencia` é montado
  inteiro a partir dele** — veredito, índice, matriz, seções por cenário e figuras. Corrigir
  texto de evidência significa corrigir o spec, não reescrever o documento na mão.
- Antes de capturar, verifique que não há dado sensível na tela (CPF/CNPJ real,
  senha, token). Se houver, mascare via CSS antes do print.

---

