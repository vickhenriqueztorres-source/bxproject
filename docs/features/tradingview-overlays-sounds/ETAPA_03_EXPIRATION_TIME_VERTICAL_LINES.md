# Subetapa 3: Linhas Verticais de Tempo (Hora de Compra & Expiração)

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `frontend-realtime-agent`  
**Especialista em Mercados:** `broker-architect-agent`  
**QA & Resiliência:** `qa-resilience-agent`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 3 APROVADO)  

---

## 1. Objetivo da Etapa
Projetar sobre o gráfico as duas linhas verticais clássicas da IQ Option:
1. **Linha Branca Tracejada ("Hora de Compra")**:
   - Marca a marca d'água dos últimos 30 segundos da vela atual.
   - Ponto após o qual novas ordens são travadas para a vela em curso.
   - Acompanhada de uma tag superior *"Hora de compra"*.
2. **Linha Vermelha de Expiração**:
   - Marca o fechamento exato da vela (:00s) onde o contrato atual será liquidado pelo primeiro tick oficial do banco de dados.
   - Acompanhada de uma tag superior *"Expiração"* e relógio em contagem regressiva viva.

---

## 2. Especificação Técnica
- Projeção de coordenadas horizontais $X$ sincronizadas com o tempo do ciclo de 60s da vela:
  - $X_{\text{compra}} = \text{Tempo Atual} + \text{Segundos restantes até a trava (:30s)}$.
  - $X_{\text{expiracao}} = \text{Tempo Atual} + \text{Segundos restantes até o fechamento (:00s)}$.
- Estilos visuais:
  - Linha de Compra: `stroke: #ffffff`, `stroke-dasharray: 4,4`, tag superior com fundo branco e texto escuro.
  - Linha de Expiração: `stroke: #ff3d71`, `stroke-width: 2px`, tag superior vermelha com relógio decrescente.

---

## 3. Matriz de Testes & Validação da Etapa 3

### A. Teste de Sincronia Temporal
- Ao virar o minuto (de :59s para :00s):
  - As linhas devem se deslocar instantaneamente para o próximo ciclo de 60s sem falhas ou sobreposições.

### B. Teste de Caos (Desconexão e Relógio Dessincronizado)
- O cálculo deve usar o tempo do servidor/ticks recebidos, evitando saltos mesmo se o relógio da máquina do usuário estiver ligeiramente defasado.

---

## 4. Critérios de Passagem (Quality Gate 3)
- [ ] Linha branca tracejada e linha vermelha visíveis no gráfico.
- [ ] Contagem regressiva na tag de expiração decrescendo segundo a segundo.
- [ ] Reset perfeito ao virar o minuto da vela.
