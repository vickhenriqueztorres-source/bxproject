# SUBETAPA 04: Catálogo Frontend, Modal de Ativos IQ, Header & TradingView Feed

> **Status:** HOMOLOGADO E APROVADO (GATE 4 PASS)  
> **Data de Homologação:** 12/10/2026  
> **Responsáveis:** `frontend-realtime-agent`, `iq-fidelity-reviewer`, `binmax-brand-agent`, `surgical-frontend-agent`  
> **Skills Chave:** `01-project-context`, `11-chart-trading-tools`, `12-tokens-binmax`, `13-textos-es`, `17-mudanca-cirurgica`  

---

## 1. Escopo Técnico e Invariantes

1. **Atualização do Catálogo (`apps/web/src/catalog/assets.ts`)**:
   - Atualizar a lista de 6 índices sintéticos com os novos símbolos e nomes oficiais.
   - Atualizar mapa de preços-base `ASSET_BASE_PRICES`.
   - Implementar fallback no `getAssetMeta(symbol)`: se o usuário tiver no `localStorage` um símbolo legado (ex: `SYNTH_VOL_50`), o sistema faz a tradução automática para o novo símbolo correspondente sem travar o gráfico.
2. **Modal Catálogo de Ativos (`AssetCatalogModal.tsx`)**:
   - Renderização limpa com ícones/bandeiras oficiais e tag `Turbo`.
   - Busca em tempo real por nome e símbolo (permitindo encontrar digitando tanto o novo quanto o legado).
   - Abas e filtros respeitando o design Turbo Prata.
3. **Cabeçalho & Abas (`TerminalHeader.tsx`) e Seletor In-Chart**:
   - Exibir o nome limpo formatado no header sem cortar texto em telas menores.
   - Preservar o símbolo padrão inicial da aplicação (`activeSymbol`).

---

## 2. Passo a Passo de Implementação

1. [ ] Atualizar `ASSET_CATALOG` e `ASSET_BASE_PRICES` em `apps/web/src/catalog/assets.ts`.
2. [ ] Adicionar função de normalização de símbolos legados para migração de `localStorage`.
3. [ ] Atualizar componentes visuais (`TerminalHeader.tsx`, `AssetCatalogModal.tsx`, `PriceChart.tsx`).
4. [ ] Rodar suíte de testes unitários do frontend (`pnpm exec vitest run --dir apps/web`).

---

## 3. Matriz de Testes de Estresse, Caos e Segurança

| Código | Tipo de Teste | Descrição | Critério de Aceite |
|---|---|---|---|
| **T-FE-01** | **Migração de LocalStorage** | Simular `localStorage` contendo `broker_active_symbol = 'SYNTH_VOL_50'` e abrir a sala | O front migra transparentemente para o novo símbolo sem tela preta ou erro não tratado. |
| **T-FE-02** | **Desempenho Gráfico 60 FPS** | Alternar rapidamente entre os 6 novos índices a cada 300ms | Lightweight Charts recarrega o histórico sem memory leak e mantém taxa de quadros estável. |
| **T-FE-03** | **Fidelidade Visual IQ Option** | Conferir alinhamento de texto, tags de ganho (+85%) e layout do modal | Zero overflow de texto em espanhol, conformidade com os tokens Turbo Prata. |
| **T-FE-04** | **Prevenção de Duplo Disparo na Boleta** | Abrir ordem rápida em um índice sintético com múltiplos cliques | Botão desabilita durante o processamento, mantendo integridade financeira. |

---

## 4. Gate de Homologação da Subetapa 04

A Subetapa 04 é considerada **HOMOLOGADA** somente quando:
1. Vitest do pacote web passar com 100% de sucesso.
2. O modal do catálogo exibir com perfeição visual os 6 novos índices com seus nomes oficiais.
3. Clicar em qualquer um dos 6 índices abrir a respectiva aba e renderizar as velas e ticks no gráfico em tempo real.
