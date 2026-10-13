# Relatório de Gate — Subetapa 03: Barra de Progresso Viva & Cronômetro Regressivo em Tempo Real

## 1. Escopo Executado
- **Barra de Progresso Horizontal**:
  - Trilho com altura de 3px, fundo `rgba(255, 255, 255, 0.12)` e bordas arredondadas.
  - Preenchimento proporcional ao tempo transcorrido `(now - created_at) / (expires_at - created_at) * 100`.
  - Cor dinâmica: verde institucional `#22C47A` para posições no lucro e prata/cinza `#E0E0E0` para posições no prejuízo.
- **Cronômetro Regressivo Decrescente**:
  - Exibição no formato `mm:ss` (ex: `00:32`, `01:10`) com Geist Mono bold 12.5px.
  - Atualização automática a cada 1 segundo via `setInterval` seguro no `useEffect` com descarte no unmount.
- **Carimbo de Expiração**:
  - Legenda `Expira HH:mm:ss` (ex: `Expira 02:21:00`) com alinhamento e contraste refinados.

---

## 2. Evidências de Teste
- `src/trade/portfolio-subetapa-02-04-cards-and-timers.unit.test.tsx` (Teste 3.1): **APROVADO**.

---

## 3. Decisão do Gate
- **Status**: **APROVADO (GREEN)**.
- **Autorização**: Liberado para prosseguir para a **Subetapa 04 (Aba Cerradas & Empty State)**.
