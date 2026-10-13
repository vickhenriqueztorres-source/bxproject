---
name: 21-designer-senior-binmax
description: >
  Trigger: "designer sênior", "design", "motion", "instrumento de precisão", "cassino", "anti-cassino", "interpolação", "tokens de movimento", "teste dos olhos semicerrados", "5 estados", "profundidade", "hierarquia visual", "feedback tátil", "latência honesta", "revisão de tela", "UI/UX", "animação". Guia arquitetural e operacional de design sênior e motion design da BINMAX: Instrumento de Precisão vs Cassino, hierarquia, densidade contextual, tokens de física de movimento e critérios de aprovação/veto estrito.
version: 1.0.0
---

# 21-designer-senior-binmax

Guia de Engenharia de Design e Motion Design Sênior para a plataforma **BINMAX**.
Baseado no manifesto conceitual do Designer Sênior (`D:\BRENDA\Binmax Options - Broker\frontend\designer sênior.md`).

---

## 0. A Pergunta que Vem Antes da Tela

> $$\mathbf{\text{“A BINMAX É UM INSTRUMENTO DE PRECISÃO, NÃO UM CASSINO.”}}$$

Toda tela, componente, animação, som, feedback ou microinteração passa por este filtro único:
**Isso faz a BINMAX parecer um terminal de precisão cirúrgica ou um joguinho de aposta?**
- Se parecer joguinho: **vetado imediatamente**.
- Se parecer instrumento de precisão profissional: **aprovado**.

### A Dualidade de Copywriting e Psicologia do Trader
1. **The Hunter (Aquisição & Tráfego Frio)**:
   - A IQ Option comete 3 pecados capitais: visual de cassino, delay de clique mascarado por animação e burocracia/atrito no saque.
   - O mercado está cético e traumatizado. A BINMAX não vende "dinheiro fácil", vende **atrito zero e precisão cirúrgica**.
   - *Frase de Ataque*: *"A Binmax é a plataforma onde o gráfico obedece ao seu clique, não ao algoritmo da casa."*
2. **The Harvester (Retenção & LTV do Trader Maduro)**:
   - O trader maduro (banca real, volume contínuo) busca sobriedade, previsibilidade, tela escura, tipografia nítida e saque instantâneo via PIX.
   - Qualquer elemento com cara de slot/aposta destrói a retenção pela metade.
   - *Frase de Retenção*: *"A Binmax é o ambiente onde o trader opera sem poluição e saca sem atrito."*

---

## 1. As 10 Leis de Design do Designer Sênior

### 1. Sistema Antes de Tela
Não construa telas isoladas. Todo elemento deriva de uma fundação matemática compartilhada:
- **4 tamanhos tipográficos**: `12px`, `14px`, `16px`, `24px`. No máximo 3 pesos (`regular 400`, `medium 500`, `bold 700`).
- **Escala de espaçamento fixa**: `4px`, `8px`, `12px`, `16px`, `24px`, `40px`.
- **3 superfícies de profundidade**: Fundo (`#0B0E14`), Painel (`#121721`), Campo (`#1A202C`). Cada camada sutilmente mais clara que a anterior.
- **Cores semânticas estritas**: 1 de ação/ganho (Verde), 1 de perda/erro (Vermelho), 1 de alerta/pendente (Âmbar), 1 de sistema (Azul).
- **1 raio de canto padronizado** para todo o sistema (ex: `4px` ou `6px`).
- **1 conjunto único de ícones vetoriais**, mantendo rigorosamente a mesma espessura de traço (stroke uniforme de 1.5px ou 2px).

### 2. Hierarquia como Narrativa
Em cada tela, determine: *o que o usuário veio fazer e qual a rota visual dos olhos?*
- **Protagonista**: elemento focal principal (ex: o dropzone na Verificação; o gráfico de velas na Sala).
- **Coadjuvante**: suporte direto à ação (ex: lista de documentos válidos; painel de boleta).
- **Nota de rodapé**: avisos e contexto secundário (ex: exemplos de reprovação; links de suporte).
- *Regra*: o que não é protagonista recebe menor contraste, menor escala e tom mais cinza/silencioso.

### 3. Cor como Significado, Nunca Decoração
Cor carrega semântica estrita. Elimine neons, gradientes festivos e bordas coloridas puramente estéticas.

| Cor | Significado Exclusivo |
| :--- | :--- |
| **Verde** (`#00E599` / Verde Ganancia) | Ação principal, ganho financeiro, saldo positivo, botão SUBE |
| **Vermelho** (`#FF3B56` / Rojo Baja) | Perda financeira, erro de validação, botão BAJA |
| **Âmbar / Laranja** (`#FFAA00`) | Estado pendente, aguardando ação do usuário |
| **Azul** (`#2E86DE`) | Informação de sistema neutra |
| **Branco** (`#FFFFFF` / `#F0F4F8`) | Conteúdo de leitura, valores em foco |
| **Cinza / Aço** (`#8A92A1` / `#4E5564`) | Contexto secundário, rótulos de apoio |

### 4. Tipografia como Voz Técnica
- Fonte de interface neutra, limpa e técnica: **Geist Sans** (ou **Inter** como fallback). Proibido uso de fontes expandidas/esportivas pesadas (como Archivo) na interface.
- **Mono é sotaque, não idioma**: **Geist Mono** é reservada estritamente onde o número é protagonista (preço do tick, saldo da carteira, valor do contrato, payout).
- Detalhes obrigatórios:
  - `font-variant-numeric: tabular-nums` (evita que colunas de números pulem no refresh).
  - Kerning sutilmente apertado em títulos (`letter-spacing: -0.01em` a `-0.02em`).
  - Altura de linha generosa em parágrafos (`line-height: 1.5`).
  - Rótulos sempre menores (`text-xs` / `12px`) e mais escuros que os valores (`text-sm` / `text-base`).

### 5. Profundidade com Luz, Não com Linhas
- Separe painéis por **tom de superfície**, não por bordas sólidas pesadas.
- Borda (`1px solid rgba(255,255,255,0.06)`) apenas onde for necessário demarcar que o elemento é clicável ou editável.
- Sombra apenas no que realmente flutua no eixo Z (modais, gavetas, dropdowns, toasts).
- **Zero glow, zero reflexo, zero brilho neon**.

### 6. Movimento como Confirmação
O movimento não existe para enfeitar; ele responde: *"eu ouvi o seu comando"*.
- Uma única curva: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out forte).
- Durações padronizadas e secas: `100ms`, `180ms`, `260ms`, `500ms`.
- Proibido elasticidade (bounce), overshoot ou pulsações decorativas contínuas.

### 7. Estados como Parte do Design
Nenhuma tela é aprovada desenhando apenas o "caminho feliz". Cada interface deve implementar obrigatoriamente 5 estados:
1. **Vazio (Empty)**: sem dados, orientando a primeira ação sem poluição.
2. **Carregando (Loading)**: esqueleto (skeleton) monocromático neutro sem saltos de layout; sem spinners decorativos.
3. **Cheio (Success/Filled)**: dados populados com alinhamento tabular e contraste equilibrado.
4. **Erro (Error)**: mensagem técnica clara, borda vermelha discreta; **o campo nunca balança**.
5. **Sucesso (Settled/Confirmed)**: confirmação sucinta com crossfade suave.

### 8. Densidade por Contexto
- **Sala de Trading**: alta densidade de dados, controles compactos, margens de 4px a 8px, foco no gráfico e latência zero.
- **Páginas de Conta (Login, Verificação, Depósito, Ajustes)**: baixa densidade, respiração visual, margens de 16px a 40px, construção de confiança e foco unitário.

### 9. Microdetalhes de Sofisticação
- Ícones vetoriais de um único pacote, traço consistente de 1.5px/2px.
- Botões primários com altura padronizada em todo o produto.
- Badges de status com padronização visual única (pílula neutra com ponto colorido).
- Datas e horários formatados com UTC/servidor explícito em Geist Mono.
- Alinhamento consistente à esquerda; nada centralizado "porque sobrou espaço".

### 10. O Teste dos Olhos Semicerrados
Aperte as pálpebras até a tela embaçar:
- **O que ainda se destaca no borrão?**
- Deve ser **exclusivamente o protagonista da tela e a ação principal**. Se um menu secundário, uma borda decorativa ou um banner estiver gritando, o peso visual está incorreto.

---

## 2. Engenharia de Motion Design & Física de Movimento

### 2.1 Filosofia
> **Movimento na BINMAX é instrumentação, não espetáculo.**
> Um osciloscópio não comemora quando afere uma corrente. Ele apenas registra, com exatidão e latência honesta.

- **Imediato**: resposta instantânea a inputs locais (0ms a 100ms).
- **Exato**: posições e coordenadas geradas pela resposta do servidor, sem inventar interpolações falsas.
- **Silencioso**: discreto, sem atrair atenção para a transição em si.

### 2.2 O Sistema de Tokens de Movimento (8 Regras)

```css
:root {
  /* Única curva de transição autorizada no projeto (ease-out forte) */
  --bm-ease: cubic-bezier(0.16, 1, 0.3, 1);

  /* Durações matemáticas */
  --bm-t-micro: 100ms;  /* Hover, press, toggle, clique em botão */
  --bm-t-base: 180ms;   /* Modais, fade in/out, troca de abas, dropdowns */
  --bm-t-enter: 260ms;  /* Gavetas laterais (portafolio, historial), toast de entrada */
  --bm-t-count: 500ms;  /* Saldo contando numericamente até novo valor */

  /* Limites de translação */
  --bm-dist-max: 64px;  /* Nenhum elemento translada mais que 64px */

  /* Únicas pulsações permitidas no sistema inteiro */
  /* 1. Tick de reconexão | 2. Últimos 5s da expiração de contrato */
  --bm-pulse-allowed: tick, countdown-last-5s;

  /* Únicas propriedades CSS animadas (GPU friendly) */
  --bm-motion-props: transform, opacity;
}
```

### 2.3 Os Momentos Críticos de Interação

#### A. O Tick (Fluxo Contínuo)
- O preço atual interpola suavemente do valor anterior ao novo exatamente no intervalo do tick (250ms). Nunca pula de forma espasmódica.
- A vela em formação cresce frame a frame em canvas/WebGL a 60 FPS.
- A etiqueta de preço no eixo vertical está matematicamente cravada no tick, sem delay de CSS.

#### B. O Clique em SUBE/BAJA (A Prova do "Sem Delay")
- **0ms**: O botão afunda 1px e escurece 6% no hover/active. Resposta física imediata.
- **Durante a confirmação de rede**: **NENHUM SPINNER**. Nenhum elemento se move. Se o servidor respondeu em 28ms, o usuário percebe os 28ms. Honestidade radical de latência.
- **Na confirmação**: A linha horizontal de entrada aparece no gráfico **na coordenada de preço e timestamp exatos devolvidos pelo servidor**, com fade in de 100ms sem salto espacial.
- **Pós-confirmação**: O card entra na gaveta de posições (opacidade + subida de 16px em 180ms). O saldo conta do valor antigo ao novo em 500ms.

#### C. A Expiração do Contrato (Liquidação Sóbria)
- **Últimos 5 segundos**: O contador visual pulsa suavemente (opacidade 1.0 → 0.6 → 1.0, 1s por ciclo).
- **Segundo zero**: Um ponto de 8px marca a coordenada final no gráfico, sem explosão. O card troca o estado para `+$85.00` em verde ou `-$100.00` em vermelho com fade de 100ms.
- **Saldo**: Conta até o novo valor em 500ms. Se vitória, os dígitos assumem verde durante a contagem e retornam a branco. Se derrota, o saldo apenas decresce em branco (sem drama de perda).
- **Toast**: Canto inferior esquerdo (sobe 16px com opacidade em 260ms; permanece por 4s; sai em 180ms).
- **Áudio**: **Mudo por padrão**. Se o usuário ativar som nas configurações, o feedback é um clique seco e metálico de 50ms, **NUNCA som de moedas ou sino**.

#### D. Gavetas e Painéis Operacionais
- Gavetas (Portafolio, Historial, Torneos) deslizam da esquerda em 260ms com `--bm-ease`, **enquanto o gráfico se comprime sincronicamente no mesmo tempo**. O gráfico nunca fica oculto por baixo; são duas engrenagens da mesma máquina.
- Modais escalam sutilmente de 0.98 para 1.0 com fade in em 180ms.
- Abas trocam com crossfade de 100ms (sem slides horizontais que cansam a vista).

#### E. Troca de Ativo
- Gráfico atual faz fade out em 180ms.
- O novo gráfico projeta as velas da esquerda para a direita à medida que o histórico chega do backend. Um esqueleto cinza ocupa o espaço para evitar layout shift.

#### F. Queda e Retomada de Conexão
- **Caiu**: Gráfico perde saturação (filtro CSS `saturate(0.4)` em 180ms). Botões de ordem ficam desabilitados em cinza. Pílula central discreta exibe *"Reconectando..."* com ponto pulsando a cada 1s.
- **Voltou**: O preço interpola do último valor conhecido até o novo em 500ms para demonstrar o deslocamento real. Saturação volta em 180ms.

---

## 3. Lista Explícita de Anti-patterns (Veto Imediato)

Se qualquer componente, PR ou sugestão contiver qualquer item abaixo, o parecer deve ser **REPROVADO com VETO**:

1. ❌ **Confetes, moedas caindo, estrelas ou fogos de artifício** ao vencer um trade.
2. ❌ **Sons de moeda, sino de jackpot, caixa registradora ("cha-ching")**.
3. ❌ **Pop-up em tela cheia com "Parabéns, você ganhou!"**.
4. ❌ **Botões SUBE/BAJA com brilho pulsante, respirando ou piscando** para induzir o clique.
5. ❌ **Transições com física elástica (bounce/spring overshoot)**.
6. ❌ **Spinners circulares girando enquanto a ordem é confirmada** (máscara de delay).
7. ❌ **Números rolando como caça-níquel (slot machine)** ao alterar saldo.
8. ❌ **Fundos animados com orbes, gradientes em movimento ou partículas flutuantes**.
9. ❌ **Campos de formulário tremendo horizontalmente (shake)** ao acusar erro.
10. ❌ **Efeitos de digitação de texto tipo máquina de escrever (typewriter effect)**.
11. ❌ **Loopings decorativos infinitos** que não transmitem telemetria em tempo real.
12. ❌ **Degradês neons saturados ou botões com glow/halo luminoso**.

---

## 4. Protocolo de Auditoria e Checklist de Aprovação

Para qualquer tela ou componente novo, responda:

```markdown
### Auditoria de Design Sênior — BINMAX

- [ ] **Filtro Central**: A tela parece um instrumento de precisão de alta tecnologia ou tem elementos de joguinho?
- [ ] **Hierarquia Visual**: O protagonista da tela está nítido no "teste dos olhos semicerrados"?
- [ ] **Superfícies**: A profundidade é dada por camadas tonais (#0B0E14 -> #121721 -> #1A202C) sem brilhos ou bordas berrantes?
- [ ] **Semântica de Cores**: As cores usadas respeitam estritamente a tabela semântica (Verde=dinheiro/ação, Vermelho=risco/erro, Aço=apoio)?
- [ ] **Tipografia**: Geist Sans para interface e Geist Mono estritamente nos números com `tabular-nums`?
- [ ] **5 Estados**: Estão implementados os estados Vazio, Carregando, Cheio, Erro e Sucesso?
- [ ] **Motion Tokens**: As transições usam exclusivamente durações de 100/180/260/500ms e a curva `--bm-ease`?
- [ ] **Honestidade de Latência**: Não existem spinners ou animações mascarando o tempo real do servidor?
- [ ] **Lista de Proibições**: Zero confetes, zero sons de cassino, zero popups eufóricos, zero bounce.

**Veredito**: [APROVADO | REPROVADO]
```
