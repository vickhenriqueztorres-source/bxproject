# SUBETAPA 09: RESPONSIVIDADE MOBILE & TABLET (SESSÃO 11)

**Objetivo:** Implementar o layout responsivo completo para dispositivos móveis (<768px), com cabeçalho compacto, gráfico otimizado para toque, ticket inferior ergonômico com botões largos SUBE/BAJA e barra de navegação no rodapé, conforme a Sessão 11.

---

## 1. Escopo e Fronteiras

- **Arquivos Abrangidos:**
  * `apps/web/src/components/layout/MobileTraderoomLayout.tsx`
  * `apps/web/src/styles.css`
  * `apps/web/src/trade/responsive-perfection.unit.test.tsx`
- **Fronteira Proibida:** O layout mobile compartilha rigorosamente as mesmas queries, WebSocket feed e estado de ordens do desktop, sem criar rotas separadas ou duplicar a lógica de trading.

---

## 2. Detalhamento do Layout Mobile (Sessão 11)

### 2.1 Elementos da Interface Mobile:
- **Cabeçalho Superior Compacto (~44px):**
  * Logotipo BINMAX simplificado.
  * Pílula de saldo em Verde Ganancia `$9,603.75`.
  * Botão verde de ação rápida `Depositar`.
- **Barra de Ativo Integrada:**
  * Bandeira do ativo + Nome (`NZD/JPY`) com seta para abrir seletor rápido.
  * Preço atual em destaque (`89.587`).
- **Área do Gráfico:**
  * Renderização de candles adaptada ao tamanho da tela móvel.
- **Dock de Operações Inferior:**
  * Linha de parâmetros:
    - `Monto: [-] $100 [+]`
    - `Expiración: [-] 00:21 [+]`
  * Indicador de Ganho: `Ganancia +85% +$85.00`.
  * Botões de Alta Conversão Táteis: `SUBE` (Verde) e `BAJA` (Vermelho) lado a lado em tela cheia com alvo de toque mínimo de 48px.
- **Barra de Navegação Inferior (Bottom Bar):**
  * 4 itens com ícones e rótulos: `Operar`, `Portafolio`, `Historial`, `Más`.

---

## 3. Passo a Passo de Execução

1. **Ajuste do `MobileTraderoomLayout.tsx` e Media Queries:**
   Configurar quebra limpa em `< 768px` ativando o shell mobile vertical.
2. **Integração dos Controles Táteis:**
   Garantir botões de tamanho adequado para toque com dedo (touch targets > 44px).
3. **Barra de Navegação Inferior:**
   Vincular os botões da barra inferior à abertura em modal/drawer de Portafolio e Historial no mobile.
4. **Execução de Testes de Viewport:**
   Testar em resoluções 360x800, 390x844 e 768x1024.

---

## 4. Testes Rigorosos e Critérios de Aceite

### 4.1 Testes Unitários:
- Verificar montagem do layout mobile sob viewport de 390px.
- Garantir presença dos botões SUBE/BAJA e da barra de navegação inferior.

### 4.2 Teste de Usabilidade Touch:
- Nenhum elemento com área de toque menor que 44x44px.

---

## 5. Critério de Gate
- **Status:** [ ] PENDENTE
- Layout mobile 100% funcional e esteticamente idêntico à Sessão 11.
