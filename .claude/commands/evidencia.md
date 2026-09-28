---
name: evidencia
description: Gera PDF de evidencia de QA (teste e validacao) no padrão do projeto. Usa o contexto da conversa atual como base. Use /evidencia ou /evidencia [imagem1] [imagem2]...
argument-hint: "[imagem1.png] [imagem2.png] ...  (ou sem argumentos)"
---

> **Integracao com a esteira de QA deste projeto**
>
> Quando esta tarefa passou por `/testar-tarefa`, NAO reinvente o conteudo: leia primeiro
> `tarefas/<TAREFA>/evidencias/resultado.json` e `tarefas/<TAREFA>/contexto/`. Eles ja tem cliente, sistema,
> ambiente, baseURL, cenarios (CT01, CT02...), passos, status e os caminhos das screenshots.
>
> - `--imagens` = todos os `.png` de `tarefas/<TAREFA>/evidencias/`, em ordem alfabetica (ja vem numerada).
> - `--cliente` e `--projeto` = campos `cliente` e `sistema` do `resultado.json`.
> - Se `resultado.json` tiver `"evidenciaOficial": false`, a execucao foi em localhost:
>   escreva isso em destaque no corpo da evidencia. Evidencia de localhost nao vale como
>   aprovacao de homologacao.
> - O anexo vai na **tarefa de QA** da rodada atual (`QA0N-...`), nao na tarefa do dev
>   nem numa rodada anterior ja reprovada.

# Gerador de Evidencia - padrão do projeto

Voce vai gerar um documento PDF de evidencia de teste de qualidade (QA) no padrao visual do projeto.

**A evidencia e gerada com base no que foi desenvolvido/validado NESTA CONVERSA.** Voce ja tem o contexto completo do que foi feito.

## REGRA CRITICA - PERSPECTIVA DE QA

A evidencia e escrita da **otica de QA, nao de desenvolvedor**. Isso vale para TODA evidencia, em qualquer projeto ou pasta.

- O foco e **o que foi validado e qual foi o resultado**, nao "o que eu implementei".
- Escrever no registro de quem **testou e comprovou** o comportamento, nao de quem codou.
- O campo de identificacao no topo do documento e **QA:** (nunca "Desenvolvedor:").
- Toda evidencia precisa deixar claro: **cenario testado → como foi testado → resultado obtido (esperado x obtido)**.
- Detalhes de implementacao (arquivos, codigo) existem apenas como **contexto de suporte** na modalidade Tecnica, nunca como o corpo principal da evidencia.

## Input recebido
$ARGUMENTS

---

## Passo 0 - Garantir infraestrutura (auto-setup)

Antes de tudo, verificar Python, script e capa. **Criar/instalar automaticamente o que faltar.**

**IMPORTANTE: Todos os comandos bash do Passo 0 devem ser executados SEQUENCIALMENTE (um por vez). NUNCA rodar comandos em paralelo neste passo.** Se um comando falhar, resolver antes de ir para o proximo.

**IMPORTANTE: Minimizar uso de bash.** Preferir ferramentas nativas do Claude Code (Glob, Read, Write) sempre que possivel. Usar bash SOMENTE quando necessario (verificar python, rodar python, rodar git).

### 0.1 - Python (OBRIGATORIO)

**Um comando por vez**, nesta ordem, parando no primeiro que funcionar:

```bash
python --version 2>/dev/null && echo "PYTHON_OK" || echo "PYTHON_MISSING"
```
```bash
py -3 --version 2>/dev/null && echo "PY3_OK" || echo "PY3_MISSING"
```

Guarde o comando que funcionou (`python` ou `py -3`) como `{PYTHON_CMD}` para o Passo 5.2.

Se os dois falharem, instale e descubra o caminho:

```bash
winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements 2>&1
```
```bash
PYTHON_EXE="$(find "$LOCALAPPDATA/Programs/Python" -maxdepth 2 -name "python.exe" 2>/dev/null | sort -V | tail -1)" && echo "$PYTHON_EXE"
```

`{PYTHON_CMD}` passa a ser esse caminho completo — apos o winget o `python` pode nao estar no
PATH da sessao. Sem `winget` (Windows Server):

```bash
curl -Lo /tmp/python-installer.exe "https://www.python.org/ftp/python/3.12.9/python-3.12.9-amd64.exe" && /tmp/python-installer.exe /quiet InstallAllUsers=0 PrependPath=1
```
### 0.2 - Script Python

Verificar se `.claude/scripts/gerar-evidencia.py` existe usando a ferramenta **Glob** (NAO usar bash/ls):

```
Glob: .claude/scripts/gerar-evidencia.py
```

**Se o arquivo NAO existir**: restaure a versao versionada — ver "Se o script Python nao existir"
no fim deste documento. **Nao escreva o script de cabeca.**

**Se o arquivo EXISTIR**: leia (tool Read) e confira se o template HTML usa o rotulo `QA:`.
- Se encontrar `Desenvolvedor:` (versao antiga), restaure pelo mesmo caminho acima — a versao do
  git ja esta no padrao QA.
- Se ja usar `QA:`, siga em frente sem alterar nada.

### 0.3 - Capa

**Nao precisa verificar manualmente.** O script `gerar-evidencia.py` cuida disso automaticamente:
1. Tenta ler a capa em `.claude/skills/captura-evidencia/cover.jpg` (ou `cover.png`)
2. Se nao achar, tenta `.claude/templates/` (jpg, png ou b64)
3. Sem capa, gera o PDF **sem a pagina de capa** e avisa no stderr

TODO(empresa): coloque a capa da empresa em `.claude/skills/captura-evidencia/cover.jpg` e o
nome da empresa na constante `EMPRESA` do script (vai no rodape).

**Simplesmente siga em frente. O script resolve.**

---

## Passo 1 - Interpretar o input

O usuario pode chamar o comando de varias formas:

1. `/evidencia` (sem argumentos) → gerar evidencia a partir do contexto da conversa
2. `/evidencia imagem1.png imagem2.png` → gerar evidencia + incluir essas imagens
3. `/evidencia C:\caminho\para\imagem.png` → gerar evidencia + incluir essa imagem

### Tratar imagens do input:
- Se $ARGUMENTS contiver caminhos de arquivo (`.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.webp`): guardar a lista de imagens para incluir na evidencia
- Se $ARGUMENTS estiver vazio ou nao contiver imagens: seguir para o Passo 2

### Imagens coladas na conversa:
- Se durante a conversa o usuario colou/anexou imagens diretamente no chat (clipboard paste, drag-and-drop),
  essas imagens JA ESTAO no contexto da conversa como conteudo visual.
- **Voce DEVE incluir essas imagens na evidencia.** Para cada imagem colada:
  1. Verificar se o usuario mencionou um caminho de arquivo temporario associado (ex: `/tmp/...`, `AppData/Local/Temp/...`)
  2. Se houver caminho: passar como argumento `--imagens` para o script
  3. Se nao houver caminho mas a imagem esta visivel no contexto: descrever o conteudo da imagem detalhadamente
     na evidencia como texto (o que mostra o print: tela, erro, dados, etc.)
- **Imagens coladas contam como imagens fornecidas** — nao perguntar se quer adicionar mais se ja vieram coladas.

---

## Passo 2 - Perguntar sobre imagens (so se nao vieram no input NEM coladas na conversa)

Se o usuario NAO passou imagens no input E nao colou imagens na conversa, faca UMA pergunta simples:

Use AskUserQuestion com:
- Opcao 1: "Sem imagens" → seguir so com texto
- Opcao 2: "Quero adicionar" → usuario digita os caminhos ou cola as imagens

**Se o usuario passou imagens no input OU colou imagens na conversa, NAO pergunte. Siga direto.**

---

## Passo 3 - Coletar metadados (so perguntar o que nao souber)

Todos os campos abaixo sao obrigatorios no documento final.
Infira o maximo possivel e so pergunte o que realmente faltar.

| Campo | Como inferir | Quando perguntar |
|-------|-------------|------------------|
| **Nome da tarefa** | Contexto da conversa (o que foi desenvolvido), branch git, input do usuario | Se nao da pra saber de jeito nenhum |
| **ID ClickUp** | Branch git (`CU-XXXXX` ou custom ID), input do usuario, contexto da conversa | Se nao tem ID em lugar nenhum |
| **QA** (responsavel pela validacao) | `git config user.name`, usuario Windows, contexto | Se nao conseguir inferir |
| **Cliente** | `tarefas/<TAREFA>/evidencias/resultado.json` → `cliente`; senao `tarefas/<TAREFA>/contexto/01-tarefa.md`; senao CLAUDE.md | Se nao conseguir inferir com certeza |
| **Projeto** | `tarefas/<TAREFA>/evidencias/resultado.json` → `sistema` (o sistema testado, ex.: "Acme CRM") | Se nao conseguir inferir com certeza |
| **Ambiente** | `resultado.json` → `ambiente` + `baseURL`. Registrar no corpo da evidencia. | Nunca — se faltar, diga que nao foi possivel confirmar |

### Regras:
- Rodar `git config user.name` e `git branch --show-current` em **um unico comando bash** (encadeados com `&&`), para evitar multiplas inicializacoes do bash:
  ```bash
  git config user.name && git branch --show-current
  ```
- Branch `fix/CU-abc123-descricao` ou `feature/CU-abc123` → ID ClickUp = abc123
- **NUNCA assumir cliente ou projeto por default.** Se o CLAUDE.md do projeto nao informar explicitamente, PERGUNTAR ao dev.
- **Se conseguiu inferir tudo, segue em frente sem perguntar nada.**
- **Se falta algo, pergunte APENAS o que falta, tudo numa unica AskUserQuestion.**

---

## Passo 3.5 - Perguntar nivel de detalhe

**SEMPRE perguntar antes de gerar o conteudo:**

Use AskUserQuestion com:
- Opcao 1: "Resumida" → evidencia funcional de QA: descreve o problema/comportamento esperado, os cenarios testados e o resultado da validacao. Sem trechos de codigo, sem caminhos de arquivo, sem detalhes de implementacao.
- Opcao 2: "Tecnica" → evidencia de QA completa: tudo da resumida + contexto tecnico da correcao (arquivos/pontos alterados, trechos de codigo relevantes) como suporte a validacao.

**Nas duas modalidades a voz e de QA.** A diferenca e apenas o nivel de detalhe tecnico anexado, nunca a perspectiva.

---

## Passo 4 - Gerar conteudo da evidencia

**Fonte principal: o contexto da conversa atual.** Voce ja sabe o que foi desenvolvido.

### MAS se voce NAO tiver contexto suficiente (ex: conversa nova, outro terminal):

Tente descobrir sozinho ANTES de perguntar ao dev, nesta ordem:

1. **Git - commits pendentes/recentes da branch:**
   ```bash
   git log --oneline main..HEAD
   git diff main..HEAD --stat
   git diff --cached --stat
   git status
   ```

2. **Contexto da tarefa** - se existir `tarefas/<TAREFA>/contexto/`, ler o `## Resumo` de cada arquivo.

3. **Se ainda nao souber**: ai sim pergunte ao dev de forma objetiva:
   ```
   Nao encontrei contexto suficiente na conversa nem no git/BOARD.
   O que foi desenvolvido nesta tarefa? (resumo rapido)
   ```

**Resumo: `tarefas/<TAREFA>/evidencias/resultado.json` > conversa > git log/diff > BOARD.md > perguntar.**

### Se o dev escolheu "Resumida":

Incluir, nesta ordem:
1. **Descricao** - O problema relatado / comportamento esperado, do ponto de vista de quem usa o sistema
2. **Cenarios validados** - O que foi testado, em linguagem funcional (fluxo, tela, dado de entrada, condicao)
3. **Resultado da validacao** - Resultado esperado x resultado obtido, com o veredito (conforme / nao conforme)
4. **Screenshots** - Se o usuario forneceu imagens

**NAO incluir**: caminhos de arquivo, trechos de codigo, nomes de classes/metodos, detalhes de implementacao.

### Se o dev escolheu "Tecnica":

Incluir tudo da resumida MAIS, como secao de apoio no FINAL:
1. **Contexto tecnico** - Pontos/arquivos alterados e a logica aplicada, explicando por que a correcao resolve o cenario testado
2. **Trechos de codigo** relevantes (max 10-15 linhas por trecho)
3. **Screenshots** - Se o usuario forneceu imagens

**O corpo principal continua sendo cenarios e resultado de teste.** O contexto tecnico entra depois, como suporte.


### Separacao por tipo de cenario (quando veio da esteira)

Se o `resultado.json` traz o campo `tipo` em cada cenario, o documento se organiza assim —
e isso nao e preferencia de layout, e regra de veredito:

| Onde no documento | O que vai | Observacao |
|---|---|---|
| **Corpo principal** | cenarios `obrigatorio` (`CT0N`) | abre com a **matriz CA -> CT**, a prova de cobertura dos criterios de aceite |
| **Apendice** compacto | cenarios `complementar` (`CX0N`) que **passaram** | apendice de 40 paginas ninguem le: um print por cenario |
| Secao **Achados** | cenarios `complementar` que **falharam** | dizer explicitamente que estao **fora do veredito** |

Complementar nunca aparece como se fosse cobertura de criterio de aceite. Se um `CX` falhou e
o veredito e `APROVADO`, a secao Achados precisa deixar claro que nenhum `CA0N` falhou.
### Como formatar:
- Escrever de forma clara e profissional, em portugues
- Usar subtitulos (`<h3>`) para cada secao
- Tom objetivo, de validacao/homologacao
- Preferir voz de QA: "validado que...", "verificado que...", "cenario executado...", "resultado obtido..." em vez de "implementei", "criei", "alterei"
- Nao incluir diffs gigantes - resumir as mudancas

### Exemplo de evidencia RESUMIDA:

```html
<h3>Descricao</h3>
<p>O sistema apresentava falha ao processar requisicoes com corpo muito grande, resultando em erro de memoria e indisponibilidade da operacao para o usuario. Comportamento esperado: a requisicao deve ser processada normalmente, sem erro e sem degradacao de resposta.</p>

<h3>Cenarios Validados</h3>
<ul>
  <li>Envio de requisicao com corpo acima do limite anterior de falha (2MB) - processamento concluido sem erro</li>
  <li>Envio de requisicao dentro do volume normal de uso - comportamento preservado, sem regressao</li>
  <li>Envio de conteudo nao textual - requisicao aceita normalmente</li>
  <li>Tentativa de conteudo malicioso (XSS) em requisicao textual - bloqueio mantido</li>
</ul>

<h3>Resultado da Validacao</h3>
<ul>
  <li>Esperado: requisicao grande processada sem erro. Obtido: processada com sucesso. <b>Conforme</b></li>
  <li>Esperado: protecao contra XSS mantida. Obtido: conteudo malicioso bloqueado. <b>Conforme</b></li>
  <li>Esperado: nenhum impacto nos fluxos existentes. Obtido: nenhuma regressao identificada. <b>Conforme</b></li>
</ul>
<p>Validacao concluida sem pendencias. Item apto para seguir para homologacao.</p>
```

### Exemplo de evidencia TECNICA:

Identica a resumida nas tres primeiras secoes — **Descricao**, **Cenarios Validados**,
**Resultado da Validacao**, na mesma forma. A diferenca e uma secao de apoio no fim:

```html
<h3>Contexto Tecnico da Correcao</h3>

<h4>Middlewares/AntiXssMiddleware.cs</h4>
<ul>
  <li>Substituido StreamReader por leitura com buffer pooled</li>
  <li>Adicionado limite de tamanho para inspecao (512KB)</li>
</ul>

<h4>Services/RequestValidationService.cs</h4>
<ul>
  <li>Filtro por content-type: apenas requisicoes textuais sao inspecionadas</li>
</ul>

<p>O middleware original usava <code>ReadToEndAsync()</code>, que alocava strings grandes no Large Object Heap, causando a falha observada no cenario de 2MB.</p>
<pre><code>var isTextualContent = contentType.Contains("application/json")
    || contentType.Contains("text/");</code></pre>
```

Na Tecnica a **Descricao** pode citar a excecao e o componente
(`OutOfMemoryException` no `AntiXssMiddleware`), e os **Cenarios Validados** podem usar o termo
tecnico ("Requisicao JSON de 2MB", "Upload binario (content-type nao textual)"). O corpo
principal continua sendo cenario → execucao → esperado x obtido.

**Layout de "Contexto Tecnico":**
- **NUNCA usar tabela de duas colunas** (Arquivo | Alteracao). Caminho longo comprime a coluna de
  alteracao e fica ilegivel.
- **Sempre `<h4>` com o caminho do arquivo** seguido de `<ul>` com as alteracoes daquele arquivo.

---

## Passo 5 - Gerar HTML e PDF via script Python

O script `.claude/scripts/gerar-evidencia.py` (criado no Passo 0 se necessario) cuida de toda a geracao pesada.

### 5.1 - Salvar o conteudo HTML da evidencia em arquivo temporario:

Usar a ferramenta **Write** do Claude Code para criar o arquivo (NAO usar bash/cat):

```
Write: /tmp/evidencia_content.html
Conteudo: {CONTEUDO HTML gerado no Passo 4}
```

### 5.2 - Chamar o script com os argumentos coletados:

```bash
{PYTHON_CMD} .claude/scripts/gerar-evidencia.py \
  --tarefa "Nome da tarefa" \
  --qa "Nome do QA" \
  --cliente "Acme" \
  --projeto "Acme CRM" \
  --id "ID_TAREFA" \
  --link "" \
  --conteudo-file /tmp/evidencia_content.html \
  --imagens img1.png img2.png
```

**IMPORTANTE:** `{PYTHON_CMD}` e o comando detectado no Passo 0.1 (`python`, `py -3`, ou caminho completo).
Se no Passo 0.1 foi necessario instalar Python, usar o caminho completo encontrado com `find`.

**Parametros:**
| Parametro | Obrigatorio | Descricao |
|-----------|-------------|-----------|
| `--tarefa` | Sim | Nome/titulo da tarefa |
| `--qa` | Sim | Nome do QA responsavel pela validacao (aparece como "QA:" no documento). O alias `--dev` continua aceito para compatibilidade, mas o rotulo impresso e sempre "QA:". |
| `--cliente` | **Sim** | Vem de `resultado.json` → `cliente`. Nao tem default: projeto multi-cliente, um default carimbaria o cliente errado na capa. |
| `--projeto` | **Sim** | Vem de `resultado.json` → `sistema` (ex.: "Acme CRM", "Acme Portal"). |
| `--id` | Nao | ID da tarefa (para nome do arquivo). Default: SEM-ID |
| `--link` | Nao | Link da tarefa (aparece no documento). Pode ficar vazio. |
| `--conteudo-file` | Sim | Caminho do arquivo com HTML da evidencia |
| `--imagens` | Nao | Lista de caminhos de imagens para embutir |

### O que o script faz automaticamente:
1. Le a capa local — primeiro em `.claude/skills/captura-evidencia/`, depois em `.claude/templates/`
2. Se nao encontrar em nenhum dos dois, segue sem pagina de capa
3. Monta o HTML completo com template, capa base64, metadados e conteudo
4. Salva HTML em `~/Downloads/Evidencia-{ID}-{TIMESTAMP}.html`
5. Converte para PDF via Edge/Chrome headless (**obrigatorio** - falha se nao conseguir)
6. Salva copia local em `tarefas/<TAREFA>/documento/Evidencia-{ID}-{TIMESTAMP}.html`
7. Abre o PDF no viewer padrao do sistema

**Se o script falhar com exit code 2** (PDF nao gerado): verificar se Edge ou Chrome esta instalado. Todo Windows 10/11 tem Edge pre-instalado, entao isso so acontece em cenarios muito raros.

### Saida do script:
```
HTML:  C:\Users\...\Downloads\Evidencia-12345-20260302_143022.html
PDF:   C:\Users\...\Downloads\Evidencia - TSK-12345-20260817_143022.pdf
SIZE:  1234567 bytes
LOCAL: C:\...\qa-agent\docs\evidencias\Evidencia-TSK-12345-2026-08-17_143022.html
OPEN:  C:\Users\...\Downloads\Evidencia - TSK-12345-20260817_143022.pdf
```

---

## Passo 6 - Anexar no ClickUp (perguntar antes)

> **Se este comando foi invocado de dentro da esteira `/testar-tarefa` ou `/reteste`: PULE
> este passo inteiro.** La o anexo e o comentario sao a etapa 10, que roda sem perguntar e
> ja publica nas tarefas certas. Perguntar aqui pararia a esteira e anexaria duas vezes.
> Nesse caso o `/evidencia` so gera o arquivo e devolve o caminho dele.

Quando rodado sozinho, fora da esteira: se foi possivel identificar o ID da tarefa no
ClickUp, perguntar ao dev:

Use AskUserQuestion com:
- Opcao 1: "Sim, anexar no ClickUp" → faz upload do PDF como anexo na tarefa do ClickUp
- Opcao 2: "Nao, so local" → pula o upload

### Se o dev confirmar o upload:

O upload e feito via MCP (ferramentas ClickUp integradas), **sem necessidade de credenciais manuais**.

### Anexar PDF na tarefa ClickUp (2 passos):

**Passo 1 - Ler o PDF e converter para base64:**
```bash
base64 -w 0 "{CAMINHO_DO_PDF}"
```
Guardar o resultado (string base64) para usar no proximo passo.

**Passo 2 - Anexar arquivo via MCP:**
Usar a ferramenta `mcp__claude_ai_ClickUp__clickup_attach_task_file` com:
- `task_id`: ID da tarefa no ClickUp
- `file_data`: conteudo base64 do PDF (obtido no passo anterior)
- `file_name`: nome do arquivo PDF (ex: `Evidencia - {ID_TAREFA}.pdf`)

### Tambem postar comentario na tarefa:
Usar a ferramenta `mcp__claude_ai_ClickUp__clickup_create_comment` com:
- `task_id`: ID da tarefa no ClickUp
- `comment_text`: "Evidencia de desenvolvimento anexada: Evidencia - {ID_TAREFA}.pdf"

---

## Passo 7 - Resultado

Apresentar com base na saida do script:

```
Evidencia gerada!

  PDF:   ~/Downloads/Evidencia - {ID}-{TIMESTAMP}.pdf
  HTML:  ~/Downloads/Evidencia-{ID}-{TIMESTAMP}.html
  Local: tarefas/<TAREFA>/documento/Evidencia-{ID}-{data}_{hora}.html

  Tarefa:   {nome}
  QA:       {qa}
  Cliente:  {cliente}
  Projeto:  {projeto}
  Imagens:  {N imagens incluidas | nenhuma}
  ClickUp:  {Anexado na tarefa {ID} | Nao enviado}
```

---

## Regras

### NUNCA IMPROVISAR

- **NUNCA GERE HTML OU PDF POR CONTA PROPRIA.** Toda geracao passa pelo script
  `.claude/scripts/gerar-evidencia.py`. Voce gera **so** o conteudo HTML da evidencia (o que vai
  dentro de `<div class="evidence-content">`: `<p>`, `<ul>`, `<h3>`, `<h4>`, `<pre>`) e passa via
  `--conteudo-file`. Template, CSS, capa, layout, metadados, footer e conversao PDF sao **todos**
  do script. NUNCA gere `<html>`, `<head>`, `<style>`, `<body>` nem capa.
- **Script falhou por qualquer motivo (Python ausente, erro de execucao, exit code != 0): PARE e
  resolva.** Nunca monte HTML/PDF a mao como alternativa, nunca crie template proprio, nunca use
  estilo diferente do script.
- **Exit code 2 = PDF nao gerado.** Informe o erro. **Nunca entregue somente HTML.**
- **Python ausente: instale (Passo 0.1) e tente de novo.** Nunca pule o script.

### MINIMIZAR USO DE BASH

- Prefira **Glob, Read, Write**. Bash so para: verificar/rodar Python, rodar git, executar o script.
- **Nunca** use bash para verificar existencia de arquivo (Glob), ler (Read) ou escrever (Write).
- Quando precisar de bash, **encadeie com `&&` em um unico comando**. Ex.:
  `git config user.name && git branch --show-current`.
- **Nunca rode comandos bash em paralelo** neste comando — falha em cascata se o ambiente tiver
  problema. (AskUserQuestion com varias perguntas numa chamada nao e bash e pode.)

### Demais regras

- **NAO LER ARQUIVOS BASE64**: nunca leia `.claude/templates/cover*.b64`. O script faz isso.
- **SEM CAMINHOS HARDCODED**: o script usa `Path.home()`. Nunca hardcode username.
- **EDICOES POS-GERACAO**: se o dev pedir ajuste na evidencia ja gerada, altere **somente** o que
  ele pediu. Nunca mexa em titulo, QA, cliente, projeto ou qualquer campo que ele nao citou.
  Regere o PDF com a alteracao pontual e mantenha o resto intacto.
- **DATA**: `DD/MM/YYYY`. **ENCODING**: UTF-8.

O resto do comportamento do script (capa real, base64 das imagens, timestamp unico, copia local,
abertura automatica, PDF obrigatorio) esta descrito no Passo 5 — nao se repete aqui.

---

## Se o script Python nao existir

`.claude/scripts/gerar-evidencia.py` e versionado neste repositorio. Ele **nao** e recriado a
partir deste documento — uma copia colada aqui envelhece e passa a gerar evidencia fora do
padrao. Restaure a versao real, nesta ordem:

```bash
git show HEAD:.claude/scripts/gerar-evidencia.py > .claude/scripts/gerar-evidencia.py
```

Se o arquivo tambem nao estiver no historico deste repositorio, pare e me avise.

**Nao escreva o script de cabeca e nao improvise um substituto.** Sem ele, pare e me avise.
