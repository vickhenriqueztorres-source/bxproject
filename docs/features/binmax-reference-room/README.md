# Plano geral — Sala Binmax conforme referências
## Identificação e autorização
- Feature: BMR-2026-10-09; coordenação: tech-lead-orchestrator; vínculo arquitetural: T13.
- Branch: codex/binmax-reference-room; base Git: d67aeaf926588e4acac63aa106a0c40593183aca.
- O usuário autorizou planejamento e implementação sequencial sem nova aprovação humana.
- O checkout começou com 296 entradas no status. Preservar os trabalhos anteriores; comparar o incremento com a baseline desta execução, não restaurar arquivos inteiros.
- Documentos de governança congelados não serão editados. Este pacote complementa o projeto.
- Não se promete ausência absoluta de defeitos ou segurança de 100%. “Gate concluído” significa todos os critérios definidos executados, com evidências e revisão; um item obrigatório não executado bloqueia o avanço.

## Resultado esperado
Reproduzir a hierarquia, geometria e estados apresentados nas três imagens com componentes reais, controles acessíveis e dados corretos. O frontend deve ser uma apresentação do estado do servidor: abrir uma gaveta ou trocar o layout não pode alterar o significado financeiro de uma operação.

O trabalho não é apenas CSS. A inspeção identificou conta REAL local, depósito simulado, métricas fixas e inconsistências de contrato. Esses problemas precedem o gate de funcionalidade. Uma screenshot não prova autorização, integração, idempotência ou settlement.

## Referências e precedência
1. [Sala desktop](referencias/01-sala-desktop.png): fonte principal do shell no viewport 1024×576.
2. [Seletor](referencias/02-seletor-ativos.png): fonte principal do popup de ativos.
3. [Estados](referencias/03-estados-da-sala.png): operação, resultados, gavetas, conta, depósito, reconexão, celular e onboarding.
4. Documentos anteriores fornecem invariantes, sem substituir as novas referências de layout.
5. Texto, saldos, ativos, preços e trajetórias das imagens são exemplos, não seeds do produto nem especificação de API.

SHA256 das referências:
- 01: 24164BE9F77F90F8AC52F6D9976C0CC0DC4D224E0ABC76AFE865001BB24A46B7
- 02: F5B82C4899468755422B24CD0B4A92164F3F71D8D9E1D9C4F01E2793523E9148
- 03: C6026FC76087ED4E26A8B87439E5C316428C66ADA8E2AFDEFA1BCB1E01C4DEF6

## Leitura dos designers
### Imagem principal
A sala é organizada em cinco regiões: header de aproximadamente 60 px, navegação de 73 px, gráfico central dominante, ticket de aproximadamente 150 px e footer único de aproximadamente 42 px. No viewport de referência o gráfico ocupa x83–873/y61–526. Logo curto, abas com bandeiras, destaque ciano, painel azul escuro, contraste contido e verde/vermelho operacionais.
O ticket agrupa Monto, Expiración e Ganancia em cards; os controles menos/mais ficam ao lado dos valores. O gráfico mantém informação do ativo no alto, ferramentas no canto inferior esquerdo e indicadores de compra/expiração ancorados a tempo e preço.
### Seletor dedicado
Busca, categorias Forex/Cripto/Sintéticos/Favoritos e colunas Activo/Ganancia/Cambio 24h. Seleção de linha, favorito e categoria são ações distintas. A imagem reduzida não comprova a dimensão CSS nativa do popup.
### Mosaico
Os 12 estados compartilham o shell; gavetas aparecem à esquerda do gráfico. O gráfico continua visível durante portfólio/histórico. Resultado é um evento confirmado, não animação de vitória decidida no cliente. Mobile reorganiza o mesmo estado operacional. Onboarding ensina a interface sem executar operações automaticamente.

## Decisões de apresentação deste plano
- Principal governa shell; seletor dedicado governa popup; mosaico governa estados.
- Nova aparência azulada e foco ciano são escolhidos por referência do usuário; manter os tokens anteriores para a sala anterior.
- Amostras de pixels observadas: fundo #0C1722, gráfico #0F1926, card #101925, foco #129BC2. Não são alegadas como CSS original do designer.
- Fontes: reutilizar Archivo e Geist Mono locais existentes; a imagem não comprova a família exata.
- Logo: versão oficial curta BINMAX; sem refazer a marca com texto/imagem gerada.
- Depositar: contornado no desktop principal. Não induzir disponibilidade de pagamento.
- Preço atual: seguir a etiqueta da imagem principal; direção/estado não dependem só de cor.
- SUBE e BAJA: mesma largura, altura, contraste, foco e peso. A diferença aproximada de altura do raster será normalizada.
- Usar Cuenta demo para a carteira DEMO. Nunca rotular a carteira demo como REAL.
- Aviso de risco continua obrigatório e será acomodado como diferença documentada.
- Duração, saldo e payout não são derivados dos números das referências.

## Arquitetura da entrega
### Apresentação
Reutilizar TerminalLayout, TerminalHeader, SidebarDock, AssetCatalogModal, OrderTicket, PriceChart, History e PortfolioDrawer onde sua responsabilidade já corresponde ao novo estado. Estrutura de gaveta compartilhada, estados explícitos de carregamento/erro/vazio e adaptação responsiva.
### Estado
Uma fonte por entidade: conta selecionada, contrato, carteira, catálogo e conexão. IDs de contrato/conta não podem ser implicitamente trocados por mudança de aba. Reaproveitar hooks e funções; não criar um segundo engine dentro do tema.
### Dados e fronteiras
Contratos e schemas existentes são a primeira fonte; comprovar URLs, envelopes e payloads com testes de contrato. Metadados de ativo, payout e variação 24h exigem origem documentada. Ausência não recebe um número aleatório ou fixo.
### Tempo e gráfico
Preservar correção de abertura do gráfico. OHLC oficial não é reancorado; pausas reais não recebem velas inventadas. Contadores usam relógio calibrado do servidor. O contrato mantém preço oficial e expiração oficial.
### Conta real, pagamentos e torneios
A Fase 1 define DEMO. O código atual não comprova conta REAL separada, PSP ou torneios reais. As etapas correspondentes exigem contrato de serviço, regras de negócio e ambiente autorizado. Não inventar gateway, prêmio ou saldo. Estado indisponível honesto é seguro, mas NÃO equivale à feature completa solicitada; essa etapa continua bloqueada até a integração ser comprovada.

## Agentes e skills
| Responsável | Entrega | Skills |
|---|---|---|
| Orquestrador | Plano, handoff, estado, decisões e sequência dos gates | 01,09,20 |
| Mapeador | Arquivos, consumidores, fontes e zonas | 01,16,18 |
| Fidelidade visual + Marca | Leitura das imagens, tokens, geometria e parecer dos screenshots | 11,12,13,14,15 |
| Cirurgião / frontend-realtime-agent | Um passo frontend delimitado por vez | 01,15,17; 11/12/13 conforme domínio |
| chart-trading-engineer | Apresentação e coordenadas dos overlays, sem regenerar mercado | 01,03,06,11 |
| backend-implementation-agent | Somente integração necessária aprovada separadamente | 01,02,04,05,08 |
| qa-resilience-agent | Critérios, regressões, stress, segurança e caos executados | 01,05,06,07,09,19 |
| regression-guardian-agent | Diff, flag desligada, descoberta real dos testes e base | 06,17,19 |
| financial-correctness-reviewer + compliance-risk-reviewer | Dinheiro, tempo, demo/real, idempotência e honestidade | 01,02,05,08,18 |
| security-reviewer | JWT/OIDC, RBAC, BOLA, XSS, segredos e limites | 01,04,08,09 |
| post-implementation-verifier | Pós-condições SQL/Redis/ledger em ambiente descartável | 02,03,06,08,09,10 |

Papéis sem um tool específico usam o agente disponível com instrução de papel em leitura. Carregar o arquivo real em .agents/agents/ quando existir. Não criar/instalar outra definição de agente nesta feature. Máximo de três workers em paralelo; etapas de produto são sequenciais.

## Subetapas e dependências
| # | Documento | Resultado verificável |
|---|---|---|
| 01 | [Inventário e referências](01-inventario-e-referencias.md) | Escopo, fontes, estado atual e riscos rastreados |
| 02 | [Baseline e pré-voo](02-baseline-e-pre-voo.md) | Testes realmente descobertos, ambiente e integrabilidade |
| 03 | [Contratos e verdade dos dados](03-contratos-e-verdade-dos-dados.md) | Fonte oficial coerente, sem fallback financeiro falso |
| 04 | [Isolamento da sala](04-isolamento-da-sala.md) | Flag desligada por padrão e sala anterior preservada |
| 05 | [Tokens e marca](05-tokens-e-marca.md) | Aparência nova isolada e fontes/logo existentes |
| 06 | [Shell desktop](06-shell-desktop.md) | Cinco regiões e footer único fiéis |
| 07 | [Header e contas](07-header-e-contas.md) | Abas reais e conta demo identificada |
| 08 | [Seletor de ativos](08-seletor-de-ativos.md) | Busca/categorias/favoritos/seleção coerentes |
| 09 | [Gráfico e ferramentas](09-grafico-e-ferramentas.md) | Geometria e overlays corretos sem alterar ticks |
| 10 | [Ticket e envio](10-ticket-e-envio.md) | Controles fiéis, parsing e ordem idempotente |
| 11 | [Operações e resultados](11-operacoes-e-resultados.md) | Contratos confirmados e toasts deduplicados |
| 12 | [Portfólio e histórico](12-portfolio-e-historico.md) | Gavetas com dados reais e todos os estados |
| 13 | [Conexão e recuperação](13-conexao-e-recuperacao.md) | Bloqueio em stale e recuperação comprovada |
| 14 | [Conta real e depósito](14-conta-real-e-deposito.md) | Integração autorizada; bloqueada sem serviço |
| 15 | [Torneios](15-torneios.md) | Regras/API/prêmios reais; bloqueada sem serviço |
| 16 | [Onboarding](16-onboarding.md) | Tour acessível, persistente, sem ordens automáticas |
| 17 | [Mobile e tablet](17-mobile-e-tablet.md) | Mesmo estado, responsividade e touch |
| 18 | [Certificação integrada](18-certificacao-integrada.md) | Matriz de estados, regressão, segurança, carga e caos |
| 19 | [Entrega e ativação](19-entrega-e-ativacao.md) | Evidências, rollback e ativação controlada |

Não executar etapa N+1 até o gate de N estar APROVADO. Documentar o roteiro futuro é permitido; iniciar implementação futura não é. Etapa bloqueada não recebe “100%” nem é omitida para concluir a feature.

## Ciclo de cada passo
1. Ler o MD atual e relatório anterior.
2. Validar lista fechada de arquivos e consumidores; snapshot seletivo sem .env/segredos.
3. Handoff tipado: task_id, agent, objective, context, skills, acceptance_criteria, budget.
4. QA escreve regressão que falha com defeito conhecido quando aplicável.
5. Implementador altera uma preocupação por passo: visual e lógica separados.
6. Verificar tipos, lint, testes alvo, build e integração aplicável.
7. Revisores independentes avaliam diff e provas; um veto impede avanço.
8. Screenshot/overlay e checklist de interação para passos visuais.
9. Registrar evidência do SHA e do diff efetivo. Um commit não basta em checkout sujo.
10. Commit apenas do incremento aprovado; nunca git add -A neste checkout.
11. Atualizar ESTADO.md e relatório. Em falha corrigir o passo atual; até três ciclos, sem apagar proteções ou mudar limites para passar.

Orçamento padrão por passo: até cinco arquivos e 150 linhas alteradas. Uma subetapa pode ter vários passos pequenos. Documentação extensa é planejada explicitamente; orçamento de código permanece restrito. Necessidade de novos arquivos/dependência/schema/infra exige refinamento escrito antes de editar. Backend e zona vermelha ficam em passos próprios com revisores financeiro/segurança.

## Gates e evidências
[Protocolo de gates](PROTOCOLO-GATES.md) define níveis e artefatos. [Estado](ESTADO.md) registra o ponto de parada.
- Unit/component não substituem navegador nem integração.
- SSR não prova handlers, Canvas, acessibilidade ou dimensões.
- Simulador local não prova Blnk/Keycloak/Postgres/Redis.
- Caos precisa demonstrar falha realmente injetada; contador local alterado não é kill de processo.
- Stress precisa medir execução real, erros e invariantes; loop de renderização SSR não prova concorrência financeira.
- Revisor ausente, limite de agentes ou CI indisponível: revisão NÃO EXECUTADA, gate bloqueado.
- Não declarar “sem regressões” para gates não executados; separar resultado local e CI.

## Medição visual
Desktop de referência: 1024×576, zoom100%, DPR anotado. Propostas de tolerância: fronteiras do shell ≤4 px, controles ≤8 px e nenhum elemento acima de 10 px sem desvio aceito. Comparar caixas, alinhamentos e contraste; mascarar só valores e trajetórias variáveis. Seletor/mosaico reduzidos: comparar ordem/proporção/presença, não prometer pixel perfeito a partir de miniaturas.
Testar também 1366×768, 1440×900, 1920×1080, 2560×1440, 768×1024, 390×844 e 360×800. Nenhuma ação inacessível por clipping; teclado, foco e targets touch documentados.

## Riscos já identificados
- Conta REAL muda só o rótulo; depósito simulado recarrega DEMO.
- API/BFF /api/v1 versus caminhos/envelopes do frontend; dev feed mascara diferenças.
- Body autenticado inclui duration_seconds/expires_at/expiry_mode fora do schema strict.
- Saldo/payout/rodapé/torneio contêm fontes locais ou fixas.
- Hora local e nova chave por tentativa ameaçam tempo/idempotência.
- Portfólio do sidebar não recebe contratos; mobile existe sem montagem no app.
- Discovery de Vitest exclui partes críticas e chaos; relatórios antigos “100%” não têm provas equivalentes.
- Baseline suja exige preservar alterações anteriores e não enfraquecer testes-oráculo.
- Novas APIs de conta real/depósito/torneio não estão definidas. Documentar dependências antes de desenhar uma integração fictícia.

## Critério final de entrega

### Precedência financeira e dos testes

A autorização original do autor tomou D-19: lucro WIN = floor(stake_minor × 85 / 100), inteiro, payout = stake + lucro. Essa regra não é pendente nesta feature. O servidor calcula com aritmética inteira e o frontend apresenta valores oficiais; stake101 → lucro85/retorno186, stake199 → lucro169/retorno368. Não alterar a governança congelada para repetir a decisão.

[Matriz de aceitação](MATRIZ-ACEITACAO.md) vincula estados, IDs, níveis e evidências. Carga OR-24 prevalece: 300 WS, 50 contratos/min, tick1/s, abertura p95 <200ms, duplicação0/divergência0. O p95 de300ms proposto por material auxiliar não substitui o oráculo.

Reparos necessários ao smoke são subpassos corretivos de02, com handoff próprio. A etapa03 consolida e amplia a matriz de contratos depois da aprovação de02. Relatórios históricos preservam seu checkout; a certificação18 é repetida no checkout entregue.
Todas as19 etapas aprovadas com relatórios, matriz12estados e provas locais/CI necessárias. Nenhum saldo, depósito, prêmio, resultado, mudança24h ou payout inventado. Sem aceitação financeira executada pelo agente em UI. Ações financeiras reais são realizadas pelo responsável autorizado; integração automatizada usa apenas contas/testes descartáveis.

