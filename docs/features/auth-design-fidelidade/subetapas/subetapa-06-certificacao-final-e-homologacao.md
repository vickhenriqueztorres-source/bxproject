# Subetapa 06 — Homologação Final e Certificação do Designer Sênior

> **Objetivo:** Realizar a auditoria formal através do checklist do Designer Sênior (`21-designer-senior-binmax`), validar que não houve nenhuma regressão nas rotas do sistema, consolidar as evidências de teste e emitir o Parecer de Homologação.

---

## 1. Checklist de Homologação do Designer Sênior

```markdown
### Auditoria de Design Sênior — BINMAX (Login & Registro)

- [ ] **Filtro Central**: A tela parece um instrumento de precisão financeira de alta tecnologia ou tem elementos de joguinho?
- [ ] **Hierarquia Visual**: O protagonista da tela está nítido no "teste dos olhos semicerrados"?
- [ ] **Superfícies**: A profundidade é dada por camadas tonais (#0B0E14 -> #101622 -> #151D2B -> #1C2738) sem brilhos ou bordas berrantes?
- [ ] **Semântica de Cores**: As cores respeitam a tabela semântica (Verde=ação/ganho, Vermelho=risco/erro, Aço=apoio)?
- [ ] **Tipografia**: Geist Sans para interface e Geist Mono estritamente nos números com `tabular-nums`?
- [ ] **5 Estados**: Vazio, Carregando, Cheio, Erro e Sucesso/Bloqueado devidamente implementados?
- [ ] **Motion Tokens**: As transições usam exclusivamente durações de 100/180/260ms e a curva `--bm-ease`?
- [ ] **Honestidade de Latência**: Sem spinners decorativos mascarando a resposta do servidor?
- [ ] **Lista de Proibições**: Zero confetes, zero sons de cassino, zero popups eufóricos, zero bounce, zero shake.
- [ ] **Zero Layout Shift**: Alternância de abas fluida sem pulo vertical ou horizontal.
- [ ] **Escala de Espaçamento**: 100% dos espaçamentos aderem à escala fixa de 8px (4, 8, 12, 16, 24, 32, 48px).

**Veredito Oficial:** [APROVADO | REPROVADO]
```

---

## 2. Roteiro de Não-Regressão
1. Executar a suíte de testes de regressão do projeto: `pnpm vitest run apps/web/src/pages/`
2. Testar navegação entre rotas (`/login` -> `/registro` -> `/recuperar` -> `/operar`).
3. Verificar a preservação do invariante de saldo de prática $10.000 (`1000000 minor units`).
