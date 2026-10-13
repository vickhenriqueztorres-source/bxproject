# SUBETAPA 02 — Frontend Visual: Refinamento de Alta Precisão do ExpiryDropdown

---

## 1. Objetivo Técnico
Refinar o componente `ExpiryDropdown.tsx` na boleta de operações (`OrderTicket.tsx`) para eliminar emojis (`🕒`, `▲`, `▼`), adotar os tokens institucionais da BINMAX (`21-designer-senior-binmax`, `12-tokens-binmax`), utilizar ícones vetoriais de precisão (`IconClock`, `IconChevronDown`) e sinalizar claramente os modos mais lucrativos:
- **Turbo 60s**: 60 segundos corridos.
- **Fim da Vela 1M**: Fechamento no minuto cheio com corte automático aos 30 segundos.
- **Fim da Vela 5M**: Fechamento do bloco de 5 minutos.

---

## 2. Especificação de Mudanças

### 2.1. Tokens Visuais Institucionais
- Fundo do Card Gatilho: `#101622` (`--bg-1`) com borda `#1C2738` (`--bg-3`).
- Estado Aberto: borda `#22C47A` com suave glow tátil.
- Menu Flutuante: `#151D2B` (`--bg-2`) com borda `#1C2738` e sombra institucional `0 12px 32px rgba(0,0,0,0.65)`.
- Tipografia: `Geist Mono` / `tabular-nums` para relógios e contadores decrescentes.
- Cores de Ação: Verde Ganancia `#22C47A`, Prata `#BACAD6`, Aço `#6E7A8A`.

### 2.2. Acessibilidade e Teclado
- Fechamento com `Escape`.
- Navegação e seleção com feedback tátil `bm-btn-press`.

---

## 3. Matriz de Testes da Subetapa 02
1. **Teste Unitário do Componente**:
   - Renderização limpa sem quebra de snapshot.
   - Alternância entre abas/slots com clique e teclado.
   - Ausência absoluta de caracteres unicode de emojis no HTML gerado.
