# Subetapa 01: Refinamento de Fundo de Autenticação (Motion Design UX/UI & Harmonia Cromática)

## 1. Contexto e Diagnóstico do Designer Sênior
- **Problema Estético**: A área de autenticação (`LoginPage` e `RegisterPage`) utilizava uma cor de base desconectada (`#070A0F`) e camadas de brilho com intensidade desigual, criando um descompasso visual com a paleta oficial da BINMAX (`--bg-0: #0B0E14`, `--bg-1: #101622`, `--bg-2: #151D2B`). O card (`.bm-card-fintech`) parecia "flutuar solto" sem ancoragem volumétrica.
- **Diretriz de Motion Design & UX/UI**:
  1. Base de fundo alinhada com `PRECISION_SURFACES.bg0` (`#0B0E14`), integrando-se nativamente com o restante da plataforma.
  2. Acentuação de profundidade através de gradiente radial duplo: Luz esmeralda sutil de 80px blur (`rgba(34, 196, 122, 0.05)`) no quadrante do terminal de prática e glow de ardósia no quadrante do formulário.
  3. Máscara elíptica de transição suave sobre a malha cartesiana SVG 48px, eliminando linhas duras cortadas nas bordas da viewport.
  4. Curvas senoidais de alta precisão em movimento contínuo a 60 FPS com aceleração por GPU (`transform: translate3d(...)`) e desaceleração matemática (`cubic-bezier(0.16, 1, 0.3, 1)`).
  5. Acabamento refinado no card `.bm-card-fintech` com gradiente vertical e borda com sutil reflexo de luz no topo.

## 2. Arquivos Envolvidos
- `apps/web/src/components/auth/AuthBackgroundGridMotion.tsx`
- `apps/web/src/components/auth/AuthShell.tsx`
- `apps/web/src/styles/tokens-precision.css`
- `apps/web/src/pages/subetapa-01-auth-background-refinement.unit.test.tsx` (Novo teste robusto)

## 3. Plano de Testes da Subetapa
- **Testes Unitários**:
  - Presença dos elementos de atmosfera, SVG com padrão cartesiano e curvas em movimento.
  - Verificação da paleta de superfícies `#0B0E14` e ausência de cores fora dos tokens.
  - Conformidade com acessibilidade e atributo `aria-hidden="true"`.
- **Testes de Estresse**:
  - 100 ciclos de renderização do componente de fundo em menos de 400ms.
- **Testes de Caos**:
  - Comportamento sob flag de `prefers-reduced-motion` desativando animações.
  - Responsividade em resolução ultrawide (2560px) e mobile estreito (320px).
- **Testes de Segurança**:
  - Elementos de fundo estritamente decorativos com `pointer-events: none`, garantindo que nenhuma interação de formulário ou campo de senha seja bloqueada ou capturada.

## 4. Critério de Aceite (Gate de Avanço)
- [ ] Todos os testes da Subetapa 1 executados e 100% aprovados no Vitest.
- [ ] Nenhuma quebra em testes existentes de autenticação.
