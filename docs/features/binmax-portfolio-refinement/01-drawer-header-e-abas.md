# Subetapa 01 — Header Institucional & Abas "Abiertas N" / "Cerradas"

## 1. Objetivo Técnico
Refinar o cabeçalho da gaveta lateral em `SidebarDock.tsx` e o container de abas em `BinmaxPortfolioDrawer.tsx`, alinhando-os à referência visual (`media_1791582778148_5c35f99d.png`):
- Remoção do emoji de maleta (`💼`) no modo Binmax, exibindo o título institucional `Portafolio total` em fonte Archivo, 14px, bold.
- Botão de fechar (✕) integrado no canto superior direito do header.
- Substituição dos botões em formato pílula por abas no estilo **Underline Tab Navigation**:
  - Aba ativa com traço branco inferior sólido (`border-bottom: 2px solid #FFFFFF`).
  - Aba inativa em cinza suave (`#8A92A1`).
  - Texto dinâmico: `Abiertas 2` (ou contagem atual) e `Cerradas`.
  - Preservação de compatibilidade regressiva com `data-testid="tab-portfolio-abiertas"` e `data-testid="tab-portfolio-cerradas"`.

---

## 2. Arquivos Impactados
- `apps/web/src/components/sidebar/SidebarDock.tsx`: Supressão de emojis no header no modo Binmax.
- `apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx`: Implementação da barra de navegação com underline.

---

## 3. Testes Requeridos
- Teste unitário verificando a presença de "Portafolio total" sem emojis no header.
- Teste unitário verificando a transição entre abas "Abiertas" e "Cerradas".
- Teste de regressão para garantir que os seletores legados continuam funcionando.
