# Plano Mestre de Implementação — Identidade Visual & Traderoom Binmax Option

**Conceito:** Turbo Prata (*Al máximo.*)  
**Regra Central da Marca:** *"Prata é a marca. Verde é o dinheiro. Vermelho é o risco. Nada mais tem cor."*  
**Regra Central de Layout:** *"A sala da Binmax é uma cópia fiel da sala da IQ Option (docs/referencias/iq-traderoom-desktop.png). Ninguém melhora o layout da IQ. Só valem as diferenças D1–D10 de docs/dashboard-ux.md."*  
**Governança:** `AGENTS.md` & `.agents/skills/` (Skills 01 a 20).

---

## 1. Pool de Agentes e Poderes de Veto

| Agente | Papel | Poder de Veto |
|---|---|---|
| **`mapeador`** (`codebase-mapper-agent`) | Mapeamento fático com `arquivo:linha` e catalogação de zonas sensíveis. | Bloqueia início sem evidência fática. |
| **`fidelidade-iq`** (`iq-fidelity-reviewer`) | Auditoria milimétrica elemento a elemento com `iq-traderoom-desktop.png` (tolerância ±10px). | **VETO TOTAL de layout.** Bloqueia qualquer desvio ou "melhoria" estética. |
| **`marca-binmax`** (`binmax-brand-agent`) | Confere tokens Turbo Prata, fontes Archivo/Geist Mono, logos SVG e microcopy oficial em espanhol. | Veta cores fora de token ou vazamento global de CSS. |
| **`compliance-risco`** (`compliance-risk-reviewer`) | Confere simetria SUBE/BAJA (D2), aviso de risco (D8), integridade financeira e hora do servidor. | **VETO de conformidade/financeiro.** |
| **`guardiao-regressao`** (`regression-guardian-agent`) | Roda build, tipos, lint e testes; audita diffs cirúrgicos e garante funcionamento com flag OFF. | **VETO de regressão.** |
| **`cirurgiao`** (`surgical-frontend-agent`) | Único que altera código frontend. Diff mínimo, escopado dentro de `.theme-binmax`. | N/A (executor restrito). |

---

## 2. Matriz de Riscos, Caos e Zonas Sensíveis

### 2.1 Zonas Proibidas (VERMELHO — Intocáveis)
- Conexão e protocolo WebSocket (`apps/web/src/feed/**`, `services/websocket-gateway/**`).
- Endpoints de trading e carteira (`apps/web/src/api/client.ts`, `services/api/**`).
- Mecanismo de ticks, feeds de mercado e CSPRNG.
- Contabilidade Blnk Ledger e liquidação de contratos.
- Variáveis de ambiente e infraestrutura de produção.

### 2.2 Zonas Supervisionadas (AMARELO — Apenas Adaptação de Interface)
- `apps/web/src/trade/OrderTicket.tsx`: O layout visual e botões se tornam SUBE/BAJA, mas a submissão de ordem (`client.createContract`) e o payload permanecem **estritamente idênticos**.
- `apps/web/src/trade/expiry-calculator.ts`: Preserva piso de 30s e lógica de fim de vela.
- `apps/web/src/lib/money.ts`: Formatação de moedas sem alterar cálculos nem arredondar para cima.

### 2.3 Zonas Seguras (VERDE — Apresentação Pura)
- `apps/web/src/styles.css` e novos estilos escopados em `.theme-binmax`.
- SVGs de marca em `public/brand/`.
- Componentes de cabeçalho, barra lateral, drawer de histórico e rodapé.

---

## 3. Plano Sequencial de Execução (Prompts 01 a 13)

Cada etapa só é considerada concluída após relatório gravado em `docs/relatorios/NN-*.md` e validação pelo Guardião de Regressão.

### Etapa 01 — Mapeamento do Sistema (Leitura Pura)
- **Prompt:** `docs/prompts/01-mapear-sistema.md`
- **Ação:** Mapear arquitetura real de `apps/web` (componentes A1 a F, fluxos de dados, estado, testes, dependências).
- **Entrega:** `docs/relatorios/01-mapa-do-sistema.md`, `docs/zonas-sensiveis.md`, `docs/zonas-sensiveis.txt`.

### Etapa 02 — Rede de Segurança e Feature Flag
- **Prompt:** `docs/prompts/02-rede-de-seguranca.md`
- **Ação:** Criação da chave liga/desliga `NEW_TRADEROOM` (suporte a query param `?theme=binmax` e localStorage, default seguro), testes de baseline de regressão.
- **Entrega:** `docs/relatorios/02-rede-de-seguranca.md`, testes verdes no Vitest.

### Etapa 03 — Cores, Fontes e Tokens
- **Prompt:** `docs/prompts/03-cores-fontes-tokens.md`
- **Ação:** Definição dos tokens Turbo Prata dentro de `.theme-binmax` (Noche `#0D0F14`, Panel `#151922`, Prata `#DCE1EA`, Blanco `#F4F5F7`, Aço `#8A92A1`, Verde Ganancia `#22C47A`, Rojo Baja `#F2545B`). Injeção das fontes Archivo e Geist Mono.
- **Entrega:** `docs/relatorios/03-cores-fontes-tokens.md`.

### Etapa 04 — Logo e Arquivos de Marca
- **Prompt:** `docs/prompts/04-logo-e-arquivos-de-marca.md`
- **Ação:** Criação dos arquivos vetoriais em `public/brand/`: `binmax-mark.svg`, `binmax-logo-horizontal.svg`, `binmax-app-icon.svg`, `favicon.svg`. Atualização do `index.html` (title e favicon).
- **Entrega:** `docs/relatorios/04-logo-e-arquivos-de-marca.md`.

### Etapa 05 — Estrutura da Sala de Operação
- **Prompt:** `docs/prompts/05-estrutura-da-sala.md`
- **Ação:** Reorganização espacial idêntica à IQ Option:
  - Header A: ~76px (Logo horizontal, abas de ativos, saldo verde + DEMO/REAL, Depositar verde).
  - Dock Lateral B: ~68px (Ícones Lucide na vertical com labels em caixa-alta).
  - Ticket D: ~115px estreito à direita.
  - Barra de Portfólio E: ~30px retrátil.
  - Rodapé F: ~30px com suporte neutro, aviso de risco D8 e hora do servidor.
- **Entrega:** `docs/relatorios/05-estrutura-da-sala.md`.

### Etapa 06 — Gráfico e Overlays
- **Prompt:** `docs/prompts/06-grafico.md`
- **Ação:** Ajuste do Lightweight Charts para fundo Noche `#0D0F14`, velas `#22C47A` e `#F2545B`, linha de preço tracejada com etiqueta em seta Prata `#DCE1EA`, linha C10 de fim de compra pontilhada, linha C11 de expiração vermelha e contador C9 de vela.
- **Entrega:** `docs/relatorios/06-grafico.md`.

### Etapa 07 — Ticket SUBE / BAJA
- **Prompt:** `docs/prompts/07-ticket-sube-baja.md`
- **Ação:** Ticket estreito de 115px com:
  - Monto ($ 1 com +/- empilhados verticais).
  - Expiración (tempo com relógio e +/- empilhados).
  - Ganancia (+85% em destaque display, +$0.85 em verde).
  - Botão SUBE (verde ganancia, quadrado ~110x110px).
  - Botão BAJA (rojo baja, quadrado ~110x110px).
  - Efeito hover com highlight translúcido no gráfico.
- **Entrega:** `docs/relatorios/07-ticket-sube-baja.md`.

### Etapa 08 — Operações e Resultados
- **Prompt:** `docs/prompts/08-operacoes-e-resultados.md`
- **Ação:** Drawer de posições retrátil a partir da barra inferior, toasts de resultado com microcopy oficial ("¡Ganaste! +$23.00", "No esta vez · −$25.00"), cards de ordens abertas.
- **Entrega:** `docs/relatorios/08-operacoes-e-resultados.md`.

### Etapa 09 — Textos em Espanhol Neutro
- **Prompt:** `docs/prompts/09-textos-em-espanhol.md`
- **Ação:** Revisão e aplicação integral do vocabulário oficial em espanhol LATAM em todos os textos da interface.
- **Entrega:** `docs/relatorios/09-textos-em-espanhol.md`.

### Etapa 10 — Responsividade Celular e Tablet
- **Prompt:** `docs/prompts/10-celular-e-tablet.md`
- **Ação:** Adaptação responsiva para viewports tablet e mobile mantendo alvos de toque ≥ 44px e ticket compacto.
- **Entrega:** `docs/relatorios/10-celular-e-tablet.md`.

### Etapa 11 — Acessibilidade e Desempenho
- **Prompt:** `docs/prompts/11-acessibilidade-e-desempenho.md`
- **Ação:** Validação de contraste WCAG AAA/AA, suporte a `prefers-reduced-motion`, rAF 60 FPS, sem memory leaks.
- **Entrega:** `docs/relatorios/11-acessibilidade-e-desempenho.md`.

### Etapa 12 — Revisão Final, Homologação e Lançamento
- **Prompt:** `docs/prompts/12-revisao-final-e-lancamento.md`
- **Ação:** Bateria completa de testes, build de produção, deploy na VPS e validação ao vivo no IP `169.58.159.77`.
- **Entrega:** `docs/relatorios/12-revisao-final-e-lancamento.md`.

### Etapa 13 — Próximas Telas do Dashboard
- **Prompt:** `docs/prompts/13-proximas-telas-do-dashboard.md`
- **Ação:** Estrutura modular e rotas para as próximas telas (Depósito, Mi Rendimiento, Torneos, Análisis de mercado).
- **Entrega:** `docs/relatorios/13-proximas-telas-do-dashboard.md`.

---

## 4. Plano Secundário e Contingência de Caos

1. **Fallback Imediato:** Se qualquer comportamento anômalo ocorrer, a feature flag `NEW_TRADEROOM` pode ser desativada instantaneamente no cliente ou via deploy, restaurando 100% da visualização original sem interromper operações de trading.
2. **Proteção de Dados Financeiros:** Nenhuma requisição ao Blnk Ledger ou rotas de contrato é alterada. Os endpoints continuam recebendo e retornando os mesmos tipos e dados.
3. **Imunidade de Ticks e Gráficos:** O motor do gráfico (Lightweight Charts + overlays) mantém seu ciclo de renderização protegido por `requestAnimationFrame` coalescente.
