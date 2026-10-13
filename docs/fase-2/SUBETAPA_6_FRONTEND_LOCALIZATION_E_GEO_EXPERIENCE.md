# SUBETAPA 6: FRONTEND i18n, LOCALIZAÇÃO REGIONAL & EXPERIÊNCIA MULTI-PAÍS

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agentes Executores:** `frontend-realtime-agent`, `chart-trading-engineer`  
**Agentes Revisores e Auditores:** `qa-resilience-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-06`

---

## 1. Objetivo e Escopo

Implementar a camada completa de **Internacionalização (i18n)**, **Multi-Moeda de Exibição** e **Resolução Geográfica na Interface** da aplicação de trading em `apps/web`:
1. **Sistema de i18n Reativo (Português & Espanhol)**:
   - Dicionários completos em `pt-BR` e `es-*` para todas as telas (Terminal de Negociação, Boleta UP/DOWN, Histórico de Ordens, Carteira Demo, Alertas e Modais).
   - Comutação em tempo de execução sem recarregar a página (zero perda de candles ou quebra do WebSocket feed).
2. **Seletor de Moeda e Formatação Regional**:
   - Menu dropdown no cabeçalho com as 6 moedas suportadas (`BRL`, `MXN`, `COP`, `ARS`, `CLP`, `PEN`) e `USD`.
   - Exibição do saldo demo e cálculo do valor do stake na moeda selecionada em tempo real com base nas cotações de referência do backend.
   - Envio inviolável do `stake_minor` original em centavos de USD ao backend no momento do clique em UP ou DOWN.
3. **Tratamento de Geoblocking no Cliente**:
   - Detecção automática de país na inicialização (`GET /api/v1/geo/detect`).
   - Caso o país do usuário seja bloqueado ou desativado por feature flag, a aplicação exibe a tela institucional de bloqueio regional amigável, prevenindo conexões ao WebSocket e chamadas de abertura de contrato.
4. **Catálogo de Ativos com Feeds OTC Demo Reais**:
   - Disponibilização dos 4 pares OTC reais (`BTC/USD`, `ETH/USD`, `EUR/USD`, `XAU/USD`) com suas respectivas precisões no seletor de ativos do terminal.

---

## 2. Invariantes e Boas Práticas de UI

- **I-01 / D-18 (Proteção da Ordem)**: A interface exibe o valor convertido para facilitar a visualização do usuário, mas deixa evidente o valor correspondente em dólares (ex.: `R$ 55,00 (~US$ 10.00)`). A mensagem enviada ao backend no `POST /contracts` sempre contém `stake_minor: 1000` (inteiro em centavos de USD).
- **Sem FOUC (Flash of Unstyled Content / Missing Translation)**: O carregamento de traduções e detecção geográfica não pode exibir chaves cruas de tradução (ex.: `tr.call_button`). Há fallback padrão em português ou espanhol conforme o cabeçalho `navigator.language`.
- **Performance de Gráfico a 60 FPS**: A mudança de idioma ou moeda de exibição nunca destrói a instância do Lightweight Charts ou limpa o cache de velas em memória.

---

## 3. Estrutura de Dicionários de Idioma

```text
apps/web/src/i18n/
├── index.ts              # Provedor e hook useTranslation
├── locales/
│   ├── pt-BR.json        # Dicionário Português (Brasil)
│   └── es-ES.json        # Dicionário Espanhol (América Latina e Espanha)
```

---

## 4. Bateria de Testes Mandatórios

### 4.1 Testes Unitários (`apps/web/test/i18n-currency.test.tsx`)
- Verificação de cobertura total de chaves entre `pt-BR.json` e `es-ES.json` (zero chaves órfãs ou ausentes).
- Comutação de idioma disparando re-renderização precisa de labels.
- Formatação de saldo demo nas 6 moedas regionais.

### 4.2 Testes de Integração (`tests/integration/test-frontend-geoblock-ui.test.ts`)
- Simulação de resposta de geoblocking (HTTP 403 `GEO_BLOCKED`) e renderização imediata da tela de bloqueio com bloqueio de tentativas de negociação.
- Simulação de usuário da Colômbia com idioma espanhol e moeda `COP`, validando a abertura de contrato com stake em USD.

### 4.3 Testes de Performance
- Medição de tempo de troca de idioma e moeda < 16ms (1 frame a 60 FPS).
- Monitoramento de renderização dos gráficos com feeds reais dos 4 pares OTC.

---

## 5. Quality Gate e Critério de Aceite (`GATE-F2-06`)
A Subetapa 6 é considerada HOMOLOGADA exclusivamente se:
1. Toda a interface traduz 100% para Português e Espanhol.
2. As 6 moedas exibem saldos e stakes com fidelidade matemática e sem afetar o contrato em USD.
3. A tela de geoblocking intercepta e protege usuários de regiões não autorizadas.
4. Os 4 ativos OTC reais funcionam no gráfico com cotações vivas.
5. O `post-implementation-verifier` homologa o gate.
