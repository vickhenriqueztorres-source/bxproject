# Plano de Correção e Unificação Monetária (USD) no Order Ticket da BINMAX

**Documento Oficial de Engenharia e Orquestração**  
**Data:** 11/10/2026  
**Orquestrador:** `tech-lead-orchestrator`  
**Agentes Responsáveis:** `financial-correctness-reviewer`, `compliance-risk-reviewer`, `surgical-frontend-agent`, `qa-resilience-agent`, `regression-guardian-agent`  
**Skills Acionadas:** `01-project-context`, `02-financial-invariants`, `12-tokens-binmax`, `13-textos-es`, `17-mudanca-cirurgica`, `18-zonas-sensiveis`, `06-testing-quality`, `19-testes-de-regressao-visual`

---

## 1. Causa Raiz do Problema ("Por que está R$ se a conta toda é USD?")

### Diagnóstico Forense:
1. **Origem do Símbolo Residual `R$`**:
   - No componente `apps/web/src/trade/OrderTicket.tsx`, linha 309, o símbolo monetário ao lado do campo de entrada de stake (`#binmax-stake-input`) foi codificado estaticamente como:
     ```tsx
     <span style={{ color: '#596273', fontSize: '13px', fontWeight: 600 }}>
       R$
     </span>
     ```
   - Trata-se de um resquício estático inserido durante prototipação inicial em reais brasileiros (BRL), o qual não foi alinhado com a unificação monetária em dólares.

2. **Inconsistência de Idioma e Rótulo**:
   - Na linha 238 de `OrderTicket.tsx`, o rótulo superior exibia `"Valor"` (em português), enquanto:
     - O bloco de expiração exibe `"Expiración"` (espanhol).
     - O bloco de lucro exibe `"Ganancia"` (espanhol).
     - Os botões de ordem exibem `"SUBE"` e `"BAJA"` (espanhol).
     - Os atributos de acessibilidade já utilizavam `"Monto"` (`data-testid="ticket-block-monto"`, `aria-label="Monto de la inversión"`, `aria-label="Ayuda monto"`).
     - A especificação da Subetapa 18-02 e o vocabulário oficial da Binmax estipulam o termo `"Monto"`.

3. **Invariante Financeira Violada (D-18)**:
   - A decisão institucional **D-18** (`01-project-context`) estabelece:
     > *"Moeda da carteira demo: USD, inteiro em centavos (1_000_000 = US$ 10.000,00); exibição pt-BR / institucional Binmax"*
   - O saldo da conta Demo no cabeçalho exibe `$10,000.00` (USD).
   - O cálculo de Ganancia exibe `+$85.00` (USD) com base no stake de `$100`.
   - Os botões rápidos de preset (`10`, `50`, `100`, `500`) representam stakes em dólares ($10, $50, $100, $500).
   - O ledger Blnk no backend debita e credita contas em centavos de USD.
   - Portanto, a exibição de `R$` criava uma grave divergência cognitiva e regulatória, sugerindo que o usuário apostava em reais enquanto a conta e os payouts operavam em dólares.

---

## 2. Visão Geral das Subetapas

O plano de remediação é dividido em 6 subetapas sequenciais e estritamente auditáveis. Cada subetapa deve ser validada e atestada com 100% de sucesso antes do avanço para a seguinte:

- **Subetapa 01: Auditoria Forense, Mapeamento Completo e Linha de Base (Baseline)**
- **Subetapa 02: Especificação e Criação da Suíte de Testes TDD do OrderTicket (Unidade & Rótulos)**
- **Subetapa 03: Implementação Cirúrgica em Frontend (`OrderTicket.tsx`) com Dif Mínimo**
- **Subetapa 04: Bateria de Testes de Estresse, Caos e Resiliência de Entrada**
- **Subetapa 05: Auditoria de Segurança, Invariantes Financeiras e Integridade Client-Server**
- **Subetapa 06: Homologação Final de Não-Regressão e Certificação de Fechamento**

---

## 3. Detalhamento Passo a Passo de Cada Subetapa

### Subetapa 01: Auditoria Forense, Mapeamento Completo e Linha de Base
- **Objetivo:** Mapear todos os pontos do código afetados e registrar o estado inicial dos testes (baseline verde com 366 testes passando).
- **Ações:**
  1. Varredura recursiva de strings `R$` e de moedas no repositório.
  2. Confirmação de que apenas `OrderTicket.tsx:309` possui a inconsistência ativa no fluxo de trading.
  3. Verificação de zonas sensíveis (`docs/zonas-sensiveis.md`): o arquivo `OrderTicket.tsx` interage com abertura de contratos, portanto qualquer alteração deve limitar-se à renderização visual do stake e rótulo, sem alterar o cálculo do `stakeMinor` nem a assinatura de `openContract`.
- **Critério de Aceite da Subetapa 01:**
  - Diagnóstico confirmado, sem arquivos estranhos afetados, baseline documentada.

---

### Subetapa 02: Especificação e Criação de Testes TDD Dedicados
- **Objetivo:** Criar testes automatizados que comprovem a correção antes e depois, validando o símbolo `$`, o rótulo `Monto`, a acessibilidade e a consistência com `formatCurrencyBinmax`.
- **Ações:**
  1. Criar arquivo de teste `apps/web/src/trade/order-ticket-currency-unification.unit.test.tsx`.
  2. Implementar asserções determinísticas:
     - `expect(html).toContain('>$<')` ou símbolo monetário exato `$` no container de stake.
     - `expect(html).not.toContain('R$')`.
     - `expect(html).toContain('Monto')` como nó textual visível no cabeçalho do bloco.
     - `expect(html).not.toMatch(/<span[^>]*>\s*Valor\s*<\/span>/)` (eliminação de "Valor" residual).
     - Validação de que presets `10`, `50`, `100`, `500` correspondem a stakes em USD.
- **Critério de Aceite da Subetapa 02:**
  - Testes novos escritos e falhando especificamente onde o código antigo ainda possui `R$` e `Valor`, ou prontos para validar a transição.

---

### Subetapa 03: Implementação Cirúrgica em Frontend (`OrderTicket.tsx`)
- **Objetivo:** Aplicar o menor diff possível em `apps/web/src/trade/OrderTicket.tsx`.
- **Ações:**
  1. Linha 238: Alterar `<span ...>Valor</span>` para `<span ...>Monto</span>`.
  2. Linha 309: Alterar `<span ...>R$</span>` para `<span ...>$</span>`.
  3. Manter a largura, gap (`gap: '3px'`), cores institucionais (`#596273` para o símbolo `$`, `#8A92A1` para o rótulo) e tipografia `Geist Mono` / `Inter`.
- **Critério de Aceite da Subetapa 03:**
  - Diff restrito a poucas linhas; visual idêntico ao padrão institucional da Binmax; teste TDD da Subetapa 02 passando 100%.

---

### Subetapa 04: Bateria de Testes de Estresse, Caos e Resiliência de Entrada
- **Objetivo:** Garantir que o campo de stake e a boleta suportem rajadas de interação, valores extremos e tentativas de corrupção.
- **Ações:**
  1. **Teste de Estresse (High-Frequency Renders & State Transitions)**:
     - Renderizar 500 ciclos consecutivos de montagem/desmontagem e troca de stake em menos de 1000ms.
     - Simular cliques ultrarrápidos nos seletores de preset (`10` -> `500` -> `50` -> `100`) verificando atualização instantânea sem race condition visual.
  2. **Teste de Caos e Sanitização de Entrada**:
     - Submeter entradas hostis: strings com `R$ 100`, `$100`, `-50`, `0`, `0.01`, `999999999`, strings vazias, caracteres especiais, tags HTML `<script>`.
     - Garantir que `parseStakeInput` descarte valores inválidos (retornando `null`) e que o ticket bloqueie o disparo de ordens (botões SUBE/BAJA desabilitados).
  3. **Teste de Limites (Boundary Invariants)**:
     - Stake mínimo: $1.00 (`100` centavos).
     - Stake máximo: $100.00 (`10000` centavos).
     - Saldo insuficiente: quando `availableMinor < stakeMinor`, botões permanecem `disabled`.
- **Critério de Aceite da Subetapa 04:**
  - Todos os testes de estresse, caos e boundaries executados e aprovados com 100% de sucesso.

---

### Subetapa 05: Auditoria de Segurança e Invariantes Financeiras
- **Objetivo:** Assegurar que nenhuma premissa de segurança ou financeira foi violada.
- **Checagens:**
  - **I-01 a I-06**: Nenhuma alteração no fluxo contábil do Blnk, nem na geração de chaves de idempotência (`Idempotency-Key`).
  - **D-18**: Coerência absoluta: Front-end exibe USD (`$`), Backend processa USD (`cents`), Blnk registra USD.
  - **S-01 a S-06**: O cliente não determina preço de execução, nem resultado, nem saldo. O stake é repassado em centavos validados pelo servidor.
- **Critério de Aceite da Subetapa 05:**
  - Parecer formal de aprovação do `financial-correctness-reviewer` e do `security-reviewer`.

---

### Subetapa 06: Homologação Final de Não-Regressão e Fechamento
- **Objetivo:** Provar matematicamente que nenhuma funcionalidade do sistema foi danificada.
- **Ações:**
  1. Execução de toda a suíte de testes do projeto (`npx vitest run`).
  2. Verificação de retrocompatibilidade com a flag `NEW_TRADEROOM=false` (modo legado permanece com `$`).
  3. Relatório final consolidado para o usuário.
- **Critério de Aceite da Subetapa 06:**
  - 100% dos testes passando sem falhas (zero regressões).
