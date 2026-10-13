# SUBETAPA 02: SELETOR DE ATIVOS DEDICADO & MULTI-ABAS TURBO (SESSÃO 2)

**Objetivo:** Implementar o Seletor de Ativos flutuante de alta fidelidade e a barra de multi-abas do Header com dupla bandeira e badge Turbo, exatamente como especificado na imagem "2. Seletor de ativos aberto".

---

## 1. Escopo e Fronteiras

- **Arquivos Abrangidos:**
  * `apps/web/src/components/modals/AssetCatalogModal.tsx`
  * `apps/web/src/components/header/TerminalHeader.tsx`
  * `apps/web/src/components/header/AssetFlagBadge.tsx`
  * `apps/web/src/trade/asset-catalog-modal.unit.test.tsx`
- **Fronteira Proibida:** Não alterar o catálogo base nem dados sintéticos gerados pelo motor no backend.

---

## 2. Detalhamento do Seletor de Ativos (Sessão 2)

### 2.1 Componentes e Elementos Visuais:
- **Barra de Busca Superior:** Input estilizado com ícone de lupa, placeholder `Buscar activo...`, limpeza instantânea.
- **Abas de Categoria:**
  * `Forex`, `Cripto`, `Sintéticos`, `Favoritos`.
  * Indicador de linha ciano sob a categoria ativa.
- **Tabela de Ativos Institucionais:**
  * Coluna **Activo**: Dupla bandeira circular (ou ícone cripto/sintético) + Código do ativo (`EUR/USD`, `GBP/JPY`, `NZD/JPY`, etc.).
  * Coluna **Ganancia**: Percentual de payout em negrito (ex: `85%`, `84%`, `82%`).
  * Coluna **Cambio 24h**: Variação percentual formatada em Verde Ganancia (`+0.21%`) ou Vermelho Risco (`-0.32%`).
  * Coluna **Favoritos**: Ícone de estrela dourada (`★` preenchida ou `☆` vazada), persistida em `localStorage`.
- **Comportamento de Seleção:**
  * Ao clicar em um ativo, se ele já estiver aberto em uma aba, muda o foco para a aba.
  * Se não estiver aberto, cria uma nova aba no topo do Header e seleciona o ativo imediatamente.

---

## 3. Passo a Passo de Execução

1. **Ajuste do Layout e Estilo do `AssetCatalogModal.tsx`:**
   Alinhar cores com a paleta Turbo Prata: fundo `#151922`, bordas `rgba(244, 245, 247, 0.08)`, destaque de linha ativa com borda ciano.
2. **Implementação da Ordenação e Favoritos:**
   Garantir ordenação por nome, payout ou variação 24h, com filtro exclusivo para a aba "Favoritos".
3. **Sincronização com o Header (`TerminalHeader.tsx`):**
   Garantir que as abas ativas exibam o formato exato da Prancha 1: Dupla bandeira, nome grande, subtítulo "Turbo" e payout verde.
4. **Criação de Testes de Regressão e Usabilidade:**
   Cobrir clique de seleção, busca por substring, toggle de favorito e atalhos de teclado.

---

## 4. Testes Rigorosos e Critérios de Aceite

### 4.1 Testes Unitários:
- Verificar filtro por categoria (`Forex`, `Cripto`, `Sintéticos`, `Favoritos`).
- Testar alternância do status de favorito e persistência no storage.

### 4.2 Teste de Estresse (Filtro Rápido):
- Digitar e apagar 1.000 termos de busca rapidamente sem travamento de UI nem vazamento de render.

### 4.3 Teste de Caos:
- Forçar catálogo vazio ou corrompido: componente deve exibir estado vazio amigável sem quebrar a árvore React.

### 4.4 Teste de Acessibilidade (A11y):
- Navegação completa por teclado via setas e tecla Enter para seleção de ativo.

---

## 5. Critério de Gate
- **Status:** [ ] PENDENTE
- Seletor de ativos abre e fecha com precisão visual.
- Abas com dupla bandeira e payout idênticas às imagens de referência.
