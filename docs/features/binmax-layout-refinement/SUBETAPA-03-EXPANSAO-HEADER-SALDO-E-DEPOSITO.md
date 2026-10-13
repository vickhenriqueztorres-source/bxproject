# SUBETAPA 03: EXPANSÃO DO HEADER, SALDO INSTITUCIONAL E BOTÃO DEPOSITAR (IMAGEM 2)

**Feature:** `BMR-LAYOUT-REFINEMENT-2026-10-09`  
**Subetapa:** 03 de 04  
**Agente Responsável:** `broker-architect-agent` / `surgical-frontend-agent`  
**Revisores:** `qa-resilience-agent`, `financial-correctness-reviewer`, `compliance-risk-reviewer`

---

## 1. Análise Forense da Imagem 2 (`media_1791574681815_95a8a022.png`)

A imagem da seção superior direita do terminal demonstra:
1. **Avatar Circular do Trader (32px)**:
   - Aumentado de 24px para 32px.
   - Borda institucional e ícone vetorial de perfil com proporção proporcional.
2. **Identificador de Tipo de Conta e Seta Expansora**:
   - Rótulo superior: `Cuenta de práctica ▼` ou `Cuenta real ▼`.
   - Tipografia ampliada de 9px para 11px / 11.5px, com peso 600 e cor `#8A92A1`.
   - Seta indicadora verde/cinza com transição de rotação ao abrir o dropdown.
3. **Saldo em Destaque Monospaçado (15.5px a 16px)**:
   - Saldo exibido em verde vívido institucional (`#22C47A`).
   - Tamanho aumentado de 13px para 15.5px / 16px, `font-weight: 800`, `font-family: 'Geist Mono', monospace`.
   - Alinhamento preciso e espaçamento tabular (sem oscilações visuais durante tiques de cotação).
4. **Botão `💳 Depositar` Amplo e de Alto Impacto**:
   - Altura total aumentada para ~38px (anterior: 26px).
   - Padding expandido para `8px 18px`.
   - Tipografia em 13px / 13.5px com `fontWeight: 800` e cor `#0D0F14` para contraste máximo.
   - Ícone de cartão/carteira com traço nítido de 15px.
   - Glow verde sutil (`box-shadow: 0 0 16px rgba(34, 196, 122, 0.35)`).
5. **Botão `Salir` e Status de Latência**:
   - Rótulo `Salir` em 13px, discreto e legível.
   - Indicador de latência com ponto verde pulsante e valor em milissegundos monospaçado.

---

## 2. Passo a Passo de Execução

1. **Atualizar `AccountSelectorDropdown.tsx`**:
   - Aumentar o avatar para 32px x 32px (ícone interno de 16px).
   - Aumentar o rótulo de tipo de conta para 11px/11.5px.
   - Aumentar o saldo exibido para 15.5px/16px em negrito 800 monospaçado.
   - Ajustar padding do container para `4px 10px` e cantos arredondados de `7px`.
2. **Atualizar `TerminalHeader.tsx`**:
   - Aumentar botão `Depositar` para altura de ~38px, padding `8px 18px`, fonte de 13px/13.5px.
   - Ajustar botão `Salir` para tamanho proporcional de 13px.
   - Garantir alinhamento vertical perfeito com a altura total de 56px do header.
3. **Desenvolver Bateria de Testes Automatizados**:
   - Criar `apps/web/src/trade/subetapa-refine-03-header-deposit.unit.test.tsx`.
   - Teste 1: Renderização do avatar de 32px.
   - Teste 2: Exibição do rótulo `Cuenta de práctica ▼` com fonte aumentada.
   - Teste 3: Exibição do saldo verde com fonte de 16px e font-family monospace.
   - Teste 4: Renderização do botão `Depositar` com altura de 38px e contraste correto.
   - Teste 5: Invariante de integridade monetária: valores formatados a partir de `balanceMinor` (minor units invioláveis).
   - Teste 6: Teste de estresse com 200 atualizações consecutivas de saldo (sem salto de layout ou quebra).
4. **Execução e Validação**:
   - Executar vitest e registrar relatório em `docs/features/binmax-layout-refinement/relatorios/RELATORIO-SUBETAPA-03.md`.

---

## 3. Critérios de Aceite e Gate

- [ ] Avatar do usuário possui 32px.
- [ ] Rótulo de tipo de conta possui 11px ou mais.
- [ ] Saldo exibido em verde monospaçado de 16px.
- [ ] Botão Depositar possui ~38px de altura com alto contraste.
- [ ] 100% dos testes da subetapa verdes.
