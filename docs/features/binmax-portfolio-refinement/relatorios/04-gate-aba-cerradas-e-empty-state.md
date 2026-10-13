# Relatório de Gate — Subetapa 04: Aba "Cerradas" & Estado Vazio Sóbrio

## 1. Escopo Executado
- **Aba "Cerradas"**:
  - Cards formatados no mesmo padrão `#171F2B`, contendo par de bandeiras, símbolo do ativo, badge `↑ ARRIBA` ou `↓ ABAJO`, valor investido, badge de status (`Ganada` / `Perdida`), horário de encerramento (`Cerrado HH:mm:ss`) e resultado final (`+$XX.XX` ou `-$XX.XX`).
- **Estado Vazio Institucional**:
  - Renderizado com ícone SVG limpo de pasta, título e subtítulo contextuais em espanhol LATAM neutro:
    - Para abertas: `No tienes operaciones abiertas` / `Abre una operación con SUBE o BAJA.`
    - Para fechadas: `No tienes operaciones cerradas` / `Tus operaciones finalizadas aparecerán aquí.`
  - Preservados os `data-testid` legados (`portfolio-empty-state`, `portfolio-empty-title`, `portfolio-empty-subtitle`).

---

## 2. Evidências de Teste
- `src/trade/portfolio-subetapa-02-04-cards-and-timers.unit.test.tsx` (Teste 4.1): **APROVADO**.
- `src/trade/subetapa-05-portfolio-history-drawers.unit.test.tsx`: **APROVADO**.

---

## 3. Decisão do Gate
- **Status**: **APROVADO (GREEN)**.
- **Autorização**: Liberado para prosseguir para a **Subetapa 05 (Bateria de Testes de Estresse, Caos e Segurança)**.
