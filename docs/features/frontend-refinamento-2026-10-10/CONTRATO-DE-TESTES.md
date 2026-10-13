# Contrato de testes obrigatórios — frontend
Estado: especificação de gates; cenários abaixo só são executados quando registrados no relatório.
Baseline executada em RELATORIO-00.md. Esta matriz não representa testes já aprovados.

## Comandos sem sobrescrever trabalho anterior
- `pnpm exec vitest run apps/web --configLoader runner --no-cache` (filtro posicional; NÃO --dir apps/web).
- `pnpm exec tsc -p apps/web/tsconfig.json --noEmit --incremental false`.
- `pnpm exec eslint apps/web/src --ext .ts,.tsx --no-cache` (baseline bloqueada por config ausente). Recuperação proposta: `pnpm exec eslint apps/web/src --config apps/web/eslint.config.mjs --no-cache`; congelar a configuração e não desativar regras para ocultar dívida.
- `pnpm --filter @broker/web exec vite build --outDir ../../scratch/frontend-design-audit-build`.
- Dev auditado: `pnpm --filter @broker/web exec vite --host 127.0.0.1 --port 5186 --strictPort`.
Preservar dist existente. Build Vite separado + typecheck equivalem aos dois componentes do build web; não equivalem a smoke test.
A suíte frontend usa Vitest. SSR não executa efeitos, foco, cliques, rede ou layout. Não chamar SSR de E2E.
O script raiz test:unit não seleciona apps/web; o script test:chaos é incompatível com exclusão atual de tests/chaos na config.
Não modificar a configuração de backend para contornar essa exclusão. Usar casos frontend selecionados explicitamente.

## T-01 — contrato funcional antes da edição
Dado o frontend atual, quando um fluxo é usado, então rota, handlers, arguments, payload, IDs, disabled e valor recebido permanecem iguais após a edição.
Inventariar consumidores por rg e comparar os trechos protegidos byte a byte com backup desta execução.
Teste precisa reprovar se handler deixa de ser chamado ou é chamado duas vezes.
Requisições stubadas validam UI apenas; não substituem integração real nem prova financeira.
Verificar dados vindos de props: zero, negativo, número grande, indisponível e atraso.
Nenhum fallback deve parecer saldo ou medição real.

## T-02 — robustez de interação no browser
Em cada fluxo afetado:
- 100 alternâncias entre duas abas/filtros; seleção e conteúdo final corretos, sem erro não tratado.
- 50 ciclos abrir/fechar diálogo; foco retorna ao acionador, Escape funciona, fundo não recebe ação.
- 50 navegações ida/volta entre duas rotas; uma instância ativa da tela e nenhuma confirmação atrasada da anterior.
- 20 cliques rápidos durante pending: um callback/requisição por ação lógica; caso financeiro somente fixture descartável sem transação externa.
- Desmontar enquanto request está pending; resolver depois; nenhum efeito na rota seguinte.
Se o fluxo não tem diálogo ou request, registrar N/A com justificativa, não fabricar cenário.
Provar ausência de timers/listeners pendentes com instrumentação do harness, não com número de renders SSR.

## T-03 — caos do frontend
Injetar e comprovar falha em boundary de rede do navegador/harness local: offline, timeout, 401, 403, 429, 500, resposta vazia e inválida.
Registrar status/erro efetivamente injetado.
Expectativas: controles de navegação disponíveis, mensagem específica, dado antigo identificado, zero confirmação inventada e zero operação repetida na reconexão.
Retornar online e refazer uma ação explícita: recuperação com estado correto.
Bloquear armazenamento (SecurityError), corromper preferências e simular fonte/mídia indisponível: fallback legível, página funcional.
Não matar Redis/Postgres/Blnk: fora do pedido frontend. Não declarar resiliência desses serviços.
Não simular sucesso de KYC/2FA por timer para satisfazer cenário.

## T-04 — segurança de apresentação
Strings hostis (`<img src=x onerror=alert(1)>`, tags, aspas, URLs javascript, Unicode e texto de 10.000 caracteres) devem permanecer texto, sem elemento/evento executável.
Campos sensíveis não aparecem em logs, status, URL, screenshots ou armazenamento novo.
Nenhum segredo em CSS/artefatos.
Links externos com target blank exigem proteção apropriada.
CSV: conteúdo iniciado por =, +, -, @ tratado pela política existente sem alterar valores financeiros; se falhar, abrir correção própria.
Sessão expirada não vira sucesso na UI. Um rótulo 2FA não prova que o servidor o ativou.
Comparar API/rotas/autorização antes/depois: a reforma não amplia acesso.
Não fazer scan externo nem teste intrusivo em produção.

## T-05 — layout e acessibilidade
Viewports: 390×844, 768×1024, 1366×768, 1920×993; zoom 100% e 150%; reprodução de movimento reduzido.
- Nenhum botão/label/erro necessário fora do viewport ou sob outro controle.
- Medir boundingClientRect de TODOS os controles principais: scrollWidth sozinho é insuficiente (overflow hidden mascara corte).
- Tabela pode rolar dentro de região identificada; a página não deve exigir rolagem lateral para navegação.
- Contraste mínimo 4,5:1 para texto normal e 3:1 para componentes/grandes títulos.
- Alvos principais de toque >=44×44px; foco visível e ordem previsível.
- Todas as tarefas executáveis com teclado; diálogo com nome, foco inicial/restaurado e fechamento apropriado.
- Empty/loading/filled/error/confirmed sem salto que mova ação sob o cursor.
- Informações nunca somente por cor.
- Reduced motion elimina deslocamentos e loops decorativos.
Não falsificar teste automatizado de zoom com redução de viewport. Registrar ferramenta e zoom realmente usados.
Falha de mídia mantém título, instrução e próxima ação.

## T-06 — performance
Baseline no mesmo ambiente, viewport, dados, número de gráficos e modo de build.
10 repetições de medição após aquecimento; registrar mediana/p95 e variação. Não aprovar medição isolada sob runner paralelo.
Meta para novas transições: sem trabalho contínuo quando idle e nenhuma long task >50ms atribuível ao passo na amostra.
Carga DOM: 1.000 linhas ou itens nos componentes que os suportam; filtros corretos, resposta p95 <=200ms no ambiente fixado.
Sala: nenhum novo custo no feed/render e nenhuma mudança em cadência de atualização causada pelo CSS secundário.
Metas propostas precisam baseline; se hardware não permite medir, gate fica pendente. Não aumentar limiar para apagar falha.
Sem k6 para comprovar performance de CSS/browser; carga de servidor fica fora do escopo.

## T-07 — flags e regressão
Tema desligado/ausente/inválido/storage negado: aparência e funcionalidade da base.
Tema ligado: só rotas secundárias previstas recebem estilos.
Comparar screenshots deterministas; congelar dados de fixture, sem falsificar dado em produto.
Sala principal: flag legada e nova, geometria A1–F antes/depois; nenhum desvio novo. Sobreposição IQ apenas nos estados com referência disponível.
A referência IQ desktop real mede1911×993 e inclui cerca de52px de barra do Chrome. A matriz1920×993 é viewport de regressão, não comparação direta dessa imagem. Para sobreposição, registrar área útil/recorte só de browser chrome e escala1:1; não esticar/redimensionar nem comparar coordenadas de origens diferentes.
Não aplicar tolerância IQ 10px às pranchas secundárias, que incluem múltiplos estados e composição ilustrativa.
Se não há captura de referência adequada, marcar bloqueio e preservar a base.

## Gate por passo
Typecheck PASS; lint PASS; testes dirigidos PASS; suíte frontend completa PASS; build PASS; testes T-01 a T-07 aplicáveis PASS; revisão independente PASS.
Antes do handoff, cada AC recebe arquivo/caso de teste exato, ferramenta/harness e comando; não basta mencionar a matriz. Testes de apps/web são escritos pelo frontend-realtime-agent; QA escreve somente tests/** e executa/revisa evidências. Build de nova rodada recebe diretório exclusivo por run/passo, sem sobrescrever esta base.
Qualquer falha nova, antiga não resolvida, cenário obrigatório sem prova ou flake impede avanço.
Um skip/retry automático/asserção enfraquecida não é solução.
Checkpoint contém comandos, exit codes, contagens, logs, screenshots, medidas, diff, hashes e plano de volta.

