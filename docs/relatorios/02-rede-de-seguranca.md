# Relatório 02 — Rede de Segurança e Chave da Sala Nova

**Data de Execução:** 08 de Outubro de 2026  
**Status:** CONCLUÍDO COM SUCESSO  
**Objetivo:** Criação da infraestrutura de proteção, testes de fumaça e controle da feature flag `NEW_TRADEROOM`.

---

## 1. Resumo Executivo
Criada a rede de segurança da plataforma, consistindo no módulo `apps/web/src/lib/feature-flags.ts`, na injeção da classe escopada `.theme-binmax` em `TerminalLayout.tsx` e em uma suíte com 6 novos testes de fumaça cobrindo a feature flag, conversão de stake, integridade do catálogo e piso de expiração de 30s. Toda a suíte de 57 testes vitest está 100% verde.

---

## 2. Arquivos Alterados / Criados

| Arquivo | Ação | Linhas | O que mudou |
|---|---|---|---|
| `apps/web/src/lib/feature-flags.ts` | Criado | +55 | Implementação da função `isNewTraderoomEnabled` e `setNewTraderoomEnabled` com suporte a URL, storage e fallback |
| `apps/web/src/components/layout/TerminalLayout.tsx` | Alterado | +2 / -1 | Aplicação condicional da classe `.theme-binmax` no contêiner da sala |
| `apps/web/src/trade/smoke.unit.test.ts` | Criado | +60 | 6 testes de fumaça de base para regressão |

---

## 3. Decisões dos Agentes

- **Guardião de Regressão:** Aprovado. Nenhuma dependência externa adicionada, nenhum arquivo em zona vermelha modificado.
- **Mapeador:** Aprovado. A feature flag opera como ponto único de chaveamento na casca do layout, permitindo fallback instantâneo via `?ui=legacy`.
- **Compliance e Risco:** Aprovado. Invariantes de piso de 30s e safe UUID validados no teste.
- **Engenheiro de Prompt:** Etapa concluída com sucesso.

---

## 4. Testes Rodados e Resultados

- **Comando:** `npx vitest run --dir apps/web`
- **Resultado:** **10 arquivos de teste, 57 testes executados, 57 aprovados (100% verde)**.
- **Comando de Build:** `npm run build --prefix apps/web` -> Compilado sem erros.

---

## 5. Como Ligar e Desligar a Chave

- **Ligar:** Acesse com `?theme=binmax` ou `?ui=binmax`, ou execute no console: `localStorage.setItem('NEW_TRADEROOM', 'true')`.
- **Desligar (Fallback):** Acesse com `?ui=legacy` ou `?theme=legacy`, ou execute no console: `localStorage.setItem('NEW_TRADEROOM', 'false')`.

---

## 6. Riscos Conhecidos e Plano de Volta
- Risco zero: a classe `.theme-binmax` é puramente aditiva e os componentes conservam seus seletores de fallback.
