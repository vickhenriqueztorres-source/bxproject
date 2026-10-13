# SUBETAPA 05: SOFISTICAÇÃO DE HORA DE COMPRA, EXPIRAÇÃO E FLAGS DE ORDENS

**Feature ID:** `BMR-CHART-UX-REFINEMENT-2026-10-09`  
**Subetapa:** 05 de 06  
**Responsável:** `chart-trading-engineer` / `surgical-frontend-agent`  
**Revisores:** `financial-correctness-reviewer`, `qa-resilience-agent`

---

## 1. Problema Identificado e Escopo

> *"3 - Deixar essa parte de compra e expiracao mais profissional e com um designer mais sofisticado e melhor no ux/ui assim como essa parte onde aparece o valor de compra etc"*

- **Pontos Críticos Visíveis na Imagem 3**:
  1. O badge `EXPIRACIÓN 00:51` possuía uma sombra de neon vermelho difusa exagerada (`rgba(242, 84, 91, 0.6)`), parecendo um alerta de erro em vez de uma régua de tempo.
  2. O badge `HORA DE COMPRA` ficava descolado visualmente do fluxo temporal.
  3. A cápsula da ordem (`▲ $100 00:55`) em `OrderFlagsOverlay.tsx` emitia um halo neon verde saturado e colidia com o rótulo de preço da escala do TradingView (`152.72100 / 152.722`), gerando poluição visual.
- **Redesign Sofisticado estilo IQ Option**:
  1. **Linhas Temporais (`TimeLinesOverlay.tsx`)**:
     - `HORA DE COMPRA`: Cápsula escura translúcida discreta com borda sutil `rgba(244, 245, 247, 0.12)`, tipografia em `Geist Mono` e contagem regressiva limpa.
     - `EXPIRACIÓN`: Tag elegante com fundo vermelho escurecido institucional (`#7A1C22`), contorno fino `#F2545B` e sombra mínima de 4px, sem efeito "queimado" de neon.
     - Linhas verticais refinadas (linha pontilhada branca para compra, linha contínua fina de 1.5px vermelha para expiração).
  2. **Flag da Ordem de Strike (`OrderFlagsOverlay.tsx`)**:
     - Cápsula com estilo institucional: fundo escuro translúcido (`rgba(13, 15, 20, 0.92)`), borda de acento na cor da ordem (verde `#22C47A` para SUBE, vermelho `#F2545B` para BAJA).
     - Ícone direcional em círculo discreto (`▲` ou `▼`).
     - Valor investido formatado com clareza (`$100`) em negrito monospaçado.
     - Timer residual discreto (`00:55`) com divisor vertical suave.
     - Deslocamento e margem para nunca sobrepor o rótulo de cotação da escala lateral direita.

---

## 2. Passo a Passo de Execução

1. **Editar `TimeLinesOverlay.tsx`**:
   - Ajustar estilos dos nós `time-tag-purchase` e `time-tag-expiration`.
   - Suavizar o `boxShadow` e aplicar paleta Turbo Prata.
2. **Editar `OrderFlagsOverlay.tsx`**:
   - Refinar a cápsula `order-strike-flag`: background elegante translúcido com borda colorida e sombra suave institucional `0 4px 12px rgba(0,0,0,0.5)`.
   - Ajustar posicionamento relativo à régua lateral (margem segura).
3. **Desenvolver Bateria de Testes Automatizados**:
   - Criar `apps/web/src/chart/subetapa-ux-05-timelines-flags.unit.test.tsx`.
   - Teste 1: Renderização de `HORA DE COMPRA` e `EXPIRACIÓN` com tipografia e cores institucionais.
   - Teste 2: Renderização de flags SUBE e BAJA com badges de valor, timer e ícones.
   - Teste 3: Preservação de minor units na exibição dos valores dos contratos.
   - Teste 4: Teste de estresse com 50 ordens simultâneas sem degradação ou sobreposição indevida.
4. **Execução e Emissão do Relatório de Gate**:
   - Rodar Vitest e emitir `docs/features/binmax-chart-ux-refinement/relatorios/RELATORIO-SUBETAPA-05.md`.
