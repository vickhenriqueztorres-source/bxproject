# SUBETAPA 01: SHELL MASTER, TOKENS TURBO PRATA & GEOMETRIA DESKTOP (SESSÃO 1)

**Objetivo:** Consolidar a fundação estrutural do Traderoom da Binmax, implementando o Shell de 5 regiões em conformidade estrita com a imagem de referência "1. Sala principal (desktop)", aplicando os tokens de cor Turbo Prata, tipografia Archivo/Geist Mono e isolamento via `.theme-binmax`.

---

## 1. Escopo e Fronteiras

- **Arquivos Abrangidos:**
  * `apps/web/src/components/layout/TerminalLayout.tsx`
  * `apps/web/src/styles.css`
  * `apps/web/src/components/footer/TerminalFooter.tsx`
  * `apps/web/src/trade/subetapa-01-shell-layout.unit.test.tsx`
- **Fronteira Proibida:** Não alterar rotas de API, WebSocket handlers, nem lógica financeira do backend.

---

## 2. Especificação Técnica e Tokens

### 2.1 Paleta Turbo Prata e Geometria do Shell:
```css
.theme-binmax {
  --bm-noche: #0D0F14;        /* Fundo Master */
  --bm-panel: #151922;        /* Cards, Sidebar e Docks */
  --bm-prata: #DCE1EA;        /* Logo, Contornos de Foco */
  --bm-blanco: #F4F5F7;       /* Tipografia Primária */
  --bm-aco: #8A92A1;          /* Rótulos e Ícones Secundários */
  --bm-verde: #22C47A;        /* Verde Ganancia (Dinheiro/SUBE) */
  --bm-rojo: #F2545B;         /* Vermelho Baixa (Risco/BAJA) */
  --bm-linha: rgba(244, 245, 247, 0.08);
  --bm-cian-focus: #00e5ff;
}
```

### 2.2 Dimensões do Shell Desktop:
- **Header Superior:** Altura de ~56-58px, `z-index: 20`, borda inferior `--bm-linha`.
- **Sidebar Lateral (Esquerda):** Largura fixa de 70px, alinhamento vertical dos 8 itens com ícones e rótulos.
- **Gráfico Central:** `flex: 1`, fundo `--bm-noche`, sem scrollbars.
- **Dock de Ordens (Direita):** Largura fixa de 150-160px.
- **Footer Inferior:** Altura fixa de 40px, barra única integrada.

---

## 3. Passo a Passo de Execução

1. **Revisão e Ajuste de Dimensões no `TerminalLayout.tsx`:**
   Garantir a estrutura de 5 regiões sem vazamento de scroll e com classes semânticas `terminal-header`, `terminal-sidebar`, `terminal-center`, `terminal-order-dock`, `terminal-footer`.
2. **Harmonização do CSS em `styles.css` sob `.theme-binmax`:**
   Ajustar a largura do `.terminal-order-dock` para 150px no tema Binmax, sidebar para 70px e footer para 40px, garantindo que o visual coincida exatamente com a Sessão 1.
3. **Refinamento do `TerminalFooter.tsx`:**
   Garantir que os indicadores exibam exatamente:
   - `● Conectado` em verde
   - `Portafolio total $0.00`
   - `Ganancia de hoy $0.00`
   - `Operaciones abiertas 0`
   - Relógio em tempo real: `Hora actual: DD MMM YYYY, HH:MM:SS (UTC-3)`
4. **Execução da Suíte de Testes:**
   Rodar testes de layout e verificar estabilidade dos 409 testes.

---

## 4. Testes Rigorosos e Critérios de Aceite

### 4.1 Testes Unitários:
- Verificar montagem correta das 5 regiões sem nulos.
- Garantir que a classe `.theme-binmax` é aplicada quando a feature flag está ligada.

### 4.2 Teste de Estresse (Render Resize):
- Simular 500 resizes consecutivos da janela (1024x576 até 2560x1440) sem quebrar o layout nem gerar estouro de memória no ResizeObserver.

### 4.3 Teste de Caos:
- Forçar viewport 0x0 temporário e restaurar: verificar se o layout recupera sem NaN no CSS.

### 4.4 Teste de Segurança:
- Provar que nenhuma gaveta ou elemento sobrepõe o aviso de risco ou oculta controles críticos.

---

## 5. Critério de Gate
- **Status:** [ ] PENDENTE
- Todos os testes de unidade de layout aprovados sem warnings.
- Geometria das 5 regiões validada contra a Prancha 1.
