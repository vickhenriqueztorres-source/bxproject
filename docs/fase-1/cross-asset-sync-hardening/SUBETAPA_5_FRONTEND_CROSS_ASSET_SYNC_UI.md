# Subetapa 5: Frontend Cross-Asset Sync UI & Alinhamento Temporal na Grade

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder:** `frontend-realtime-agent`  
**Agente Revisor:** `broker-architect-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`  
**Invariantes:** M-06 (Experiência de tempo real nos feeds de gráficos)

---

## 1. Escopo e Objetivos da Subetapa
Na interface multi-gráficos (grades 1x1, 2x1, 2x2), fornecer ao trader clareza absoluta sobre o alinhamento temporal entre os ativos exibidos. Quando múltiplos pares estiverem na tela, a interface deve exibir um indicador sutil de sincronização temporal e alertar visualmente caso um dos ativos sofra descompasso de latência maior que 2 segundos em relação aos demais.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 5.1: Mapeador de Sincronização na Grade Multi-Gráficos
- **Ação:** No [`MultiChartGrid.tsx`](file:///D:/brokerproject/apps/web/src/chart/MultiChartGrid.tsx), monitorar os `event_time` mais recentes de todas as células ativas simultaneamente.
- **Critério de Aceite:** Cálculo do maior delta temporal ($\Delta t_{max} = \max(event\_time) - \min(event\_time)$) entre os gráficos visíveis.

### Passo 5.2: Indicador de Sincronização no Cabeçalho da Grade
- **Ação:** Adicionar badge de status temporal na barra de ferramentas:
  * 🟢 **SINCRONIZADO** ($\Delta t < 1000\text{ms}$): Todos os gráficos em paridade.
  * 🟡 **DESCOMPASSO LEVE** ($1000\text{ms} \le \Delta t \le 2000\text{ms}$): Indicação de jitter.
  * 🔴 **DESSINCRONIZADO** ($\Delta t > 2000\text{ms}$): Alerta de divergência de cotação.
- **Critério de Aceite:** O usuário compreende visualmente e de imediato a paridade temporal.

### Passo 5.3: Tag de Latência e Idade por Célula
- **Ação:** No cabeçalho de cada `GridCell`, exibir ao lado do nome do símbolo:
  * Latência estimada em ms (ex: `⚡ 18ms`).
  * Badge de status sincronizado.
- **Critério de Aceite:** Informação transparente e não intrusiva.

### Passo 5.4: Overlay de Descompasso em Gráfico Específico
- **Ação:** Se apenas uma célula estiver defasada em relação ao consenso da grade por mais de 2s, destacar a borda daquela célula em tom âmbar com badge *"Atrasado em relação aos outros pares"*.
- **Critério de Aceite:** Foco claro de qual par está sofrendo atraso.

### Passo 5.5: Crosshair Temporal Sincronizado
- **Ação:** Configurar sincronização de cursor entre gráficos da mesma grade quando o usuário passar o mouse sobre a linha de tempo, garantindo que o ponto temporal comparado seja idêntico.
- **Critério de Aceite:** Análise técnica cruzada com fidelidade de timestamps.

### Passo 5.6: Notificação de Desalinhamento ao Alternar Ativos
- **Ação:** Se o usuário tentar abrir ordem em par que está com alerta de descompasso, emitir aviso preventivo no ticket de negociação.
- **Critério de Aceite:** Zero surpresas financeiras para o usuário.

---

## 3. Testes Obrigatórios da Subetapa
1. **Teste de Grade Sincronizada:** Grade 2x2 com 4 ativos recebendo ticks a 1Hz exibindo status verde "SINCRONIZADO".
2. **Teste de Detecção de Descompasso:** Injetar atraso de 2.5s em uma célula e validar transição para status vermelho "DESSINCRONIZADO".
3. **Teste de Recuperação Instantânea:** Quando o ativo atrasado recebe tick recente, a grade volta para status verde.

---

## 4. Critérios Formais de Aceite (Quality Gate)
- Interface multi-gráficos exibe métricas e status de sincronização temporal.
- Build do Vite sem erros de tipagem.
- Testes automatizados executados e 100% aprovados.
