# Diagnóstico e fronteiras verificadas
Mapeamento e design revisados independentemente; navegador observado pelo orquestrador.
Não é auditoria de backend nem prova de segurança financeira.

## Evidências de código
| Arquivo:linha | Fato | Implicação |
|---|---|---|
| apps/web/src/App.tsx:50 | Dashboard contém dados, carteira, contratos e feed | Não editar como arquivo visual genérico |
| apps/web/src/App.tsx:336 | Router próprio compõe páginas | Preservar rotas e comportamento |
| apps/web/src/components/layout/SecondaryLayout.tsx:45 | theme-binmax aplicada sempre | Falta isolamento da reforma secundária |
| apps/web/src/components/layout/SecondaryLayout.tsx:145 | Literal 16ms | Telemetria sem medição |
| apps/web/src/components/layout/SecondaryLayout.tsx:277 | Fallback $10,085.00 | Não apresentar como valor recebido |
| apps/web/src/styles/tokens-precision.css:6 | Tokens em :root | Mudança global alcança sala e outras páginas |
| apps/web/src/styles.css:232 | Tema compete com superfície inline | Unificar apenas no escopo secundário |
| apps/web/src/lib/design-tokens.ts:23 | text-quiet #596273 | Contraste 2,95:1 em bg1; não usar para instruções |
| apps/web/src/pages/AnalysisPage.tsx:16 | Dados estáticos | Rotular demonstração; não chamar de resultado auditado |
| apps/web/src/pages/HistoryPage.tsx:156 | Amostras mescladas com API | Débito funcional independente; não alterar no passo visual |
| apps/web/src/pages/VerificationPage.tsx:65 | Timer produz progresso e estado | Não é prova de upload recebido |
| apps/web/src/pages/SettingsPage.tsx:27 | 2FA/sessões locais | Aparência de segurança não prova segurança |
| apps/web/src/lib/feature-flags.ts:49 | Default true atual | Não mudar flag existente para resolver apresentação |
| apps/web/src/components/chart/Vol50LiveMiniChart.tsx:33 | Microticks simulados locais | Preview gráfico ilustrativo; não confundir com feed oficial |
| vitest.config.ts:15 | tests/chaos excluídos | Script test:chaos não certifica caos |
| apps/web/src/pages/auth-precision-stress.unit.test.tsx:49 | SSR repetido | Não comprova interação/carga browser |

## Observação de navegador
Em /analisis a 390×844: logo e navegação ocupam o cabeçalho sem acomodar ações.
Botão Crear cuenta: x=835,875; right=911,140625; viewport=390.
Botão Análisis: right=413,859375, também cortado.
scrollWidth=390 não detecta esses controles ocultos.
Capturas: evidencias/antes-analisis-390.png, antes-analisis-1366.png, antes-login-1366.png.
São base visual, não evidência de correção.

## Direção por referência
| Sufixo do PNG | Página/estado | Aproveitar |
|---|---|---|
| 20_50_20-1 | Login | Formulário protagonista; split desktop |
| 20_50_20-2 | Registro | Uma etapa e condições legíveis |
| 20_50_21-3 | Recuperação | Um estado por vez |
| 20_50_21-4 | Depósito | Método, monto e resumo |
| 20_50_22-5 | PIX | Código e estado pendente verdadeiro |
| 20_50_22-6 | Retirada | Destino, saldo confirmado e KYC |
| 20_50_23-7 | Verificação | Dropzone e requisitos claros |
| 20_50_24-8 | Ajustes | Uma seção ativa por vez |
| 20_50_24-9 | Histórico | Filtros e tabela tabular |
| 20_50_25-10 | Landing | Produto e acesso simples |
| 20_52_27-1 | Torneios | Lista + detalhe selecionado |
| 20_52_28-2 | Análise | Métricas com gráfico compreensível |
| 20_52_29-3 | Tutoriais | Conteúdo editorial e capa disponível |
| 20_52_30-4 | Promoções | Condições e elegibilidade |
| 20_52_30-5 | Reconexão | Estado discreto; sala preservada |
| 20_52_31-6 | Manutenção | Mensagem curta e suporte |
| 20_52_32-7 | 404 | Voltar sem estimular operação |
| 20_52_33-8 | Erro de pagamento | Próxima ação segura |
Não copiar promessas, ganhos, prêmios ou confirmação fictícia.

## Zonas
VERMELHO: services/**, db/**, infra/**, api/client.ts, auth/**, feed/**, router/**, operações financeiras, handlers de KYC/segurança e analytics.
AMARELO: páginas, SecondaryLayout, modais financeiros; somente apresentação e props existentes.
VERDE com impacto amplo: CSS/tokens compartilhados. Preferir arquivo local novo e seletor explícito.
Sala principal/gráfico/ticket: proteção e comparação, sem implementação nesta execução.

## Conflitos resolvidos
Layout da sala: fidelidade IQ prevalece; referência secundária não autoriza mudar geometria da sala.
Marca: precedência explícita no PLANO-GERAL: AGENTS atual define superfícies precision e Geist/Geist Mono; trechos divergentes de skill21/manual histórico são subordinados. Manual permanece referência da marca prata/SVG e cores financeiras compatíveis. Não misturar paleta alternativa do plano antigo.
Dinheiro/segurança: honestidade de origem vence desejo de prazer visual.
Técnica: veto do guardião por suíte reprovada impede iniciar cosmética.

## Débito protegido adicional
O revisor de risco apontou OrderTicket.tsx:78 (Date.now),:108 (saldo fallback) e :116–118 (assetMeta/payout,Math.round e fallback850). A origem do tempo/payout oficial não foi certificada aqui. Investigar em auditoria própria; não alterar ticket nem ampliar a reforma frontend para integração financeira. A sala fica protegida por regressão e sem certificação de segurança absoluta.

