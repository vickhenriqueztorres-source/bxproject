# Subetapa 02: Refinamento Óptico do Grid Cartesiano & Vinheta de Profundidade (`AuthBackgroundGridMotion.tsx`)

**Responsável:** `chief-visual-director` (design) + `surgical-frontend-agent` (código)  
**Validação:** `qa-resilience-agent`  
**Status:** PRONTO PARA EXECUÇÃO  

---

## 1. Objetivo Técnico e Visual

Refinar a malha cartesiana do fundo técnico de modo que ela preencha todo o viewport sem recortes abruptos, integrando uma vinheta perimétrica suave de 360° em SVG para evitar que as bordas da tela pareçam cortadas. Adicionar glow volumétrico esmeralda em múltiplas camadas difusas ancoradas no centro e sob o gráfico, criando a ilusão de profundidade óptica sem ofuscar textos.

---

## 2. Passo a Passo de Implementação Cirúrgica

1. **Editar `apps/web/src/components/auth/AuthBackgroundGridMotion.tsx`**:
   - **Vinheta Perimétrica 360°:** Inserir máscara radial ou gradiente elíptico que escurece suavemente para `#070A0F` nas bordas extremas do viewport.
   - **Grade Cartesiana Refinada:**
     - Pattern SVG de `48px x 48px` com traço de `1px` em `rgba(255, 255, 255, 0.026)`.
     - Micro-vértices luminosos verdes discretos (`rgba(34, 196, 122, 0.22)`) nas interseções dos eixos.
   - **Glow Tridimensional de Profundidade:**
     - Camada 1: Glow esmeralda difuso (`rgba(34, 196, 122, 0.07)`) com blur de 60px cobrindo a área do gráfico e do título.
     - Camada 2: Glow esmeralda aveludado (`rgba(34, 196, 122, 0.05)`) com blur de 70px posicionado sob a área do card fintech.
     - Camada 3: Luz de atmosfera profunda ardósia/noche (`rgba(16, 22, 34, 0.6)`) no centro para contraste de leitura.

---

## 3. Critérios de Aceite e Testes Rigorosos

- **Teste SVG:** Pattern cartesiano com id de padrão e gradientes devidamente estruturados.
- **Teste de Performance:** `AuthBackgroundGridMotion` utiliza aceleração via GPU (`willChange`, SVG vetorial leve < 5KB de nós).
- **Teste de Estresse SSR:** 100 ciclos de renderização do componente de fundo em menos de 200ms.
- **Auditoria Anti-Cassino:** Zero flashes, zero luzes piscantes, zero gradientes neon agressivos.
