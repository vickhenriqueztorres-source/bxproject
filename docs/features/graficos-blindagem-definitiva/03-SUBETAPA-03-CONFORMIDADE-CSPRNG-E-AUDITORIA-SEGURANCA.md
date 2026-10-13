# SUBETAPA 03: CONFORMIDADE CSPRNG, FÓRMULAS DE MERCADO E AUDITORIA DE SEGURANÇA

> **Responsáveis:** `security-reviewer`, `financial-correctness-reviewer`, `broker-architect-agent`, `qa-resilience-agent`  
> **Arquivos-alvo:**  
> - `apps/web/src/feed/TradingFeedManager.ts`  
> - `services/tick-engine/src/engine/ou-generator.ts`  
> - `services/api/src/routes/contracts.ts`  
> - `services/api/test/contracts.unit.test.ts`  
> - `tests/unit/client-no-simulated-quotes.test.ts`

---

## 1. Problema e Causa Raiz

1. **Violação A-07 de Segurança / Zero Client-Side Simulated Quotes:**
   - O método `startGuestFallback()` em `TradingFeedManager.ts` continha `Math.random()`, violando as regras estritas de segurança M-01 e B-06 (que exigem CSPRNG exclusivamente).
   - O teste de auditoria estrita `tests/unit/client-no-simulated-quotes.test.ts` falhava com código 1.
2. **Divergência na Equação de Ornstein-Uhlenbeck do Backend:**
   - Em `ou-generator.ts`, a equação de drift havia sido alterada para forma exponencial geométrica dividida por basePrice, quebrando os testes matemáticos canônicos em `ou-generator.unit.test.ts`.
3. **Hook Indefinido no Fastify em Testes Unitários de Contrato:**
   - Em `contracts.unit.test.ts`, o mock de servidor não definia `enforceTradingEnabled`, resultando em `FST_ERR_HOOK_INVALID_HANDLER`.

---

## 2. Solução Técnica Arquitetural

1. **Substituição de `Math.random()` por CSPRNG Web Crypto:**
   - Implementar helper CSPRNG universal no client (`crypto.getRandomValues`) para gerar números uniformes no intervalo `(0, 1]` sem tocar em `Math.random`.
   - Garantir 0 violações no scanner de código do teste `client-no-simulated-quotes.test.ts`.
2. **Harmonização da Equação de Ornstein-Uhlenbeck:**
   - Restaurar a fórmula canônica de Euler-Maruyama para a SDE do motor OTC:
     ```typescript
     const drift = this.theta * (this.basePrice - this.currentPrice) * this.dt;
     const diffusion = this.sigma * this.currentPrice * Math.sqrt(this.dt) * z;
     const next = this.currentPrice + drift + diffusion;
     ```
   - Manter as barreiras de proteção de preço estritamente positivo e clamping a 10% e 1000% do preço base.
3. **Blindagem de Hooks Fastify:**
   - Filtrar hooks condicionais em `services/api/src/routes/contracts.ts` e adicionar mock de fallback em `buildTestApp`.

---

## 3. Plano de Testes (Subetapa 03)

- **Teste 3.1 (Auditoria A-07):** Execução do scanner de código estático `tests/unit/client-no-simulated-quotes.test.ts` garantindo zero ocorrências de `Math.random` em `apps/web/src`.
- **Teste 3.2 (Testes de Reversão à Média):** Executar `services/tick-engine/test/ou-generator.unit.test.ts` comprovando que os 3 testes unitários passam com precisão decimal exata.
- **Teste 3.3 (Rotas de Contrato):** Executar `services/api/test/contracts.unit.test.ts` comprovando aprovação das 5 suites de teste.
