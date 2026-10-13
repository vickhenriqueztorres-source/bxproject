# SUBETAPA 03: REDESIGN ERGONÔMICO DA TEMPERATURA DOS TRADERS (TRADERS MOOD BAR)

**Feature ID:** `BMR-CHART-UX-REFINEMENT-2026-10-09`  
**Subetapa:** 03 de 06  
**Responsável:** `chart-trading-engineer`  
**Revisores:** `qa-resilience-agent`, `compliance-risk-reviewer`

---

## 1. Problema Identificado e Escopo

> *"6 - Ajustar tambem a temperuta dos traders"*

- Atualmente, a barra de sentimento dos operadores em `TradersMoodBar.tsx` exibe 14 minúsculos diamantes de 4.5px rotacionados a 45 graus, parecendo uma linha pontilhada fragmentada e pouco visível.
- No padrão IQ Option / Turbo Prata institucional:
  - A barra é uma **cápsula contínua elegante** de alta precisão visual:
    - Largura de 5px a 6px e altura ergonômica (~160px a 200px).
    - Cantos arredondados suaves (`borderRadius: 999px`).
    - Parte superior em verde vívido (`#22C47A`) correspondendo ao percentual de Compradores (SUBE).
    - Parte inferior em vermelho vívido (`#F2545B`) correspondendo ao percentual de Vendedores (BAJA).
    - Divisor sutil e transições animadas fluidas (`transition: height 0.4s ease`).
    - Micro-badges elegantes no topo e rodapé com tipografia monospaçada (`SUBE 64%` e `BAJA 36%`).
    - Tooltip translúcido com efeito de vidro fosco ao passar o mouse.

---

## 2. Passo a Passo de Execução

1. **Editar `TradersMoodBar.tsx`**:
   - Manter a compatibilidade de props (`bullsPercentage: number`).
   - No modo Binmax (`isBinmax`), substituir o render de diamantes pela cápsula contínua bicolor institucional.
   - Posicionar a tag `SUBE xx%` com fundo escuro e borda verde no topo, e a tag `BAJA xx%` com fundo escuro e borda vermelha na base.
   - Adicionar tooltip descritivo em espanhol neutro ao passar o cursor: "Sentimiento de los operadores: X% Compradores, Y% Vendedores".
2. **Desenvolver Bateria de Testes Automatizados**:
   - Criar `apps/web/src/chart/subetapa-ux-03-mood-bar.unit.test.tsx`.
   - Teste 1: Renderização da cápsula contínua com proporção matemática exata de compradores e vendedores (soma = 100%).
   - Teste 2: Exibição dos badges `SUBE` e `BAJA` com formatação tabular Geist Mono.
   - Teste 3: Teste de estresse: 100 variações dinâmicas de percentual (5% a 95%) em < 150ms sem quebra de layout.
   - Teste 4: Padrão Duas Portas: modo legado preserva comportamento anterior.
3. **Execução e Emissão do Relatório de Gate**:
   - Rodar Vitest e emitir `docs/features/binmax-chart-ux-refinement/relatorios/RELATORIO-SUBETAPA-03.md`.
