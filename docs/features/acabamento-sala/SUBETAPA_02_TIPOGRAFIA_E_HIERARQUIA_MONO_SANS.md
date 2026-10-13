# SUBETAPA 02 — TIPOGRAFIA, HIERARQUIA VISUAL E UNIFICAÇÃO MONETÁRIA
## Racionalização da Tipografia Monoespaçada, Hierarquia de Pesos e Padronização Monetária ($185.00)

**Data:** 09/10/2026  
**Responsáveis:** `binmax-brand-agent`, `compliance-risk-reviewer`, `surgical-frontend-agent`  
**Escopo de Arquivos Autorizados:**
- `apps/web/src/trade/OrderTicket.tsx`
- `apps/web/src/components/drawer/PortfolioDrawer.tsx`
- `apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx`
- `apps/web/src/components/footer/TerminalFooter.tsx`
- `apps/web/src/lib/money.ts`

---

## 1. Objetivos Técnicos e Mudanças Cirúrgicas

1. **Racionalização da Fonte Monoespaçada (Fim da Cara de Terminal):**
   - **Regra de Ouro:** `Geist Mono` é restrita exclusivamente a:
     - Preço atual e ticks em tempo real.
     - Saldo da conta (demo e real).
     - Relógio da sessão/servidor.
     - Valor numérico das operações abertas (strike e montante em curso).
   - Todo o resto (rótulos "Monto", "Expiración", "Ganancia", "Portafolio total", "Ganancia de hoy", cabeçalhos de gaveta e tooltips) deve usar fonte sans-serif institucional (`Inter` / `Archivo`).
2. **Hierarquia Tipográfica e de Pesos:**
   - Rótulos e descrições auxiliares: 12px cinza `#8A94A6`, peso regular/médio (400/500).
   - Valores secundários e inputs: 15px-16px branco `#F4F5F7`, peso semi-bold (600).
   - Payout em destaque: 22px-24px bold (700/800) em `#22C55E`.
3. **Unificação Monetária Universal:**
   - Eliminar formatos conflitantes como `US$ 185,00` e `R$`.
   - Padronizar toda a exibição no padrão universal em espanhol: `$185.00` (ex: `+$185.00`, `-$10.00`, `$10,000.00`).

---

## 2. Passo a Passo de Execução

- **Passo 2.1:** Revisar `OrderTicket.tsx`:
  - Retirar `fontFamily: "'Geist Mono', monospace"` dos títulos e rótulos de campos.
  - Aplicar rótulos em 12px cinza `#8A94A6` com peso 500.
  - Ajustar o payout `+85%` para 22px bold.
  - Formatar montantes com o padrão `$185.00`.
- **Passo 2.2:** Revisar `PortfolioDrawer.tsx` e `BinmaxPortfolioDrawer.tsx`:
  - Rótulos e cabeçalhos de colunas em sans-serif.
  - Manter mono apenas nas colunas de valores e tempo numérico restante.
  - Formatação monetária padronizada com cifrão antes do número sem `US$`.
- **Passo 2.3:** Revisar `TerminalFooter.tsx`:
  - "Portafolio total" e "Ganancia de hoy" com rótulos em sans e apenas o número em mono.

---

## 3. Protocolo de Testes e Validação

### Testes de Estresse e Overflow Textual
- **STRESS-01 (Large Number Boundary):** Testar renderização de valores altos como `$999,999,999.00` em tela de 1024px sem quebra de layout ou invasão de botões adjacentes.
- **STRESS-02 (Rapid Expiry Fluctuation):** Verificar que a alternância rápida de tempo não altera a largura dos containers (usando tabular-nums quando apropriado).

### Testes de Integridade Financeira
- **SEC-02 (String Formatting Integrity):** Garantir que a formatação visual não altere os inteiros `minor` enviados para a API de contratos e da carteira.

---

## 4. Critérios de Aceite para Fechamento da Subetapa

- [ ] Apenas valores numéricos críticos utilizam Geist Mono.
- [ ] Rótulos "Monto", "Expiración", "Ganancia" em sans 12px `#8A94A6`.
- [ ] Moeda padronizada exclusivamente em `$X.XX` sem `US$`.
- [ ] Novo arquivo de teste unitário `apps/web/src/trade/subetapa-18-02-tipografia-moeda.unit.test.tsx` com 100% de aprovação.
