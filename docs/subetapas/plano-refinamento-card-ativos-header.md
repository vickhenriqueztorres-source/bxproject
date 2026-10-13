# Plano Geral de Refinamento: Dimensionamento e Motion Design do Card de Ativos no Cabeçalho (BINMAX)

> **Orquestrador**: `tech-lead-orchestrator`  
> **Agentes Convocados**:  
> - `chief-visual-director` / `designer-senior-binmax` (Direção de Arte, Motion Design e Instrumento de Precisão)  
> - `iq-fidelity-reviewer` (Fidelidade Ergonômica de Trading Room)  
> - `binmax-brand-agent` (Tokens Turbo Prata e Tipografia Geist)  
> - `surgical-frontend-agent` (Implementação Cirúrgica em `apps/web`)  
> - `qa-resilience-agent` / `regression-guardian-agent` (Baterias de Testes Robustos, Caos e Estresse)  
>  
> **Skills Ativadas**:  
> - `21-designer-senior-binmax`  
> - `12-tokens-binmax`  
> - `17-mudanca-cirurgica`  
> - `06-testing-quality`  
> - `19-testes-de-regressao-visual`  
> - `20-conduzir-etapa`  

---

## 1. Diagnóstico do Problema 1

### Evidência Visual e Estrutural
- **Problema Detectado**: O card/aba com os nomes dos ativos (`Vol 50`, `EUR/USD`, etc.) na barra superior de navegação possui dimensões diminutas (~26px de altura, fonte 11px, badge 10px, ícone 16px) em relação aos demais elementos do cabeçalho de 56px (onde o avatar possui 36px, o saldo possui 18px Geist Mono e o botão Depositar possui 38px de altura).
- **Impacto Perceptivo**: A aba parece "encolhida", frágil e desancorada, transmitindo falta de ergonomia e violando a Lei 8 de Densidade Contextual e a Proporção Áurea da BINMAX ("A BINMAX é um instrumento de precisão, não um cassino").
- **Escopo Exclusivo**: **Frontend apenas** (`apps/web/**`). Zero alterações de backend.

---

## 2. Divisão em Subetapas de Execução

O plano é dividido em 3 subetapas sequenciais e estritas. Nenhuma subetapa é iniciada antes da anterior estar 100% implementada, testada e validada.

```
+-----------------------------------------------------------------------------+
| SUBETAPA 01: Escala Espacial, Tipografia e Hierarquia do Card de Ativo       |
| - Elevação da altura da aba de ~26px para 38px (proporcional ao header 56px)|
| - Tipografia do ativo: 11px -> 13.5px bold (Geist Sans)                     |
| - Subtítulo Turbo: 8.5px -> 10px com tracking suave                         |
| - Badge Payout: 10px -> 11px Geist Mono tabular com acabamento esmeralda     |
| - Ícone AssetFlagBadge: 16px -> 22px nítido                                 |
| - Bateria de Testes: Unitários + Estresse de Renderização + Anti-Injeção      |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| SUBETAPA 02: Microinterações, Motion Design e Ergonomia de Controles       |
| - Harmonização dimensional do botão [+] para 38px x 38px                     |
| - Botão de fechar [x] com hitbox ampliada (18px x 18px) e hover tátil       |
| - Transições suaves com tokens: cubic-bezier(0.16, 1, 0.3, 1) em 180ms      |
| - Micro-iluminação de superfície ao passar o mouse (#181E2B)                |
| - Bateria de Testes: Event Bubbling + Caos de Interação + Teclado A11y      |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| SUBETAPA 03: Certificação Integrada, Anti-Caos, Estresse e Não-Regressão     |
| - Teste de estresse com 20 e 30 abas simultâneas sob overflow suave          |
| - Teste de caos com símbolos atípicos, nomes ultra-longos e strings vazias   |
| - Validação cruzada com todas as 3 suítes de testes existentes de Header    |
| - Homologação visual dos 5 estados (ativo, inativo, hover, foco, estresse)   |
+-----------------------------------------------------------------------------+
```

---

## 3. Especificação Detalhada das Subetapas

### Subetapa 01: Escala Espacial, Tipografia e Hierarquia do Card de Ativo
- **Arquivos**:
  - `apps/web/src/components/header/TerminalHeader.tsx`
  - `apps/web/src/trade/subetapa-01-asset-tab-card-scale.unit.test.tsx` (Novo)
- **Modificações**:
  - Altura da aba: `height: '38px'`, `minHeight: '38px'`, `boxSizing: 'border-box'`.
  - Padding ergonômico: `padding: '0 12px'`.
  - Ícone `AssetFlagBadge`: `size={22}` (proporcionando clareza vetorial imediata).
  - Título do Ativo: `fontSize: '13.5px'`, `fontWeight: 700`, cor `#F4F5F7` (ativo) / `#DCE1EA` (inativo).
  - Subtítulo `Turbo`: `fontSize: '10px'`, `fontWeight: 600`, cor `#8A92A1`.
  - Badge Payout: `fontSize: '11px'`, `fontWeight: 700`, `fontFamily: "'Geist Mono', monospace"`, `padding: '2px 6px'`, `borderRadius: '4px'`, `background: 'rgba(34, 197, 94, 0.12)'`, `border: '1px solid rgba(34, 197, 94, 0.25)'`.
- **Bateria de Testes Exigida**:
  - Unitário: Presença das novas métricas de fonte, padding e tamanho de ícone.
  - Estresse: Renderização de 100 ciclos em < 250ms.
  - Segurança: Imunidade a injeção de markup em símbolos e payouts.
  - Padrão Duas Portas: Preservação intacta do modo clássico quando `isNewTraderoomEnabled() === false`.

### Subetapa 02: Microinterações, Motion Design e Ergonomia de Controles
- **Arquivos**:
  - `apps/web/src/components/header/TerminalHeader.tsx`
  - `apps/web/src/trade/subetapa-02-asset-tab-motion-interactions.unit.test.tsx` (Novo)
- **Modificações**:
  - Botão `[+]` (Adicionar Ativo): `width: '38px'`, `height: '38px'`, `borderRadius: '6px'`, centralizado, transição `all 0.18s cubic-bezier(0.16, 1, 0.3, 1)`.
  - Botão de fechar `[×]`: área de toque delimitada `width: '18px'`, `height: '18px'`, `borderRadius: '4px'`, `display: 'grid'`, `placeItems: 'center'`.
  - Transições físicas: `--ease: cubic-bezier(0.16, 1, 0.3, 1)` em `180ms` para estados hover/active de background e borda inferior.
  - Indicador de aba ativa: `borderBottom: '2px solid #22C55E'` integrado de forma nivelada na altura de 38px.
- **Bateria de Testes Exigida**:
  - Teste de Event Bubbling: Clicar no botão `[×]` dispara exclusivamente `onCloseTab`, sem disparar `onSelectTab`.
  - Teste de Acessibilidade: Navegação por teclado, atributos `title` e `aria-label`.
  - Teste de Motion: Presença dos tokens de transição com easing institucional.

### Subetapa 03: Certificação Integrada, Anti-Caos, Estresse e Não-Regressão
- **Arquivos**:
  - `apps/web/src/trade/subetapa-03-asset-tab-certification-chaos.unit.test.tsx` (Novo)
- **Modificações**:
  - Verificação de não-quebra de todas as suítes legadas:
    - `apps/web/src/trade/header.unit.test.tsx`
    - `apps/web/src/trade/subetapa-02-header-fidelity.unit.test.tsx`
    - `apps/web/src/components/header/subetapa-01-header-refinement.unit.test.tsx`
- **Bateria de Testes Exigida**:
  - Teste de Caos: Ativos com nomes de 30+ caracteres não quebram o layout flexível.
  - Teste de Caos: Zero abas ou abas repetidas manipuladas defensivamente.
  - Teste de Estresse de Densidade: 30 abas abertas simultâneas renderizadas em menos de 150ms.
  - Prova de Regressão Zero: 100% dos testes da suíte passam sem aviso.
