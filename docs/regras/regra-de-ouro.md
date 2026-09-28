> Regra do projeto — parte de `CLAUDE.md`. Mesma força do arquivo principal.

## 🥇 REGRA DE OURO

> **Contexto vem do CÓDIGO. Evidência vem de HOMOLOGAÇÃO.**

São duas coisas separadas e nunca devem ser confundidas:

| | De onde vem | Por quê |
|---|---|---|
| **Contexto** (fluxo, seletores, endpoints, regras) | Repositório do cliente no caminho de `config/clientes.json` — **escopo** vem do diff da tarefa, **seletor** vem da ref que está no ar no ambiente alvo (`origin/develop` em hmlg) | O código-fonte é a fonte da verdade. `data-testid` reais, rotas do router, payloads dos services, mensagens de validação — tudo está lá. O `git diff` diz **exatamente** o que mudou, algo que a descrição da tarefa quase nunca entrega por completo. Ver "📦 Repositórios dos clientes" para qual diff e qual ref usar. |
| **Execução oficial / evidência** | Homologação (`AMBIENTE=hmlg`) | É o ambiente que o PO/cliente valida depois na coluna "EM VALIDAÇÃO (PO/CLIE)". Build real, env real, integrações reais, volume de dados real. Evidência de localhost não prova nada para o time. |

O ambiente é apenas o `baseURL`. Trocar de alvo é **uma variável**, não outro projeto.

### Quando usar `AMBIENTE=local` (localhost rodando a branch)

Localhost é **ferramenta de apoio**, nunca o alvo da evidência final. Use quando:

1. A feature ainda não subiu para hmlg e você não quer ficar bloqueado.
2. Precisa forçar um edge case que hmlg não permite — seed no banco, mock de erro 500, feature flag, perfil de acesso específico.
3. Um teste quebrou em hmlg e você precisa debugar com log, breakpoint ou consulta no banco.
4. Precisa validar contrato de API antes da UI existir.

**Armadilha a evitar:** desenvolver o spec só contra localhost e nunca rodar em hmlg.
O seletor pode existir na branch e não no build de hmlg (versão defasada), a env var pode
ser diferente, o dado pode existir só local. **O run que gera a evidência é sempre em hmlg.**
Se o teste passa local e falha em hmlg, isso **é** um achado de QA — reporte, não esconda.

---

