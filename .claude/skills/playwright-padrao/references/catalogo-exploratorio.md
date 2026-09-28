# Catálogo exploratório — heurísticas por tipo de elemento

> **Isto é uma tabela de consulta, não um checklist de cobertura.**
>
> Nada aqui é obrigatório. O catálogo existe para você **não esquecer** de uma variação óbvia
> quando ela for relevante — não para você rodar todas. Variação que o diff não tocou não vira
> cenário. Variação sem risco real não vira cenário. Na dúvida, não proponha.

## Onde ele entra

| Etapa | O que acontece |
|---|---|
| `qa-explorador` (etapa 4) | classifica cada linha do `03b-inventario-acoes.md` na coluna **`Tipo`** |
| Plano (etapa 5) | para cada linha do inventário, consulta o `Tipo` aqui e propõe os `CX0N` que fizerem sentido |
| Gate (etapa 6) | o QA aprova `todos` / `nenhum` / IDs — complementar não aprovado **não vira spec** |

**Tudo o que sai daqui é cenário complementar (`CX0N`).** Nunca obrigatório. Obrigatório nasce
só de critério de aceite — essa regra não tem exceção e o catálogo não a toca.

**Complementar não decide veredito.** Se falhar, vira `Achado`. Só o QA, no gate do achado
(etapa 8.6), pode transformar um achado em `REPROVADO` — você nunca faz isso sozinho.

---

## As três travas antes de propor qualquer coisa

| Trava | Regra |
|---|---|
| **Teto** | no máximo **6 `CX` por rodada**, ordenados por risco. Passou de 6, corte e declare no gate o que ficou de fora e por quê |
| **Agrupamento** | variações do **mesmo elemento** viram **um** `CX` data-driven, com tabela de valores — nunca um `CX` por valor |
| **Gatilho** | só propõe se **o diff tocou aquele elemento** (`02-codigo.md`) ou se ele compartilha código com o que mudou |

O agrupamento é o que impede a explosão. Seis CNPJs inválidos são **um** `CX`, uma seção no
PDF e um print — não seis de cada.

### Custo de massa conta no teto do preparo de ambiente

Variação que **grava registro** (duplo clique em Salvar, submit repetido) consome o teto de
**20 registros por tarefa** do Preparo do ambiente. Some antes de propor: se 3 `CX` gravam 2
registros cada, são 6 do orçamento. Declare esse custo na linha do `CX` no plano.

### Como ordenar os 6 por risco

"Ordenados por risco" não é intuição. Pontue cada `CX` candidato nos dois eixos e ordene pelo
produto — o que sobrar abaixo do corte é o que você declara no gate como deixado de fora.

| Impacto | | | Probabilidade | |
|---|---|---|---|---|
| **5** | perda de receita, vazamento de dado, risco legal | | **5** | o diff mexeu direto ali, sem teste cobrindo |
| **4** | funcionalidade principal quebrada para um segmento | | **4** | o diff mexeu, cobertura parcial |
| **3** | fluxo atrapalhado, mas existe contorno | | **3** | código compartilhado com o que mudou |
| **2** | problema cosmético ou de UX menor | | **2** | área estável, pouco tocada |
| **1** | sem impacto para o usuário | | **1** | exigiria circunstância excepcional |

`Impacto × Probabilidade` é o score. Um `CX` de impacto 3 numa área que o diff reescreveu
(probabilidade 5) vale 15 e passa na frente de um impacto 5 em código intocado (5 × 1 = 5).
**O composto manda, não o impacto sozinho.**

---

## Os dez oráculos — as lentes, antes dos tipos

O catálogo abaixo é por **tipo de elemento**. Os oráculos são a pergunta que você faz olhando
para qualquer elemento. Use-os quando o tipo não sugerir nada e você ainda desconfia da tela.

| Oráculo | A pergunta |
|---|---|
| **History** | isso funcionava antes do diff? (ver `regressao-vizinhanca`) |
| **Image** | está no padrão de acabamento do resto do sistema? |
| **Comparable** | como as outras telas deste mesmo sistema resolvem isso? |
| **Claims** | bate com o que o `CA0N` prometeu? |
| **User expectations** | um operador real ficaria confuso ou travado aqui? |
| **Product** | a mensagem de erro segue o estilo das outras mensagens do sistema? |
| **Standards** | cumpre o que a regra externa exige (documento fiscal, formato legal)? |
| **Familiarity** | alguém que abre esta tela pela primeira vez entende sem ajuda? |
| **Explainability** | você consegue explicar por que o sistema se comporta assim? Se não, desconfie |
| **World** | funciona fora do caso padrão — outro fuso, virada de mês, sessão longa, conexão ruim, tela menor? |

`World` e `Explainability` são as que mais rendem aqui, e são as que nenhum tipo do catálogo
cobre sozinho.

---

## O catálogo

### `mascara` — CPF, CNPJ, CEP, telefone, placa, inscrição estadual

| Variação | O que se espera |
|---|---|
| dígito verificador inválido (`11.111.111/1111-11`) | recusa com mensagem específica, não genérica |
| faltando dígito | recusa, sem gravar |
| só letras / só símbolos | máscara bloqueia ou campo recusa |
| colar **com** máscara | aceita e normaliza |
| colar **sem** máscara | aceita e aplica a máscara |
| todos zeros | recusa |
| campo vazio, se obrigatório | mensagem de obrigatoriedade |

Documento sintético sempre por `support/cnpj.ts`. Nunca CPF/CNPJ real — nem válido, nem em
print de evidência.

**Agrupa em 1 `CX` data-driven.** Um print: a mensagem de recusa de um dos valores.

---

### `botao-grava` — qualquer ação que persiste (Salvar, Confirmar, Enviar, Finalizar)

| Variação | O que se espera |
|---|---|
| **duplo clique rápido** | um registro só. Duplicou → achado forte |
| ENTER + clique no botão | idem |
| clique durante o `waitForResponse` | botão desabilitado ou requisição ignorada |
| clique com formulário parcialmente preenchido | validação antes do POST, não erro 500 |

Este é o tipo de maior retorno do catálogo — idempotência é onde CRUD costuma quebrar, e o
sintoma (registro duplicado em produção) é caro.

**Grava registro:** conta no orçamento de massa. Prefira massa descartável e prefixada.

O print que sustenta o cenário é a **listagem depois da ação**: 1 registro = passou; 2 = achado.

---

### Conferir no banco o que a tela gravou

Quando o `CX` de `botao-grava` desconfia do que foi persistido, três consultas resolvem — o
acesso ao banco de hmlg está na skill global de acessos da empresa (TODO(empresa): crie a sua, fora do repositório). **Somente `SELECT`.**

| Verificação | Query | O que denuncia |
|---|---|---|
| Órfão | `LEFT JOIN pai ON … WHERE pai.id IS NULL` | filho apontando para pai que não existe mais |
| Unicidade não constrangida | `COUNT(*)` vs `COUNT(DISTINCT col)` | coluna que deveria ser única e não tem constraint — é o que deixa o duplo clique duplicar |
| Tipo e precisão | valor monetário com casas certas · `VARCHAR` no limite · timestamp gravado em UTC | truncamento silencioso, perda de centavo, data que muda de dia conforme o fuso |

Nunca rode isso em base com `db.producao: true` — continua bloqueada.

---

### `numerico` — valor, quantidade, percentual, peso

| Variação | O que se espera |
|---|---|
| negativo | recusa, ou aceita conforme a regra — o diff decide qual |
| zero | conforme a regra do campo |
| decimal com vírgula **e** com ponto | ambos aceitos ou um recusado com mensagem clara |
| limite superior do tipo no banco | recusa com mensagem, nunca erro 500 |
| mais casas decimais que o campo suporta | arredonda ou recusa — nunca trunca em silêncio |

O limite vem do **diff**: tipo da coluna na migration, `decimal(18,2)`, validação do DTO.
Sem essa referência, não proponha o cenário de limite.

---

### `data` — data única ou intervalo

| Variação | O que se espera |
|---|---|
| intervalo invertido (fim antes do início) | recusa com mensagem |
| data futura / passada, quando a regra proíbe | recusa |
| último dia do mês, 29/02 de ano bissexto | aceita e calcula certo |
| formato digitado à mão fora da máscara | recusa ou normaliza |

---

### `texto-livre` — nome, descrição, observação

| Variação | O que se espera |
|---|---|
| **limite do banco** (`nvarchar(N)` do diff) | trunca com aviso ou recusa — nunca erro 500 |
| acento e cedilha | grava e relê igual, sem mojibake |
| `<script>alert(1)</script>` | escapado na exibição, não executado |
| só espaços | tratado como vazio, se o campo é obrigatório |

O `N` do limite vem da migration ou do DTO no diff. Sem `N`, não proponha.

---

### `selecao` — dropdown, autocomplete, radio, checkbox

| Variação | O que se espera |
|---|---|
| lista vazia (nenhuma opção disponível) | mensagem, não combo quebrado |
| busca sem resultado no autocomplete | "nenhum resultado", não erro |
| trocar a seleção depois de preencher campos dependentes | dependentes limpam ou recalculam |
| opção inativa/excluída aparece na lista? | não deve aparecer |

O **campo dependente** é a variação de maior valor aqui: é onde estado velho sobrevive na tela.

---

### `grid` — listagem, tabela, resultado de busca

| Variação | O que se espera |
|---|---|
| zero resultados | mensagem de vazio, não grid quebrado |
| ordenar pela **coluna nova** que o diff adicionou | ordena de fato, inclusive nulos |
| filtrar + paginar + voltar página | filtro sobrevive à paginação |
| F5 com filtro aplicado | conforme a regra da tela — mantém ou limpa, mas coerente |
| coluna nova com valor nulo | mostra vazio, não `null` nem `undefined` |

---

### `upload` — anexo, importação de planilha

| Variação | O que se espera |
|---|---|
| extensão não permitida | recusa com mensagem |
| arquivo vazio (0 byte) | recusa |
| acima do limite de tamanho | recusa com mensagem, não timeout |
| arquivo com o nome contendo acento/espaço | aceita |

---

### `endpoint` — quando o diff tocou controller/service (com ou sem UI)

| Variação | O que se espera |
|---|---|
| payload sem campo obrigatório | `400` com corpo de erro, nunca `500` |
| tipo trocado (string onde espera número) | `400` |
| chamada sem o acesso exigido | `401`/`403`, nunca `200` com dado |
| id inexistente | `404`, nunca `500` |

Escreva como `tarefas/<ID>/specs/<modulo>.api.spec.ts`. Aqui o print não é tela: a evidência é o status e o corpo
da resposta registrados no passo.

---

### `navegacao` — rota nova, redirect, breadcrumb, botão voltar

| Variação | O que se espera |
|---|---|
| acessar a rota nova direto pela URL, sem passar pelo fluxo | carrega ou redireciona — não tela branca |
| botão voltar do navegador no meio do fluxo | estado coerente, sem duplicar submit |
| acessar a rota sem o acesso exigido | bloqueio, não tela vazia |

---

### `permissao` — quando o diff mexeu em perfil, claim ou acesso

| Variação | O que se espera |
|---|---|
| perfil **sem** o acesso abre a tela | menu/botão ausente ou bloqueio explícito — nunca tela funcional |
| perfil sem acesso chama o endpoint direto | `401`/`403`, nunca `200` com dado |
| perfil **com** o acesso | fluxo completo, sem bloqueio residual |

Exige um segundo `storageState` (`test.use({ storageState: arquivoAuth('operador') })`). Se o
perfil de teste não existir, isso é Preparo do ambiente, não `BLOQUEADO`.

---

### `regressao-vizinhanca` — o que o diff tocou e **já funcionava antes**

| Variação | O que se espera |
|---|---|
| fluxo vizinho que usa o mesmo componente/service alterado | comportamento idêntico ao de antes |
| tela que consome o mesmo endpoint que mudou de payload | continua renderizando, sem campo vazio novo |
| caso que o `if` novo **não** deveria pegar | cai no caminho antigo, sem desvio |

O gatilho é o diff, não o palpite: só entra se o arquivo alterado é compartilhado. Um `CX` de
vizinhança que falha é dos achados mais valiosos da rodada — e continua sendo achado, não
`REPROVADO`.

---

### `acao-destrutiva` — excluir, inativar, cancelar, estornar

| Variação | O que se espera |
|---|---|
| confirmação obrigatória antes de executar | diálogo, nunca ação direta no clique |
| executar sobre registro que não permite (em uso, já cancelado) | recusa com mensagem, nunca `500` |
| efeito colateral em registro relacionado | o que o diff prometeu — e **nada além** |

**Só execute se houver como desfazer ou se a massa for descartável** (registro `QA-` criado por
você nesta rodada). Nunca sobre registro pré-existente do ambiente. Se não der para desfazer,
o `CX` fica no plano marcado `não executável nesta rodada` e vira observação no comentário.

---

## Como escrever o `CX` no plano

Cada complementar proposto carrega, em uma linha:

```
CX01 — [botao-grava] Duplo clique em "Salvar" não duplica o cadastro
   por que importa: o diff mudou o handler do submit e não há trava de reentrância visível
   estimativa: 3 min · massa: 1 registro
```

Sem a linha `por que importa`, o complementar **não entra no plano**. Justificativa é risco
observado no diff ou na tela — não é "boa prática".

## Política de evidência (resumo — a regra completa está em `captura-evidencia`)

| Resultado do `CX` | Prints |
|---|---|
| passou | **1** — o estado final que sustenta a asserção |
| passou, e a asserção compara com estado anterior (`botao-grava`, contador, saldo) | **2** — o "antes" tirado **antes da ação**, e o final |
| falhou | **antes** + **momento da falha**. "Depois" só se houver efeito tardio |

Print "depois" tirado só porque o cenário acabou não entra: engorda o PDF sem responder a
nenhuma objeção.
