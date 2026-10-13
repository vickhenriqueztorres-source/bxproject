# Subetapa 04: Bateria de Testes de Estresse, Caos e Regressão

## 1. Escopo de Validação
Esta subetapa submete todas as 3 correções a uma bateria de validação unificada contra regressões:
1. **Estresse de Linhas de Preço**: 1.000 oscilações consecutivas de preço com alternância de `priceDirection` sem criar mais de 1 linha.
2. **Caos de Troca Rápida de Ativos**: Comutação cíclica entre 10 ativos com ordens de grandeza díspares (BTCUSD 64.000 vs AUDUSD 0.65 vs SYNTH 1.000) sem vazamento de linhas e sem distorção de escala Y.
3. **Validação do Catálogo**: Garantia de integridade de todos os 36 ativos com seus preços base reais.
4. **Alinhamento Temporal das Linhas**: Prova matemática das coordenadas de tempo nos timeframes 5s, 15s, 30s, 1m, 5m.
5. **Regressão Global**: Execução completa da suíte monorepo (353+ testes do Vitest e testes de backend) assegurando 100% de sucesso.

## 2. Critérios de Pronto (Definition of Done)
- 100% dos testes unitários e de integração verdes.
- Zero advertências de perda de contexto ou lints pendentes.
- Build do TypeScript (`tsc`) concluído sem erros em todos os pacotes.
