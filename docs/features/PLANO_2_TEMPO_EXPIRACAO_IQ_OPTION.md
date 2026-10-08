# PLANO 2 — Tempo de Expiração Estilo IQ Option
## Detalhamento Completo, Subetapas e Bateria de Testes

---

## 1. Engenharia Reversa do Modelo de Expiração da IQ Option

### 1.1. Estrutura Visual e Comportamental
Conforme a imagem fornecida pelo usuário (`media_1791410914950.png`):
1. **Header do Menu**: `Time / Remaining`
2. **Item 1 (1M - Fim da Vela Atual / Próxima Vela)**:
   - Exemplo da imagem: `🕒 19:05 | 1M | in 01:23`
   - **Regra de Corte de 30 Segundos**:
     - Cada vela de 1 minuto fecha no segundo `:00`.
     - Entre o segundo `:00` e `:30`, o contrato expira no fim da vela atual (`:00` do próximo minuto).
     - Quando o relógio passa de `:30` (ex: `:31` a `:59`), a compra da vela atual é travada e a opção oferecida salta para o fim da vela subsequente (`+1m`), garantindo que o trader sempre tenha pelo menos 30 segundos de duração.
3. **Item 2 (5M - Fim da Vela de 5 Minutos)**:
   - Exemplo: `🕒 19:05 | 5M | in 01:23` (ou próximo múltiplo de 5 min: `19:10`).
4. **Item 3 (15M - Fim da Vela de 15 Minutos)**:
   - Exemplo: `🕒 19:15 | 15M | in 11:23`.
5. **Opções Rápidas (Turbo)**:
   - Expirações de 1 minuto corrido (60s), 2 minutos (120s), 5 minutos (300s).

### 1.2. Plano Geral vs. Plano Secundário
- **Plano Geral (Principal)**:
  - Dropdown idêntico à IQ Option acoplado ao card de Expiração da boleta (`OrderTicket.tsx`).
  - Timer reativo atualizado a cada 250ms com contagem decrescente no formato `in MM:SS`.
  - Duas linhas verticais renderizadas no gráfico pelo `TimeLinesOverlay.tsx`:
    - **Linha de Compra (Branca tracejada)**: Ponto de corte 30 segundos antes do fechamento.
    - **Linha de Expiração (Vermelha sólida com ícone de relógio)**: Momento exato da liquidação.
  - O contrato armazena `expires_at` (ISO timestamp absoluto) e `duration_seconds` no backend. O settlement worker apura no tick exato onde `tick.ts >= contract.expires_at`.
- **Plano Secundário (Fallback)**:
  - Seletor de botões segmentados (Chips) diretamente no corpo da boleta (`1m`, `5m`, `15m`, `Vela`), simplificando a interface para telas mobile menores.

---

## 2. Divisão em Subetapas Detalhadas

### Subetapa 2.1: Utilitário de Cálculo Temporal de Expiração
- **Objetivo**: Criar módulo matemático `apps/web/src/trade/expiry-calculator.ts` com funções puras:
  - `getNextCandleExpiry(targetMinutes: number, now: Date): { targetTime: Date, remainingSeconds: number, label: string }`
  - Implementação exata da regra dos 30 segundos de corte.
  - Suporte aos slots 1M, 5M, 15M e durações fixas 60s, 120s, 300s.

### Subetapa 2.2: Componente de Dropdown IQ Option na Boleta
- **Objetivo**: Substituir o card fixo de 60s em `OrderTicket.tsx` por um seletor clicável que abre o dropdown idêntico à imagem de referência:
  - Relógio de parede atualizado em tempo real;
  - Slots de tempo organizados com separador;
  - Indicador de status (Aberto vs Próxima Vela);
  - Fechamento com `Escape` ou clique fora.

### Subetapa 2.3: Sincronização com o Gráfico (TimeLinesOverlay)
- **Objetivo**: Atualizar `TimeLinesOverlay.tsx` para posicionar dinamicamente a Linha de Compra e a Linha Vermelha de Expiração no timestamp exato do slot selecionado pelo usuário na boleta.
- **Rótulos**: Exibir tooltip flutuante sobre a linha com o tempo restante regressivo.

### Subetapa 2.4: Suporte no Backend e Settlement Worker
- **Objetivo**: Garantir que `POST /contracts` no backend e no mock receba `duration_seconds` e `target_expires_at`:
  - Cálculo oficial do `expires_at` no servidor para prevenir manipulação por parte do cliente;
  - O Settlement Worker programa a liquidação para o momento exato e avalia contra o tick oficial correspondente.

---

## 3. Matriz de Testes Exaustivos

### 3.1. Testes de Estresse
- Abertura de 50 ordens consecutivas com durações diferentes (10 ordens de 1M, 10 de 5M, 10 de 15M, 20 de fim de vela).
- Todas devem ser liquidadas em seus respectivos momentos sem que uma atrase a outra.

### 3.2. Testes de Caos
- **Simulação de Clock Drift do Cliente**: Adiantar ou atrasar o relógio do navegador em 10 minutos. O backend deve validar e impor o horário autêntico do servidor, sem permitir ordens que expirem no passado ou burlem a regra dos 30 segundos.
- **Perda e Reconexão de Rede**: Desconectar o cabo de rede durante a contagem regressiva e reconectar 10 segundos depois. O estado da ordem deve ressincronizar com o backend e liquidar corretamente.

### 3.3. Testes de Integridade Financeira
- Verificação das regras I-01 a I-06: garantia de que o saldo demo só é deduzido uma vez na abertura e creditado pontualmente na liquidação, independentemente da duração do contrato.

### 3.4. Critérios de Aceite para Fechamento do Gate 2
- [ ] Dropdown abre e fecha com visual idêntico ao da imagem IQ Option.
- [ ] Contagem regressiva `in MM:SS` decrementa perfeitamente segundo a segundo.
- [ ] Ao passar de :30s na vela de 1M, o seletor avança automaticamente para a próxima vela.
- [ ] A linha vermelha de expiração no gráfico reflete o tempo exato selecionado.
- [ ] A ordem é aberta e liquidada com sucesso no backend após a duração escolhida.
