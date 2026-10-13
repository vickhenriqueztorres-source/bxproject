# SUBETAPA 8: BATERIA COMPLETA DE TESTES DE ESTRESSE, SEGURANÇA, CAOS E REGRESSÃO

> **Orquestrador:** `tech-lead-orchestrator`  
> **Agentes Envolvidos:** `qa-resilience-agent`, `regression-guardian-agent`, `security-reviewer`, `financial-correctness-reviewer`  
> **Skills Aplicadas:** `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification`, `19-testes-de-regressao-visual`

---

## 1. Objetivo da Bateria de Homologação Final
Executar a prova matemática e operacional definitiva de que a nova Traderoom cumpre 100% dos requisitos visuais das 4 imagens, sem regressões funcionais, com taxa de quadros a 60 FPS, resiliência contra falhas de rede e inviolabilidade financeira.

**Regra Suprema:** *"NUNCA IMPLEMENTE NADA SEM TESTES ROBUSTOS."*

---

## 2. As 5 Matrizes de Testes Obrigatórias

```
               ┌────────────────────────────────────────────────────────┐
               │    Bateria de Certificação Traderoom Perfection         │
               └──────────────────────────┬─────────────────────────────┘
                                          │
       ┌──────────────────┬───────────────┴───────────────┬──────────────────┐
       ▼                  ▼                               ▼                  ▼
┌──────────────┐   ┌──────────────┐                ┌──────────────┐   ┌──────────────┐
│  1. Estresse  │   │ 2. Segurança  │                │   3. Caos    │   │ 4. Regressão │
│  (60 FPS/Carga)│  │ (Ledger/Invar)│                │ (Quedas/Skew)│   │ (Duas Portas)│
└──────────────┘   └──────────────┘                └──────────────┘   └──────────────┘
```

### 2.1 Matriz 1: Testes de Estresse & Performance Gráfica (QA & Engenheiro Gráfico)
- **E-01 Taxa de Quadros (Sacred 60 FPS):** Rajada contínua de 100 ticks/s por 30 segundos. O `RafChartUpdater` deve garantir que a taxa de quadros nunca caia abaixo de 58 FPS, com tempo de frame médio $\le 16.6\text{ms}$.
- **E-02 Limite de Memória e Retenção de Velas:** Ingestão de 3.500 velas OHLCV em janela deslizante. Monitoramento de heap JavaScript comprovando ausência de vazamento de memória após 500 ciclos de renderização.
- **E-03 Sobrecarga de Desenhos Vetoriais:** Renderização simultânea de 50 linhas de tendência e retrações de Fibonacci mantendo resposta tátil de zoom e pan sem travamento.

### 2.2 Matriz 2: Testes de Segurança & Invariantes Financeiros (Security & Finance Reviewer)
- **S-01 Imutabilidade de Saldo:** Tentativa de alteração de saldo através de script no console do navegador (`window.localStorage` ou injeção em store). O backend e o Blnk Ledger rejeitam qualquer ordem cujo saldo real seja insuficiente.
- **S-02 Não-Manipulação de Preço/Resultado:** Garantia de que a cotação de entrada (`entry_price`) e a apuração de resultado (`WIN`/`LOSS`) são apuradas exclusivamente pelo primeiro tick oficial persistido no banco de dados onde `ts >= expires_at`.
- **S-03 Idempotência Estrita de Ordens:** Envio concorrente de 20 requisições `POST /contracts` com a mesma `Idempotency-Key`. Exatamente 1 contrato é registrado e 19 requisições recebem a resposta cached original sem duplicar débito de saldo.

### 2.3 Matriz 3: Testes de Caos & Resiliência de Rede (QA Resilience Agent)
- **C-01 Queda Abrupta do WebSocket Gateway:** Simulação de interrupção de socket a cada 5 segundos. O cliente ativa o circuit breaker defensivo, exibe o pill discreto de reconexão e reestabelece a assinatura com catch-up de ticks via `lastSequence` sem tela preta.
- **C-02 Detecção de Gap de Ticks:** Injeção intencional de salto de sequência (`seq: 1` para `seq: 20`). O feed suspende renderização destrutiva e dispara snapshot REST imediatamente, drenando o buffer sem corromper as velas do gráfico.
- **C-03 Corrupção de LocalStorage:** Injeção de strings corrompidas (`null`, `undefined`, caracteres unicode quebrados) nas chaves de configurações e ferramentas de desenho. A recuperação é 100% graciosa para valores padrão seguros.

### 2.4 Matriz 4: Teste "Duas Portas" & Regressão Funcional (Regression Guardian)
- **R-01 Comportamento com Feature Flag DESLIGADA (`NEW_TRADEROOM = false`):**
  - O terminal carrega o layout legado original.
  - Todas as funções de contrato, histórico e saldo funcionam de forma idêntica à base pré-etapa.
- **R-02 Comportamento com Feature Flag LIGADA (`NEW_TRADEROOM = true`):**
  - A interface adota os tokens Turbo Prata e layout das Imagens 1, 2 e 3.
  - Zero vazamento de CSS entre os dois modos.

---

## 3. Script Automatizado de Homologação Final
Será criado o executor unificado:
`tests/test-traderoom-perfection-final-certification.mjs`

Este script executará em sequência:
1. Verificação estática de tipos (`tsc --noEmit`).
2. Suíte de testes unitários (`vitest run apps/web/src/trade/`).
3. Verificação de build de produção (`pnpm --filter @broker/web build`).
4. Testes de estresse de renderização e coalescência rAF.
5. Emissão do Relatório Formal de Certificação em `docs/relatorios/traderoom-perfection-final-report.md`.

---

## 4. Critérios de Aprovação Invioláveis (Gate de Conclusão)
- [ ] 100% dos testes unitários e de integração verdes (0 falhas).
- [ ] Build de produção gerado com sucesso sem warnings de tipagem.
- [ ] Relatório final assinado pelos 8 agentes do pool.
- [ ] Aprovação humana final antes de qualquer merge na branch principal.
