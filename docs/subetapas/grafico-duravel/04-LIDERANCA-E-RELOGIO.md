# 04 — Liderança, fencing, relógio e retomada

Agentes: backend, QA e arquiteto; revisões segurança/verificador. Skills 01/03/05/06/08/09/10.
Pré-condição: gate 03 VALIDADA; schema alvo implantável no ambiente efêmero.
Escopo: eleição, loop e repository do runtime escolhido; testes separados por responsabilidade. Nenhum corte de tráfego ainda.

## Passo a passo

1. Antes do patch, oráculo RED com dois processos reais: suspender escritor A após leitura, vencer lease, promover B, retomar A.
2. Atribuir epoch monotônico no PostgreSQL sob lock; lease Redis controla posse, banco rejeita epoch antigo. Não reutilizar epochs após perda/reset Redis.
3. Exigir predecessor, sequência e epoch na escrita. Zero linha afetada significa perda de autoridade; abortar lote, não publicar.
4. Serializar geração e eleição; nenhuma sobreposição de callbacks async. Reidratar preço/seq/hash/tempo a cada aquisição e após resultado de commit desconhecido.
5. Atualizar estado em memória somente após confirmação ou releitura conclusiva. Nunca gerar novos preços de um passo que falhou.
6. Usar agendamento monotônico; timestamp canônico definido antes da transação, nunca retrocede. Downtime permanece lacuna de tempo, sem ticks inventados.
7. Encerramento gracioso termina transação e libera somente lease do próprio dono. Falha Redis remove autoridade local de gerar.

## Testes de aceite

- AC-GD-04-1: dois produtores/20 disputas; exatamente um dono vigente, stale writer sempre rejeitado e zero bifurcação.
- AC-GD-04-2: kill real do líder; sucessor continua predecessor confirmado. Registrar janela de failover separada da cadência normal.
- AC-GD-04-3: Redis reiniciado/perde contador; epoch novo > qualquer epoch anterior; escritor antigo não volta a ser válido.
- AC-GD-04-4: PostgreSQL indisponível 60s e commit incerto; zero tick oficial publicado sem persistência; recuperação consulta log antes de repetir.
- AC-GD-04-5: relógio injetado volta/avança 5s; timestamps não regressam, agendamento não acumula deriva e não inventa backfill.
- AC-GD-04-6: fonte aleatória de produção usa crypto; teste determinístico comprova primeiro passo saindo exatamente do preço confirmado, sem reset ao catálogo.

Stress: 36 símbolos a 1 Hz, 20 concorrentes maliciosos no símbolo de teste, pools limitados e deadlines. Medir taxas e lag; critérios funcionais = zero inconsistência.
Caos deve comprovar PID morto, lease expirado, reconexão e epoch antes/depois. Não basta testar flags em memória.
Gate: V-02/V-03/V-04/V-13, nenhum tick fora da autoridade no banco, regressão e revisão independentes. Rollback mantém log e impede executar simultaneamente versões geradoras incompatíveis.
