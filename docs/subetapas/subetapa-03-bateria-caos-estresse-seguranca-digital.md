# Subetapa 03: Bateria de Certificação, Estresse, Caos, Segurança e Invariantes

> **Orquestrador**: `tech-lead-orchestrator`  
> **Agente de Testes e Resiliência**: `qa-resilience-agent`  
> **Revisor de Segurança**: `security-reviewer`  
> **Revisor de Compliance e Risco**: `compliance-risk-reviewer`  
> **Guardião de Regressão**: `regression-guardian-agent`  
> **Skills Ativas**: `06-testing-quality`, `02-financial-invariants`, `04-security-iam`, `05-resilience-patterns`, `19-testes-de-regressao-visual`

---

## 1. Contexto e Objetivo Técnico
Realizar a validação exaustiva da alteração da nomenclatura "Turbo" para "Digital" através de uma suíte especializada de testes de estresse, segurança contra injeções, simulação de caos operacional e validação de invariantes financeiras e de integridade de dados.

---

## 2. Cenários da Bateria de Testes
1. **Cenário 1: Estresse de Catálogo Massivo (High Density & Fast Filtering)**
   - Simular catálogo com grande volume de ativos e filtros ultrarrápidos (digitação de buscas fragmentadas em alta frequência).
   - Garantir que cada item preserva o badge "Digital", o símbolo correto, e que não há memory leaks ou estouro de layout/scroll.
2. **Cenário 2: Segurança e Sanitização contra Injeções (XSS / Parameter Tampering)**
   - Submeter o input de busca do `AssetCatalogModal` a payloads maliciosos (`<script>`, SQL fragments, caracteres unicode fora de padrão).
   - Garantir sanitização estrita, ausência de falhas ou quebras no filtro de string.
3. **Cenário 3: Integridade de Invariantes Financeiras (Preservação de Payout e Parâmetros)**
   - Comprovar que a alteração de rótulo para "Digital" não modifica nem contamina o `payout` (permanece +85% ou valor do catálogo), não altera `stake_minor`, não afeta o payload de abertura de contrato e não adultera os IDs/símbolos enviados ao backend.
4. **Cenário 4: Caos de Abertura e Fechamento Rápido do Modal**
   - Disparar 50 ciclos sequenciais e concorrentes de abertura (`isOpen = true`), clique em item e fechamento via backdrop/ESC.
   - Confirmar que o evento `onSelectAsset` é disparado exatamente 1 vez com o símbolo intocado e que não sobram listeners presos na `window`.
5. **Cenário 5: Verificação Global de Não-Regressão**
   - Executar a bateria completa de testes vitest do repositório relacionados ao catálogo, header e gráficos.

---

## 3. Passo a Passo de Implementação
1. Criar o arquivo de testes dedicado:
   - `apps/web/src/trade/subetapa-03-asset-catalog-digital-caos-seguranca.unit.test.tsx`
2. Implementar os 5 cenários com asserções estritas e validação determinística.
3. Executar o teste via Vitest e assegurar 100% de aprovação verde.
4. Gerar relatório de evidências com métricas de tempo e assertividade.
