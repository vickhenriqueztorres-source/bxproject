# Protocolo de gates — BMR
## Estados
PLANNED → RUNNING → REVIEW → APPROVED. Falha: FAILED. Dependência ausente: BLOCKED.
APPROVED exige todos os critérios obrigatórios atendidos com provas; N/A exige motivo concreto revisado. Não classificar segurança ou integração ausente como N/A só para avançar.
## Registro obrigatório
ID da etapa/passo; agente; hora UTC; SHA; hash/diff da árvore testada; comando; exit code; testes descobertos e executados; duração; relatório bruto; screenshot; revisores/veredito; limitações e rollback. Evidências não contêm tokens/segredos.
Artefatos locais: .orchestrator/binmax-reference-room/. Relatórios duráveis: relatorios/ nesta pasta. CI, quando exigido, ligado ao SHA correspondente.
## Comandos atuais (verificados no manifesto/config)
- pnpm --filter @broker/web build: tsc + Vite.
- pnpm exec vitest run apps/web/src tests/unit: baseline explícita do frontend e unit.
- pnpm lint: script da raiz; confirmar descoberta e config antes de chamar PASS.
- pnpm test:int / test:chaos / test:load: existem, mas a descoberta atual e o ambiente precisam ser reparados/validados antes de servirem como gate.
## Gate mínimo por tipo
| Tipo | Provas |
|---|---|
| Documentação/inventário | Referências imutáveis, fontes arquivo:linha, escopo sem contradições e revisão |
| Visual | Tipos/build/testes existentes, browser nos estados, flag OFF idêntica, screenshots/overlay aprovados |
| Estado cliente | Eventos reais de DOM, duplicatas/fora de ordem, desmontagem, armazenamento negado, acessibilidade |
| API/financeiro | Contrato/schema, JWT/BOLA/RBAC, idempotência concorrente, dependência caída e ledger real reconciliado |
| Feed/tempo | Sequência, snapshot/replay, desvio do relógio, staleness, memória/buffer limitado, recuperação |
| Pagamento/torneio | Sandbox autorizado, assinatura/replay webhook, efeito1×, conta certa, auditabilidade |
## Segurança e abuso
Rejeitar mass assignment; IDs de outro usuário devem falhar no servidor. Não usar innerHTML para ativo/erro/resultado. Não persistir bearer tokens em armazenamento acessível ao app. Validar URL de pagamento, evitar openredirect; não registrar PII/tokens. Catálogo malicioso, strings longas e payload corrompido não podem alterar DOM fora do componente.
## Stress
Metas abaixo são propostas de produto, não resultados medidos:
- Gráfico: orçamento de frame16,7 ms para meta60 fps; medir p95/tarefas longas no dispositivo declarado.
- 1000 ciclos de abrir/fechar/selecionar, com recursos liberados e sem crescimento linear de listeners/WS.
- Rajada de50000 ticks em harness determinístico para OHLC/sequence; browser com perfil real separado.
- Estado de listas:10000 registros através da estratégia de paginação/virtualização existente; sem DOM10000linhas obrigatório.
- Soak 30min: medir série temporal de heap, subscriptions e frame; após GC controlado sem crescimento monotônico injustificado.
- Perfil API/WS de carga segue skills/06/references/api-guide.md e oráculos existentes; nunca declarar capacidade de produção de um SSRloop.
Nenhum limiar financeiro ou oráculo protegido pode ser enfraquecido. Prevalecem OR-24 de docs/fase-1/09-oraculos.md e ORCHESTRATOR: 300 WS, 50 contratos/min, tick 1/s, abertura p95 <200ms, zero duplicação e divergência. P95 300ms em material auxiliar não é o gate. Outros budgets são propostas até decisão e medição do dispositivo/janela/amostra.

D-19 foi aceita expressamente pelo autor: lucro WIN inteiro por floor(stake_minor ×85/100); payout = stake + lucro. Não é uma decisão pendente nesta feature. Não alterar skills congeladas; frontend apresenta valores do servidor.

Aplicar a MATRIZ-ACEITACAO.md: contraste, hitboxes e recursos vivos têm critérios objetivos. Heap pode oscilar; exigir estabilização após aquecimento, com sockets/listeners/observers retornando à base após desmontagem.
## Caos
Usar ambiente efêmero isolado. Provar processo/rede que falhou e recuperar. Cenários: timeout REST, fechamento WS/duplicate/reordered/gap, tokenexpirado, limite de armazenamento, callback apósunmount, servidorrestarted, Blnk/Redis indisponíveis.
Pós-condições financeiras: soma0, reconciliação0, efeito1×, contrato/status correto, DLQ esperada. Sem criação de novo preço/saldo “para não travar”.
## Escopo, flag e rollback
Flag nova independente, OFF por padrão; preservar NEW_TRADEROOM e seus usuários existentes.
Passos visuais não alteram cliente API, auth, feed, dinheiro, parse, expiry, IDs ou callbacks.
Diff contra cópia imediatamente anterior; nunca restaurar o arquivo inteiro de uma baseline Git que omite alterações do usuário.
Rollback de incremento aprovado por commit seletivo/reversão; em checkout sujo aplicar apenas inverso do incremento. Sem reset--hard, down-v ou limpeza de dados.
## Regra de parada
Qualquer falha financeira, de autorização, teste-oráculo ou revisão obrigatória bloqueia a próxima etapa. Registrar prova e correção necessária. Infra não disponível não equivale a teste verde. A indisponibilidade de pagamentos/real/torneio bloqueia a funcionalidade correspondente.

