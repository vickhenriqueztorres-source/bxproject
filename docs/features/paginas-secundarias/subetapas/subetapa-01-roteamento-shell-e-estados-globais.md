# Subetapa 01: Infraestrutura de Roteamento SPA, Layout Shell Arejado e Estados Globais

**Responsáveis:** `surgical-frontend-agent`, `iq-fidelity-reviewer`, `qa-resilience-agent`  
**Imagens de Referência:** 
- `Imagem do ChatGPT 9 de out. de 2026, 20_52_30-5.png` (Reconectando)
- `Imagem do ChatGPT 9 de out. de 2026, 20_52_31-6.png` (Mantenimiento)
- `Imagem do ChatGPT 9 de out. de 2026, 20_52_32-7.png` (404)
- `Imagem do ChatGPT 9 de out. de 2026, 20_52_33-8.png` (Modal Erro de Pagamento)

---

## 1. Objetivo Técnico
Estabelecer o roteador SPA limpo e sem dependências invasivas para a aplicação web, fornecendo o container de layout arejado compartilhado pelas páginas secundárias (`SecondaryLayout`), isolamento por tokens CSS `.theme-binmax`, e os 4 estados globais obrigatórios do ecossistema BINMAX.

---

## 2. Escopo Cirúrgico de Arquivos

### Arquivos Criados:
1. `apps/web/src/router/RouterContext.tsx`:
   - Provedor de contexto de roteamento SPA leve (`useRouter`, `navigate(path)`, `currentPath`, `params`).
   - Sincronização bidirecional com a API do navegador (`window.history.pushState`, evento `popstate`).
   - Suporte transparente a rotas protegidas (redireciona para `/login` ou ativa guest mode).
2. `apps/web/src/components/layout/SecondaryLayout.tsx`:
   - Header superior escuro e arejado:
     - Logo oficial BINMAX OPTION (com link para `/` ou `/operar`)
     - Indicador de latência (ping em ms com bolinha verde)
     - Seletor de idioma (ES / PT)
     - Botão de ação (se deslogado: "Iniciar sesión"; se logado: seletor de conta demo/real com saldo e botão verde "Depositar")
   - Área central com padding generoso e fundo `#0B1220`.
   - Rodapé institucional unificado: links "Sobre nosotros", "Términos y condiciones", "Política de privacidad", "Contacto", ícones de redes sociais e aviso legal de risco completo em conformidade com as referências.
3. `apps/web/src/pages/NotFoundPage.tsx`:
   - Tela 404 estilizada com arte neon escura, texto "Página no encontrada", mensagem explicativa e botões verdes "Ir a operar" e link "Volver al inicio".
4. `apps/web/src/pages/MaintenancePage.tsx`:
   - Tela de manutenção com ícone de engrenagem e velas no fundo, título "Mantenimiento programado - Volvemos en breve", caixa com hora prevista de retorno em `23:30 (UTC-3)` e link de suporte.
5. `apps/web/src/components/status/GlobalReconnectingOverlay.tsx`:
   - Overlay de reconexão: congelamento visual, modal central flutuante com ícone WiFi e texto "Reconectando...", badges no header e footer.
6. `apps/web/src/components/status/PaymentErrorModal.tsx`:
   - Modal de erro de pagamento com ícone de exclamação vermelho, título "No pudimos procesar tu pago", texto descritivo amigável, resumo do método e valor, botão verde "Intentar de nuevo" e link "Cambiar método".

### Arquivos Modificados com Menor Diff:
1. `apps/web/src/App.tsx`:
   - Envolver o App no `RouterProvider`.
   - Renderizar o componente correspondente ao `currentPath`:
     - `/` -> Landing pública (ou Dashboard se configurado/solicitado)
     - `/operar` ou `/traderoom` -> Dashboard da sala existente (100% intacta)
     - `/login`, `/registro`, `/recuperar`, etc.
     - `*` -> `NotFoundPage`

---

## 3. Testes Obrigatórios da Subetapa 01

1. **Testes Unitários de Roteamento (`src/router/router.unit.test.tsx`):**
   - Transição de rotas sem reload da página via `navigate()`.
   - Tratamento correto de parâmetros de busca (`?symbol=SYNTH_VOL_10`).
   - Captura de rota inexistente e exibição de 404.
2. **Testes de Estados Globais (`src/components/status/global-states.unit.test.tsx`):**
   - Renderização e interatividade da tela 404.
   - Renderização da tela de manutenção com timezone UTC-3.
   - Disparo do overlay de reconexão e bloqueio de cliques.
   - Modal de erro de pagamento com callback de reprocessamento.
3. **Teste de Regressão da Sala:**
   - Garantir que `/operar` renderiza exatamente o traderoom existente sem nenhuma regressão.
