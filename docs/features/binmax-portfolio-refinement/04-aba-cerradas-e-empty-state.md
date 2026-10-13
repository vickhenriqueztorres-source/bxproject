# Subetapa 04 — Aba "Cerradas" & Estado Vazio Sóbrio

## 1. Objetivo Técnico
Completar a experiência da gaveta de portfólio aplicando o mesmo rigor visual institucional à lista de operações fechadas ("Cerradas") e ao estado vazio:
- **Aba "Cerradas"**:
  - Cards formatados na mesma linguagem `#171F2B`, contendo par de bandeiras, símbolo, badge de direção (`↑ ARRIBA` ou `↓ ABAJO`), valor investido e resultado final (`+$XX.XX` ou `-$XX.XX`).
  - Carimbo de horário de encerramento (`Cerrado HH:mm:ss`) no lugar do cronômetro ativo.
- **Estado Vazio Institucional ("Sin Operaciones")**:
  - Renderizado quando `openContracts.length === 0` (na aba abertas) ou `closedContracts.length === 0` (na aba fechadas).
  - Ícone vetorial SVG suave de pasta/arquivo.
  - Título institucional: `No tienes operaciones abiertas` (ou `No tienes operaciones cerradas`).
  - Subtítulo explicativo: `Abre una operación con SUBE o BAJA.` em espanhol LATAM neutro.
  - Preservação estrita dos seletores de teste: `data-testid="portfolio-empty-state"`, `portfolio-empty-title` e `portfolio-empty-subtitle`.

---

## 2. Arquivos Impactados
- `apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx`

---

## 3. Testes Requeridos
- Teste de alternância e renderização da aba "Cerradas".
- Teste de renderização do estado vazio na ausência de operações abertas.
- Teste de renderização do estado vazio na ausência de operações fechadas.
- Validação de que todas as cópias em espanhol seguem a skill `13-textos-es`.
