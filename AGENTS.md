# QA Agent (Codex)

As regras deste projeto estão em **`CLAUDE.md`**, na raiz, e nos arquivos de **`docs/regras/`**
que ele indexa. Leia `CLAUDE.md` antes de qualquer ação.

As skills estão em **`.claude/skills/`**. Leia de lá. **Não existe cópia em `.agents/` nem em
`.codex/`** — cópias divergem em silêncio, e um sync
automático chegou a apagar regra viva ao copiar a versão errada por cima.

Duas traduções ao ler qualquer um desses arquivos:

- `.claude/` → `.codex/` (quando o texto falar de *configuração*, não do caminho das skills)
- "Claude Code" → "Codex"

Uma árvore só. Se você sentir falta de uma regra aqui, ela está em `CLAUDE.md`,
em `docs/regras/` ou em `.claude/skills/`.

**Não recrie `.agents/` nem `.codex/.agents/skills/`.** Se alguma ferramenta sua reescrever
essas pastas, ela vai ressuscitar versões defasadas.
