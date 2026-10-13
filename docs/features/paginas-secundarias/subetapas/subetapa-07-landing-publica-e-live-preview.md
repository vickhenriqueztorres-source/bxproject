# Subetapa 07: Landing Pública Oficial (`/`) com Live Preview Interativo da Sala

**Responsáveis:** `surgical-frontend-agent`, `chart-trading-engineer`, `iq-fidelity-reviewer`, `binmax-brand-agent`, `qa-resilience-agent`  
**Imagens de Referência:**
- `Imagem do ChatGPT 9 de out. de 2026, 20_50_25-10.png` (Landing Pública `/`)

---

## 1. Objetivo Técnico
Entregar a Landing Page pública oficial da BINMAX (`/`) para visitantes não autenticados, combinando copy de alta conversão, prova técnica irrefutável com Live Preview em miniatura da sala real de trading (com gráfico vivo do Vol 50 e boleta), catálogo dinâmico de ativos, acordeão expansível de FAQs e rodapé regulatório completo.

---

## 2. Requisitos Visuais e Funcionais

### 2.1 Hero Section
- **Navegação Superior:**
  - Logo BINMAX oficial à esquerda.
  - Links de âncora: `Plataforma`, `Activos`, `Cómo funciona`, `Preguntas frecuentes`.
  - Ações à direita: Link `Iniciar sesión` (redireciona para `/login`) e botão verde `Crear cuenta gratis` (para `/registro`).
- **Coluna Esquerda do Hero:**
  - Eyebrow em caixa alta: `"PLATAFORMA GLOBAL DE OPCIONES BINARIAS"`.
  - Título imponente: `"Trading de opciones, simple y rápido"` (com `"simple y rápido"` em verde BINMAX `#22C55E`).
  - Subtítulo: `"Opera en una plataforma moderna, intuitiva y segura. Accede a una amplia variedad de activos y aprovecha oportunidades en todo momento."`.
  - Ações principais:
    - Botão verde grande com cantos 6px: `"Crear cuenta gratis ->"`.
    - Link sublinhado: `"Iniciar sesión"`.
  - 3 checks verdes com ícone circular:
    - `✔ Registro rápido`
    - `✔ Plataforma intuitiva`
    - `✔ Sin comisiones ocultas`
- **Coluna Direita do Hero (Live Preview da Sala BINMAX):**
  - Moldura realista da sala BINMAX Option em miniatura funcional:
    - Header com abas e saldo demo `$10,085.00`.
    - Gráfico interativo de velas e linha de preço ao vivo (Vol 50 ou EUR/USD).
    - Boleta lateral com botões SUBE e BAJA e taxa de rendimento `+85%`.
    - Indicador de latência verde `16ms`.

### 2.2 Seção de Benefícios (3 Colunas)
1. **Amplia variedad de activos:**
   - Ícone de gráfico de barras.
   - "Opera divisas, criptomonedas, índices, acciones y materias primas, todo desde una sola cuenta."
2. **Plataforma rápida y estable:**
   - Ícone de raio.
   - "Ejecución en tiempo real, gráficos avanzados y una experiencia optimizada para que nunca pierdas una oportunidad."
3. **Seguridad y transparencia:**
   - Ícone de escudo de segurança.
   - "Tus fondos y datos están protegidos. Operamos con los más altos estándares de seguridad y prácticas justas."

### 2.3 Faixa de Mercados Populares
- Eyebrow: `"OPERA LOS MERCADOS MÁS POPULARES"`.
- Manchete: `"Más de 100 activos disponibles"`.
- Pílulas/Cartões de ativos em carrossel estático/interativo:
  - `EUR/USD` (Forex)
  - `BTC/USD` (Criptomonedas)
  - `ETH/USD` (Criptomonedas)
  - `AAPL` (Acciones)
  - `SPX500` (Índices)
  - `OIL` (Materias primas)
  - `GOLD` (Materias primas)
- Link com seta: `"Ver todos los activos ->"`.

### 2.4 FAQ (Perguntas Frequentes)
- Título: `"Resolvemos tus dudas"`.
- Subtítulo: `"Encuentra respuestas a las preguntas más comunes sobre BINMAX y comienza a operar con confianza."`.
- Acordeão expansível com 4 perguntas chave:
  1. `¿Qué es BINMAX?`
  2. `¿Cómo creo una cuenta?`
  3. `¿Cuánto es el depósito mínimo?`
  4. `¿Qué activos puedo operar?`

### 2.5 Rodapé Institucional Completo
- Logo BINMAX à esquerda.
- Links: `Sobre nosotros`, `Términos y condiciones`, `Política de privacidad`, `Contacto`.
- Ícones de redes sociais: YouTube, Telegram, Facebook, Instagram, X (Twitter).
- **Advertência de risco em texto completo:**
  - *"Advertencia de riesgo: El trading de opciones binarias conlleva un alto nivel de riesgo y puede no ser adecuado para todos los inversores. Existe la posibilidad de perder la totalidad de su inversión. Los resultados pasados no garantizan resultados futuros. Antes de operar, asegúrese de comprender los riesgos involucrados y considere su situación financiera, objetivos de inversión y nivel de experiencia. Opere únicamente con fondos que pueda permitirse perder."*

---

## 3. Testes Obrigatórios da Subetapa 07
1. **Testes de Renderização e Acessibilidade:**
   - Validação dos links de navegação para `/login`, `/registro` e `/operar`.
   - Funcionamento do acordeão de FAQs (abertura e fechamento).
2. **Testes de Performance:**
   - Live Preview não bloqueia a thread de renderização inicial (Lighthouse / Core Web Vitals amigável).
