# RELATÓRIO DO CHIEF VISUAL SYSTEMS & MOTION DIRECTOR — BINMAX
## Diagnóstico Forense de Interface e Plano Diretor de Elevação para Instrumento de Precisão

> $$\mathbf{\text{“A BINMAX É UM INSTRUMENTO DE PRECISÃO, NÃO UM CASSINO.”}}$$

**Autor:** Chief Visual Systems & Motion Director (`chief-visual-director`)  
**Data:** 10 de Outubro de 2026  
**Status:** AUDITORIA COMPLETA & PLANO DIRETOR DE CORREÇÃO CIRÚRGICA  
**Escopo:** `apps/web/src/styles/**`, `apps/web/src/pages/**`, `apps/web/src/components/**`

---

## 1. Veredito Geral e Diagnóstico Brutal da Plataforma

Hoje, a BINMAX sofre de uma inconsistência grave: **uma camada de design amador e de template SaaS genérico está sufocando a engenharia de trading da plataforma**.

Embora o motor de ticks, o livro de ordens e os contratos determinísticos sejam de nível institucional, diversas telas ainda parecem:
1. **Dashboard Bootstrap / Template Pronto**: Quase todas as informações estão aprisionadas em retângulos com bordas idênticas (`background: #111A2B`, `border: 1px solid #1F2A3A`, `borderRadius: 8px`). Não há respiração nem profundidade.
2. **Uso Ingênuo e Decorativo de Cor**: O verde (`#22C55E` / `#00E599`) é disparado em botões de play, chips de categoria, botões de ação genérica e bordas ativas, rebaixando a percepção de terminal para "app de aposta com tema escuro".
3. **Motion Infantil ou Ausente**: Ausência de curvas proprietárias unificadas nas páginas secundárias, alternando entre durações arbitrárias (`0.15s ease`), ausência de microinterações táteis nos cliques e transições descompassadas.
4. **Hierarquia Plana**: Tudo disputa a atenção do usuário no mesmo plano. Nas telas de Análises e Torneios, uma métrica de rodapé possui o mesmo container, tamanho e peso visual que o insight protagonista da tela.
5. **Falta de Vocabulário de Metal e Precisão**: A marca BINMAX não pode se limitar a um logo SVG no canto da tela; a mecânica, as superfícies tonais e a tipografia numérica devem respirar a precisão de um instrumento de laboratório financeiro suíço.

---

## 2. Auditoria Página por Página (O Protocolo em 6 Blocos)

---

### A. Página de Análises e Métricas (`AnalysisPage.tsx`)

#### 1. Veredito Brutal
*Parece um dashboard administrativo genérico de SaaS comercial, e não uma central analítica quantitativa de um trader sistemático.*

#### 2. Problemas de Percepção
- **Hierarquia**: 4 caixas retangulares no topo com pesos idênticos. O olho não sabe para onde ir.
- **Layout e Densidade**: Muito espaço desperdiçado em bordas de cartões enquanto dados vitais (como drawdown e assertividade horária) ficam espremidos.
- **Cor e Superfícies**: O verde é usado para enfeitar números que nem são lucro líquido realizado; os tons `#111A2B` e `#1F2A3A` criam um aspecto plástico e sem profundidade.
- **Tipografia e Dados**: Falta de alinhamento numérico rígido em colunas e uso de fontes genéricas para rótulos.
- **Marca e Percepção Premium**: Nenhum componente transmite a autoridade de um terminal Bloomberg ou FactSet.

#### 3. O Que Deve Morrer
- A linha de 4 cartões com bordas pesadas no topo.
- O botão verde de filtro que parece botão de CTA de compra.
- Gráficos meramente ilustrativos com barras excessivamente arredondadas e amadoras.
- Separadores decorativos redundantes.

#### 4. Nova Direção de Composição
- **Protagonista**: Insight quantitativo de alta escala tipográfica no topo: *“Seu melhor padrão operacional foi entre 20:00–22:00, com 76.0% de assertividade.”*
- **Matriz de Performance**: Substituir cartões fechados por uma régua de instrumentação aberta, usando as superfícies `--bg-1` e `--bg-2`, com tipografia em Geist Mono (`font-variant-numeric: tabular-nums`).
- **Gráficos Analíticos**: Barras com cantos vivos/micro-raio (2px), eixos técnicos e indicadores numéricos integrados.

#### 5. Sistema de Motion
- **Entrada**: Bloco único com `--t-enter` (260ms) e `--ease: cubic-bezier(0.16, 1, 0.3, 1)`.
- **Filtro de Período**: Transição da seleção ativa com `--t-micro` (100ms) sem fade lento.
- **Hover de Barras**: Destaque sutil de brilho metálico na barra ativa em 100ms.

#### 6. Brief de Implementação
- `[Remover]` Contêineres de cartões fechados em `display: grid`.
- `[Fundir]` Métricas secundárias em uma régua horizontal de instrumentação integrada.
- `[Criar componente]` `AnalysisInsightBanner` com protagonismo tipográfico.
- `[Redefinir token]` Aplicar `--bg-0` (#0B0E14), `--bg-1` (#101622), `--bg-2` (#151D2B) e `--line`.

---

### B. Página de Tutoriais e Academia (`TutorialsPage.tsx`)

#### 1. Veredito Brutal
*Parece um catálogo de blog barato do WordPress com um botão de play gigante de cassino.*

#### 2. Problemas de Percepção
- **Hierarquia**: O card de destaque parece um banner promocional em vez de um módulo de ensino técnico institucional.
- **Layout e Densidade**: O botão verde `▶ Ver tutorial` de 230px de largura domina a tela como se fosse um botão "Aposte Agora".
- **Cor e Superfícies**: Caixas pretas com bordas cinzas soltas e thumbnails coloridos aleatórios (`#17263c`, `#2b231c`, `#251b2f`).
- **Tipografia e Dados**: Títulos e durações competindo com o mesmo contraste; falta de metadados claros de nível (Fundamentos, Quantitativo, Execução).
- **Marca e Percepção Premium**: Não reflete um centro de formação para operadores sérios de mercado.

#### 3. O Que Deve Morrer
- O play button verde gigante com ícone `▶`.
- Thumbnails coloridos com degradês aleatórios de template.
- Bordas verdes ativas nos chips de categoria.
- O layout de cards soltos tipo "lista de produtos de e-commerce".

#### 4. Nova Direção de Composição
- **Visual de Academia Técnica**: Transformar o destaque em um frame editorial widescreen com aspecto cinematográfico e moldura de precisão metálica.
- **Play Button**: Ícone metálico em `--metal` / `--text-strong` sobre vidro escuro com micro-transição no hover, jamais verde neon.
- **Lista Editorial**: As aulas abaixo se organizam como uma esteira técnica estruturada: Duração, Habilidade Adquirida, Módulo e Status de Progresso.

#### 5. Sistema de Motion
- **Hover no Player**: O botão de reprodução se eleva 1px em `--t-micro` (100ms) com curva `--ease`.
- **Modal de Reprodução**: Escala de 0.98 para 1.0 em `--t-base` (180ms).
- **Filtragem por Categoria**: Transição instantânea sem reflow brusco.

#### 6. Brief de Implementação
- `[Remover]` Botão verde gigante de play e estilos inline espalhados.
- `[Fundir]` Grade de lições em uma lista editorial técnica indexada com numerais tabulares.
- `[Criar componente]` `TutorialHeroPlayer` com aspect ratio 16:9 real e HUD de instrumentação.
- `[Acessibilidade]` Atributos ARIA nos seletores e atalhos de teclado para o player.

---

### C. Página de Torneios (`TournamentsPage.tsx`)

#### 1. Veredito Brutal
*Transmite ares de gincana de cassino em vez de uma competição quantitativa de traders de alta performance.*

#### 2. Problemas de Percepção
- **Hierarquia**: Destaques de prêmios em verde fluorescente que remetem a slots de apostas.
- **Layout e Densidade**: Tabelas de classificação com emojis de bandeiras soltas e falta de dados de consistência (taxa de acerto, tempo médio).
- **Cor e Superfícies**: Tons escuros mal balanceados com contraste excessivo nos prêmios secundários.
- **Marca**: A competição precisa parecer a World Cup de Trading de Derivativos, não um sorteio dominical.

#### 3. O Que Deve Morrer
- Emojis de troféu e caixas douradas amadoras.
- Destaques de valores em verde sem justificativa de ganho real na conta do usuário.
- Caixas empilhadas com bordas redundantes.

#### 4. Nova Direção de Composição
- **Arena de Competição**: Layout em duas colunas estruturais: à esquerda, o evento mestre com contagem regressiva atômica sincronizada; à direita, o Leaderboard de Precisão com alinhamento tabular absoluto.
- **Pills de Status**: Apenas três estados formais: `EN VIVO` (verde sóbrio e silencioso), `PRÓXIMO` (âmbar técnico) e `FINALIZADO` (aço/metal).

#### 5. Sistema de Motion
- **Contador Regressivo**: Números em Geist Mono fixos sem tremor de largura.
- **Troca de Abas**: Deslocamento sutil em `--t-base` (180ms) sem saltos.

---

### D. Página de Promoções e Benefícios (`PromotionsPage.tsx`)

#### 1. Veredito Brutal
*Parece uma página de bônus de casa de aposta online.*

#### 2. Problemas de Percepção
- **Hierarquia**: Textos "SEM DEPÓSITO REQUERIDO" em pílulas piscando ou em verde saturado.
- **Layout**: Cartões com borda de 2px verde ativa quando selecionado — comportamento clássico de checkout e-commerce.
- **Percepção**: Desgasta a tese de "Instrumento Suíço de Precisão".

#### 3. O Que Deve Morrer
- Termos apelativos e estéticas de "Bônus Grátis".
- Bordas verdes duplas de seleção.

#### 4. Nova Direção de Composição
- **Termos Institucionais Claros**: Redesenhar como "Programas Institucionais de Fomento à Liquidez e Gestão de Risco".
- **Superfícies**: Painéis em `--bg-1` com divisores em `--line`, detalhes em `--metal` e botões de ação em `--bg-3` com texto em `--text-strong`.

---

### E. Página de Histórico Completo (`HistoryPage.tsx`)

#### 1. Veredito Brutal
*Um dump de tabela sem hierarquia nem sofisticação de terminal financeiro.*

#### 2. Problemas de Percepção
- **Tipografia**: Falta de alinhamento rígido nas colunas de moedas e timestamps.
- **Cor**: Células inteiras com cores estridentes em vez de chips discretos de sinalização.

#### 3. Nova Direção de Composição
- **Extrato Institucional**: Tabela contínua com cabeçalhos fixos em `--text-quiet`, numerais em Geist Mono tabular-nums e badges milimétricos para `SUBE` (Verde Ganancia discreto) e `BAJA` (Rojo Baja discreto).
- **Ações de Exportação**: Botões de exportação CSV com precisão de clique e feedback tátil em 100ms.

---

### F. Shell Institucional Compartilhado (`SecondaryLayout.tsx`)

#### 1. Veredito Brutal
*Um cabeçalho escuro genérico com borda azulada desconectado dos tokens da sala de trading.*

#### 2. O Que Deve Morrer
- Fundo `#0B1220` e borda `#1F2A3A` hardcoded.
- Efeitos inline soltos e ausência de classes de motion.

#### 3. Nova Direção de Composição
- **Navbar Estrutural**: Adotar rigidamente `--bg-1: #101622` com borda inferior `--line: rgba(138, 146, 161, 0.16)`.
- **Navegação**: Links com transição de cor em `--t-micro` (100ms) e indicador ativo em `--profit: #22C47A` com espessura de 2px na base.
- **Rodapé**: Tipografia discreta em `--text-quiet: #596273`, links institucionais calibrados e aviso de risco regulatório obrigatório.

---

## 3. O Sistema Visual Unificado (CSS Tokens & Motion)

Todas as correções implementadas seguirão sem desvios a especificação dos tokens:

```css
/* Superfícies */
--bg-0: #0B0E14;       /* Fundo profundo */
--bg-1: #101622;       /* Zona estrutural / navbar / painel base */
--bg-2: #151D2B;       /* Painel elevado / cartões integrados */
--bg-3: #1C2738;       /* Campo ativo / controle em foco */
--line: rgba(138, 146, 161, 0.16); /* Divisor sutil */

/* Conteúdo */
--text-strong: #F4F5F7;
--text-main: #DCE1EA;
--text-muted: #8A92A1;
--text-quiet: #596273;

/* Semântica */
--profit: #22C47A;
--loss: #F2545B;
--pending: #E8A33D;
--info: #4D8DFF;
--metal: #AEB8C8;

/* Motion */
--ease: cubic-bezier(0.16, 1, 0.3, 1);
--t-micro: 100ms;
--t-base: 180ms;
--t-enter: 260ms;
--t-count: 500ms;
```

---

## 4. Plano Diretor de Execução Cirúrgica em 7 Passos

1. **Passo 1: Calibração da Fundação de Tokens e Utilitários de Motion**  
   Atualizar `tokens-precision.css` e `design-tokens.ts` com a paleta oficial das superfícies `--bg-0` a `--bg-3`, tokens de texto, semântica e classes utilitárias de motion.

2. **Passo 2: Reconstrução do Shell Estrutural (`SecondaryLayout.tsx`)**  
   Migrar a casca compartilhada para `--bg-0` e `--bg-1`, harmonizar a tipografia do cabeçalho, os links de navegação e o rodapé.

3. **Passo 3: Transformação da Página de Análises (`AnalysisPage.tsx`)**  
   Substituir caixas genéricas por uma régua contínua de telemetria, insight protagonista de grande escala e gráficos técnicos refinados.

4. **Passo 4: Transformação da Academia Técnica (`TutorialsPage.tsx`)**  
   Eliminar o play button verde gigante e os cards aleatórios. Criar o player editorial em 16:9 e a grade indexada por habilidade e tempo.

5. **Passo 5: Transformação da Arena de Torneios (`TournamentsPage.tsx`)**  
   Eliminar elementos de sorteio/cassino. Reestruturar a contagem regressiva atômica e o leaderboard quantitativo tabular.

6. **Passo 6: Transformação de Promoções (`PromotionsPage.tsx`) e Histórico (`HistoryPage.tsx`)**  
   Converter promoções em programas institucionais sóbrios e o histórico em extrato de auditoria de precisão.

7. **Passo 7: Ajustes Finais, Landing Page e Bateria de Verificação**  
   Refinar os toques finais da Landing Page (`LandingPage.tsx`) e rodar a suíte completa de testes para garantir 100% de integridade funcional.
