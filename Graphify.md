Sim - o `graphify update .` é só rodar no PowerShell, a partir da raiz do projeto. O `.` significa “esta pasta”, então o que vale é o diretório de onde você executa o comando:

cd C:\Users\higor.rissato\qa-agent-moovefy
graphify update .

Vale em qualquer projeto que já tenha `graphify-out/`. Cinco coisas importantes:

- Ele só reindexa CÓDIGO: AST puro, sem LLM e sem custo. Texto de `.md` não entra. Para documentação, use `/graphify --update` dentro do Claude Code - esse usa LLM e é cobrado.
- Quando rodar: depois de criar, renomear ou apagar arquivos de código. Editar o corpo de uma função não exige, mas ajuda a manter os números de linha corretos.
- Se você apagou muita coisa: ele recusa o rebuild quando o grafo novo tem menos nós que o antigo (proteção contra build quebrado). Aí é `graphify update . --force`.
- Se quiser algo automático: `graphify watch .` fica rodando e reconstrói sozinho a cada mudança.
- Para um projeto novo, que ainda não tem `graphify-out/`: o primeiro build não é esse comando - é o `/graphify` dentro do Claude Code; e o `graphify install` é o que coloca essa skill no lugar. Não testei esse caminho aqui, então confirme antes de contar com ele.