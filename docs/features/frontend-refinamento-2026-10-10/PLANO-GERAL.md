# Refinamento do frontend BINMAX — plano geral
Data: 10/10/2026. Responsável: tech-lead-orchestrator (conversa principal).
Escopo autorizado: frontend, diagnóstico, plano, testes e implementação sequencial após gates.
Referências: `docs/docs id visual/paginas secundarias` (18 PNGs inspecionados).
Base Git: `d67aeaf926588e4acac63aa106a0c40593183aca`, branch `codex/binmax-reference-room`.
A base efetiva inclui alterações locais anteriores; o SHA sozinho não representa os arquivos auditados.

## Estado real
**00 EXECUTADA / REPROVADA. 01–10 BLOQUEADAS PELO GATE 00.**
Recuperação 00-A aprovada: quatro testes com contratos obsoletos corrigidos após reprodução vermelha. Correção funcional 00-B autorizada separadamente pelo usuário e aprovada: modal de retirada demo e dicionário espanhol. Suíte independente: 528/528 PASS. Não houve deploy, commit ou alteração de backend.
O pedido já autoriza implementar após validação: não será pedida outra aprovação genérica do plano.
Não substituir os planos anteriores: este documento delimita uma nova execução estritamente frontend.

## Diagnóstico
O projeto tem componentes e tokens aproveitáveis; falta aplicação consistente.
A combinação de CSS global, estilos inline, superfícies concorrentes, tipografia pesada e linguagem técnica desnecessária reduz clareza e acabamento.
No navegador a 390×844, o botão Criar cuenta do cabeçalho de Análisis termina em x=911,14px: está fora da área visível. O documento reporta scrollWidth=390 porque overflow é ocultado. Portanto somente testar ausência de scrollbar daria um falso positivo.
Há informação demonstrativa apresentada como pessoal: 16ms literal, saldo de fallback, métricas estáticas, contratos de amostra mesclados com reais, estados locais de KYC e segurança. Não são novos defeitos introduzidos por esta execução; precisam de triagem independente.

## Direção visual
- Facilidade: título curto, uma tarefa principal, ajuda próxima ao campo, navegação previsível e condições visíveis.
- Acabamento: profundidade tonal, linhas discretas, respiro por contexto, ícones oficiais, alinhamento e tipografia legível.
- Satisfação visual: feedback imediato ao comando e confirmação verdadeira da tarefa; nenhuma comemoração financeira artificial.
- Identidade: prata para marca/foco, verde e vermelho para significados financeiros já existentes, sem verde decorativo.
- Linguagem: espanhol simples. Detalhes técnicos somente quando ajudam uma decisão.
- Motion: 100/180/260/500ms, cubic-bezier(0.16,1,0.3,1), uma entrada por página; reduced motion respeitado.
- Sala principal: facilidade e geometria A1–F preservadas; primeiro proteger e comparar. Não redesenhar gráfico ou ticket nesta execução.
- Não copiar as pranchas literalmente: múltiplos estados na mesma imagem são exemplos, não telas simultâneas.

## Agentes e skills
| Agente | Responsabilidade | Skills |
|---|---|---|
| tech-lead-orchestrator | Plano, sequência, checkpoint e decisão de gate | 01, conduzir-etapa, mudança-cirúrgica, 09 |
| codebase-mapper-agent | Rotas, consumidores, zonas sensíveis | 01, mapear-projeto, zonas-sensiveis |
| chief-visual-director | Composição, facilidade, marca e motion | 21, tokens-binmax, textos-es |
| surgical-frontend-agent | Só o passo atual em lista fechada de apps/web | mudança-cirúrgica, chave-sala-nova, tokens-binmax |
| frontend-realtime-agent | Escreve testes unitários de front em apps/web dentro da lista fechada | 01, 06 |
| qa-resilience-agent | Executa testes e escreve somente tests/**; nunca escreve apps/web | 06, testes-de-regressao |
| regression-guardian-agent | Verificação independente; veto técnico | 06, testes-de-regressao |
| binmax-brand-agent | Tokens, logo e microcopy | tokens-binmax, textos-es |
| compliance-risk-reviewer | Honestidade de dados e preservação financeira | 01, 02, zonas-sensiveis |
| security-reviewer | Revisão das fronteiras de acesso sem editar | 04, 09 |
| iq-fidelity-reviewer | Veto à mudança não autorizada da sala | teste-de-sobreposicao, 11 |
Agentes efetivamente convocados para diagnóstico: mapeador, diretor visual e guardião.
Os demais são convocados no gate correspondente; não declarar parecer ainda não emitido.

## Decisões de escopo
Não reutilizar o plano antigo de páginas secundárias como autorização para endpoints, migrations ou integração financeira.
Não modificar auth/**, feed/**, api/client.ts, router, App.tsx, gráfico, ticket, backend, infraestrutura ou dependências em passos visuais.
Arquivos de página misturam comportamento e apresentação: somente atributos e estilos delimitados podem mudar.
NEW_TRADEROOM atualmente tem default true; páginas secundárias não possuem porta antiga/nova. Não mudar essa flag para resolver cosmeticamente outro problema.
O novo tema secundário deve ter escopo próprio e opt-in seguro, decidido antes da renderização. Criar uma porta de apresentação em etapa própria, sem copiar hooks ou dados.
O helper secundário tem decisão estável por entrada de página. Cada root independente (Login, Register, Recovery, Landing) recebe escopo em seu próprio passo; os modais financeiros também precisam escopo explícito. SecondaryLayout sozinho não protege essas árvores. Sem opt-in nesses roots, preservar a versão atual e não carregar sua apresentação nova.
Tokens globais em :root não serão usados como ponto de reforma: aliases locais e revisão dos consumidores.
As fontes globais atuais são preservadas. No novo escopo, prevalecem as instruções AGENTS.md fornecidas nesta conversa: superfícies #0B0E14/#101622/#151D2B/#1C2738 e Geist UI + Geist Mono em números. Trechos conflitantes da skill21/manual histórico não substituem esse contrato. Não recompor nem editar o BinmaxLogo compartilhado.

## Contrato de tokens do novo escopo
Precedência: instrução humana/AGENTS atual → este contrato explícito → documentos históricos nos pontos sem conflito. Esse contrato não muda a sala ou tokens globais.
| Papel | Valor local | Origem |
|---|---|---|
| Fundo | #0B0E14 | AGENTS/design-tokens.bg0 |
| Zona estrutural | #101622 | AGENTS/design-tokens.bg1 |
| Painel | #151D2B | AGENTS/design-tokens.bg2 |
| Campo ativo | #1C2738 | AGENTS/design-tokens.bg3 |
| Texto forte/principal | #F4F5F7/#DCE1EA | Tokens atuais e manual |
| Texto secundário/instruções | #8A92A1 | Manual/tokens; contraste AA |
| Dinheiro/erro | #22C47A/#F2545B | Manual/tokens; só significado existente |
| Marca/foco | #DCE1EA | Prata oficial; sem verde decorativo |
| Borda | rgba(138,146,161,0.16) | Token line atual |
| UI/números | Geist/Geist Mono | AGENTS atual; fallback existente se fonte indisponível |
| Tipografia | 12/14/16/24px;400/500/700 | Direção21 no escopo secundário |
| Espaçamento | 4/8/12/16/24/32/48/64px | AGENTS atual |
| Raio | 6px controles,8px estrutura | Tokens atuais |
Âmbar/azul somente para estados existentes pendentes/informativos: #E8A33D/#4D8DFF dos tokens atuais, sem decoração. text-quiet#596273 excluído de ajuda,legal,labels e instruções novas. Não duplicar hex fora do arquivo de aliases local.
Marca: para substituir glifo improvisado em páginas secundárias, preferir arquivos SVG oficiais existentes em public/brand, com tamanho/alt e área de proteção. BinmaxLogo compartilhado já usa Geist no wordmark e diverge do manual Archivo Expanded; não modificar esse consumidor global na reforma. Escolher variante local SVG em passo de marca, validando a imagem efetiva, sem mudar sala/header principal.
Microcopy: usar i18n existente. Texto novo entra em apps/web/src/i18n/locales/es-ES.json com tabela anterior→novo→chave→arquivo e sem traduzir lógica. Vocabulário: Cuenta demo, tratamento tú, termos simples. Não inferir que trocar seletor ES/PT realmente traduza toda a página; esse comportamento precisa prova própria.

## Subetapas
| ID | Arquivo | Entrega | Estado |
|---|---|---|---|
| 00 | [Base e recuperação](subetapas/00-base-e-recuperacao.md) | Baseline, triagem e provas robustas antes de produção | REPROVADA |
| 01 | [Isolamento e fundação](subetapas/01-isolamento-e-fundacao.md) | Porta visual, tokens locais, proteção da sala | BLOQUEADA |
| 02 | [Shell e responsividade](subetapas/02-shell-e-responsividade.md) | Cabeçalho, navegação e rodapé utilizáveis | BLOQUEADA |
| 03 | [Acesso](subetapas/03-acesso.md) | Login, registro e recuperação | BLOQUEADA |
| 04 | [Histórico e análise](subetapas/04-historico-e-analise.md) | Leitura de resultados com hierarquia honesta | BLOQUEADA |
| 05 | [Tutoriais](subetapas/05-tutoriais.md) | Conteúdo e navegação editorial simples | BLOQUEADA |
| 06 | [Conta e verificação](subetapas/06-conta-e-verificacao.md) | Composição e ajuda; segurança não simulada | BLOQUEADA |
| 07 | [Carteira](subetapas/07-carteira.md) | Apresentação de depósito e retirada | BLOQUEADA |
| 08 | [Torneios e promoções](subetapas/08-torneios-e-promocoes.md) | Lista, condições e estados legíveis | BLOQUEADA |
| 09 | [Landing e sistema](subetapas/09-landing-e-sistema.md) | Marca oficial, entrada, manutenção e 404 | BLOQUEADA |
| 10 | [Certificação](subetapas/10-certificacao.md) | Evidência integrada e rollback testado | BLOQUEADA |

## Regra de execução
1. Ler relatório anterior: qualquer FAIL/BLOQUEADO impede próximo ID.
2. Congelar entradas, arquivos e critérios. Registrar hashes dos arquivos já modificados pelo dono.
3. Escrever e executar os testes de comportamento relevantes antes de produção. Para correção, demonstrar vermelho antes e verde depois.
4. Delegar apenas um passo: até 5 arquivos e 150 linhas somadas de código/testes por passo. Dividir em novos passos quando exceder.
5. Preservar handlers, props, IDs, analytics, disabled, cálculos e payloads.
6. Executar testes direcionados, suíte frontend completa, typecheck, lint, build isolado e provas de navegador do [contrato](CONTRATO-DE-TESTES.md).
7. Guardião e revisores correspondentes avaliam diff e evidências. PASS só para verificações executadas.
8. Registrar resultado e rollback. Só avançar se todos os critérios obrigatórios forem PASS.
9. Nunca ignorar, apagar, relaxar ou substituir uma assertion para produzir verde sem resolver seu contrato.

## Gate e limites
100% significa todos os critérios definidos da etapa comprovados, não garantia absoluta de ausência de falhas.
Erro conhecido na base é registrado, mas não promovido automaticamente a exceção: o usuário exige gate estrito.
Segurança DOM/frontend não prova JWT, ledger, KYC, pagamentos ou resiliência dos serviços.
Falhas protegidas são relatadas e tratadas em correção causal separada; não corrigidas escondidas na reforma visual.
Faltam provas browser completas e controles funcionais em algumas telas. Não chamar protótipo de fluxo seguro.

## Próxima ação concreta
Passo00-A PASS: quatro testes obsoletos (auth-precision-stress,verification-precision-stress,tokens-precision eSecondaryLayout), 49 linhas; reprodução vermelha e 18/18 verdes, com revisão independente. Nenhum arquivo de produção incluído.
Passo00-B PASS no escopo funcional autorizado: quatro arquivos, 120 linhas; 9/9 focados, tipos, build isolado e suíte independente 528/528 verdes. Browser: 20 envios resultam em um callback; close/unmount cancelam; erro síncrono não conclui; validações e escape preservados; 50 ciclos reais. Ver RELATORIO-00-B.md. Não certifica pagamentos reais nem corrige débitos globais de UX.
Passo00-C configuração aprovada: lint pela raiz agora executa com presets oficiais; FAIL172erros/79arquivos, sem supressões. Ver RELATORIO-00-CD.md.
Passo00-D perfil sem concorrência aprovado:10amostras<45ms,28.800velas íntegras; primeira rodada sob pressão reprovada preservada. Não certifica saturação/browser.
Recuperação 00-E autorizada pelo usuário ao pedir "continue" após a pergunta específica. Lote 00-E-01A PASS: quatro arquivos, 23 linhas, lint local 11→0, 26 testes dirigidos antes/depois e suíte 529/529; tipos/build e geometria da sala aprovados. Ver [relatório](RELATORIO-00-E-01A.md). Os três catches do AuthService exigem proposta funcional separada, fora da autorização de declarações.
Novo checkpoint após mudanças concorrentes em idiomas: lint integral 190 erros em 76 arquivos, 212 examinados. O aumento fora do lote vem de i18n/index.tsx (8→17) e novo teste language-selector-persistence (14 erros); não revertemos esse trabalho. Evidência lint-pos-00E01A.json. Suíte atual 534/534 em 106 arquivos, tipos PASS, build do workspace Vite 6 PASS; ver relatório. O novo oráculo de erro auth fica fora desse verde e exige correção própria. Etapas 01–10 continuam bloqueadas até todos os critérios obrigatórios do gate 00 passarem.
Recuperar o gate 00: alinhar contratos obsoletos com especificação congelada, reproduzir retirada/KYC/estado anterior, corrigir a causa autorizada e reparar lint no escopo frontend.
O defeito de retirada foi corrigido no escopo demo autorizado em 00-B. Pendências de outros fluxos precisam de triagem própria; ocultar assertions não é aceitável.
Próxima ação delimitada: [00-E-01B](PROPOSTA-00-E-01B-AUTH.md), pergunta específica pendente. Guards apareceram no AuthService fora do lote; foram preservados e revisados, autoria não determinada. Oráculo ampliado 256/256 PASS nesse checkpoint, com zero escrita para malformados e tipos do teste PASS. Não equivale a fechamento do lote, certificação de IAM ou autorização para editá-lo.
Veja [relatório inicial](RELATORIO-00.md) e [diagnóstico](DIAGNOSTICO.md).

