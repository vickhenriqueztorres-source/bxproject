# Subetapa 01: Boleta Elástica e Responsiva Verticalmente (OrderTicket 100% Encaixado)

> **Orquestrador**: `tech-lead-orchestrator`  
> **Agente Executor**: `surgical-frontend-agent`  
> **Revisor de Design**: `chief-visual-director` (`designer-senior-binmax`)  
> **Agente de Testes**: `qa-resilience-agent`  
> **Skills**: `17-mudanca-cirurgica`, `21-designer-senior-binmax`, `06-testing-quality`, `12-tokens-binmax`  

---

## 1. Objetivo Técnico
Adequar as dimensões e espaçamentos internos do componente `OrderTicket` (quando em modo compacto `isCompact={true}`) para que ele responda de forma fluida e elástica à restrição de altura vertical.
O objetivo é reduzir a altura intrínseca total da boleta compacta de **>302px** para **<=240px**, permitindo que ela se encaixe perfeitamente (100% encaixada) dentro de células de gráficos múltiplos com altura reduzida quando a gaveta de posições ("Mostrar posiciones") estiver aberta.

---

## 2. Passo a Passo de Implementação
1. No arquivo `apps/web/src/trade/OrderTicket.tsx`:
   - No bloco `isBinmax`:
     - Configurar `ticketGap`:
       - Em vez de fixo `5px`, usar `clamp(2px, 0.4vh, 4px)`.
     - Configurar `fieldHeight` (para os blocos Monto e Expiración):
       - Em vez de fixo `36px`, usar `clamp(28px, 3.8vh, 32px)`.
     - Configurar `stepperBtnWidth`:
       - Em vez de fixo `30px`, usar `26px`.
     - Configurar `btnHeight` (para os botões SUBE e BAJA):
       - Em vez de fixo `42px`, usar `clamp(32px, 4.6vh, 38px)`.
     - Presets `[10, 50, 100, 500]`:
       - Reduzir altura de `24px` para `20px`.
       - Ajustar tamanho da fonte para `10.5px`.
       - Reduzir `marginTop` de `5px` para `3px`.
     - Bloco `ticket-block-ganancia`:
       - Reduzir `fontSize` do percentual de `22px` para `18px`.
       - Reduzir `fontSize` do valor monetário de `13px` para `11.5px`.
       - Padding vertical reduzido para `0 0 1px 0`.
     - No wrapper `.binmax-order-dock`:
       - Garantir `overflow: hidden`, `height: 100%`, `justifyContent: space-between`.
2. Criar a suíte de testes unitários:
   - Arquivo: `apps/web/src/trade/subetapa-01-boleta-responsiva-vertical.unit.test.tsx`
   - Testar que a boleta compacta renderiza todos os campos (Monto, Presets, Expiración, Ganancia, SUBE, BAJA) e cabe em container de 240px de altura sem gerar overflow.

---

## 3. Matriz de Testes da Subetapa 01
| ID | Tipo | Cenário de Teste | Critério de Sucesso |
|---|---|---|---|
| T1.1 | Unitário | Renderização do OrderTicket compacto | Todos os blocos presentes com classes e testids |
| T1.2 | Estresse | Renderização dentro de container com restrição de altura (240px) | Altura do ticket contida, sem estourar container |
| T1.3 | Ergonomia | Botões de Presets `[10, 50, 100, 500]` | Todos clicáveis com dimensões compactas adequadas |
| T1.4 | Segurança | Bloqueios de SUBE/BAJA sob feed stale ou paused | Botões desabilitados e visíveis |
| T1.5 | Não-Regressão | Modo clássico `isCompact=false` | Permanece inalterado para layout 1x1 |

---

## 4. Critério de Aceite da Subetapa 01
Apenas avançar para a Subetapa 02 quando:
- `subetapa-01-boleta-responsiva-vertical.unit.test.tsx` estiver 100% verde.
- O linter e typecheck estiverem sem erros.
