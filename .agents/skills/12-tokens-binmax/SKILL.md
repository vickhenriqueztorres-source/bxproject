---
name: tokens-binmax
description: Aplica cores, fontes e logo da Binmax só dentro da sala, no sistema de estilo que o projeto já usa (CSS puro, Tailwind v3 ou v4, CSS Modules, SCSS, styled-components, Emotion, MUI), sem alterar nenhuma medida de layout. Use nas etapas 03 e 04 e sempre que um passo mexer em cor.
---

# Tokens Binmax

Os valores exatos (hex, fontes, logo) estão em `docs/identidade-visual.md`, e a troca IQ → Binmax está na seção 2 de `docs/dashboard-ux.md`. **Não copie valor de memória: leia o manual.**

## 1. Inventário (antes de criar qualquer token)

Nos arquivos da sala (lista do mapa), busque todas as cores: `#`, `rgb(`, `rgba(`, `hsl(`, `var(--`, nomes de cor do tema, classes Tailwind de cor (`bg-`, `text-`, `border-`, `fill-`, `stroke-`, `ring-`) e as cores passadas por JavaScript para a biblioteca de gráfico.

Monte a tabela:

| Cor atual | Onde (arquivo:linha) | Papel (fundo, texto, alta, baixa, destaque…) | Token Binmax |

## 2. Declarar os tokens (escopados)

Base em todos os sistemas: **variáveis CSS dentro de `.theme-binmax`**.

```css
.theme-binmax {
  --bm-fundo: <do manual>;
  --bm-superficie: <do manual>;
  --bm-texto: <do manual>;
  --bm-texto-suave: <do manual>;
  --bm-prata: <do manual>;    /* destaque: onde a IQ usa laranja */
  --bm-sube: <do manual>;     /* verde: alta, ganho, saldo, SUBE */
  --bm-baja: <do manual>;     /* vermelho: baixa, perda, BAJA */
  --bm-borda: <do manual>;
}
```

Depois, ligue as variáveis ao sistema do projeto:
- **CSS / CSS Modules / SCSS:** use `var(--bm-*)` nos arquivos da sala nova. Em SCSS, não altere as variáveis globais.
- **Tailwind v3:** em `theme.extend.colors`, crie `bm: { fundo: 'var(--bm-fundo)', … }`. Só **adicione**; não altere cores existentes.
- **Tailwind v4:** em `@theme inline`, adicione `--color-bm-fundo: var(--bm-fundo);` etc. Não altere os tokens existentes.
- **styled-components / Emotion:** um `ThemeProvider` **só em volta da sala nova**, com os valores lendo `var(--bm-*)`.
- **MUI / Chakra / AntD:** tema aninhado (`ThemeProvider` / `ConfigProvider`) **só em volta da sala nova**.
- **Biblioteca de gráfico:** leia as variáveis com `getComputedStyle(container).getPropertyValue('--bm-…')` e passe para as opções da biblioteca. Não fixe hex no código do gráfico.

## 3. Fontes

- Geist Sans (interface) e Geist Mono (números), carregadas do jeito que o projeto já carrega fontes (`next/font`, `@fontsource`, `<link>`).
- Aplicadas só em `.theme-binmax` (ex.: `font-family: var(--bm-fonte)`).
- Nenhuma terceira fonte. Os números do ticket, do saldo e dos preços usam Geist Mono com `font-variant-numeric: tabular-nums`.

## 4. Logo

Use o arquivo oficial da etapa 04, no mesmo tamanho do logo da IQ (A1: cerca de 150px de largura). Com `alt="Binmax Option"`.

## 5. Proibido

- Alterar `:root`, o tema global ou cores existentes do Tailwind ou do design system.
- Mudar qualquer medida (tamanho, espaçamento, posição, borda, fonte em px) junto com a cor.
- Usar mais cores do que as do manual.

## 6. Conferência

Com a flag desligada, nenhuma página muda. Com a flag ligada, `git grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(" -- <arquivos da sala nova>` só pode encontrar o arquivo dos tokens.
