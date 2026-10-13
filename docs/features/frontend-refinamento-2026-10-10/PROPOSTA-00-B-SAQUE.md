# Proposta00-B — correção funcional protegida do frontend de saque
Estado: AUTORIZADO ESPECIFICAMENTE PELO USUÁRIO nesta conversa em10/10/2026; IMPLEMENTADO e aprovado no escopo funcional00-B. Ver RELATORIO-00-B.md. Gate00 global ainda bloqueado.
Não é uma subetapa visual nem autoriza alterar backend/API/ledger.

## Causa observada
BinmaxWithdrawModal.tsx:52–55 anuncia sucesso após600ms e só então chama callback void. Não há retorno financeiro confirmado. WithdrawPage.tsx:15 fornece callback que apenas navega para /operar.
O teste3.3 exige método, avisoKYC e estado do último saque; a interface atual diverge. Criar um saque fictício para satisfazer esse teste seria incorreto.

## Contrato proposto para aprovação
- Tornar explícito o caráter demonstrativo quando não há resultado confirmado do serviço.
- Preservar métodos, mínimo,parse,props,callbacks e rotas existentes; sem enviar transação externa.
- Não anunciar fundos enviados/pagamento processado a partir de timer ou navegação.
- Restabelecer informaçãoKYC junto da ação; não fingir verificação/aprovação de identidade.
- Quando não há histórico confirmado, mostrar indisponibilidade/vazio, sem inventar último retiro em revisão.
- Manter resposta visual e navegação existentes somente como demonstração identificada; não desativar silenciosamente um fluxo real.
- Qualquer necessidade de contrato assíncrono novo ou API é outro escopo, bloqueado nesta proposta.

## Arquivos candidatos e divisão
PassoB1: apps/web/src/wallet/binmax-wallet.unit.test.tsx, wallet/wallet-precision-stress.unit.test.tsx e fixture browser local apps/web/tests/design/withdraw-fixture.html. A fixture monta o modal real emStrictMode e registra callbacks localmente; nenhuma requisição de saque externo. Controles de ráfaga/close/unmount são exclusivos da fixture.
PassoB2: apps/web/src/wallet/BinmaxWithdrawModal.tsx, somente cadeia causal e copy correspondentes; até150linhas. O rótulo/texto deve usar i18n existente em passo próprio se necessário.
PassoB3: revisão independente de regressão/risco; suíte completa e relatório. Nenhum avanço para01 enquanto00 não passar.

## Provas obrigatórias antes/depois
1. No estado atual, fixture sem adapter confirmado submete somente dados sintéticos: reproduzir falsa confirmação financeira por timer; teste vermelho.
2. Depois: estado explícito demonstrativo/indisponível, nenhuma frase de fundos enviados sem confirmação; teste verde.
3. Vinte cliques pending: callback lógico exatamente uma vez; nenhuma requisição financeira externa.
4. Fechar/desmontar antes do timer terminar: nenhum callback atrasado na próxima tela; falha vira correção causal coberta.
5. Monto menor que50, destino vazio e texto hostil: validação intacta, sem execuçãoDOM.
6. AvisoKYC/estado vazio legíveis, teclado,foco,mobile,reduced motion.
7. Nenhum dado financeiro fixo novo; backend e API sem diff.
8. Teste3.3 alinhado ao contrato honesto acima somente após aprovação; manter assertions de métodos,mínimo,formulário,risco e disponibilidade de histórico.

## Por que precisa de autorização específica
Skill zonas-sensiveis: "Só com aprovação escrita do dono, e nunca junto com mudança visual" para lógica de acesso/depósito/saque. O pedido atual é de design; corrigir o handler de confirmação atravessa essa fronteira.
Backup da base local antes de qualquer patch. Rollback só do patch deste passo; nunca restore/reset amplo.
