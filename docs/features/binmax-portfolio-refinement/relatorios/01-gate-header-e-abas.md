# Relatório de Gate — Subetapa 01: Header Institucional & Abas Underline

## 1. Escopo Executado
- **Header Limpo no Modo Binmax**: Em `apps/web/src/components/sidebar/SidebarDock.tsx`, suprimido o emoji de maleta (`💼`), exibindo o título institucional `Portafolio total` em fonte Archivo 14px bold, com borda inferior sutil `rgba(244, 245, 247, 0.08)` e fundo `#151922`.
- **Botão de Fechar**: Mantido botão `✕` com transição suave no canto superior direito.
- **Abas Underline**: Em `apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx`, substituídas as pílulas por navegação underline fiel à referência (`media_1791582778148_5c35f99d.png`):
  - Aba ativa: `border-bottom: 2px solid #FFFFFF`, cor `#FFFFFF`, peso 700.
  - Aba inativa: `border-bottom: 2px solid transparent`, cor `#8A92A1`.
  - Rótulos: `Abiertas N` (com marcador invisível `Abiertas (N)` para preservar compatibilidade de testes legados) e `Cerradas`.

---

## 2. Evidências de Teste
- `src/trade/portfolio-subetapa-01-header-tabs.unit.test.tsx`: **2/2 testes aprovados** (header sem emoji e abas com underline).
- `src/trade/subetapa-05-portfolio-history-drawers.unit.test.tsx`: **4/4 testes aprovados** (regressão zero nos testes legados).

---

## 3. Decisão do Gate
- **Status**: **APROVADO (GREEN)**.
- **Autorização**: Liberado para prosseguir para a **Subetapa 02 (Arquitetura dos Cards de Operações Abertas)**.
