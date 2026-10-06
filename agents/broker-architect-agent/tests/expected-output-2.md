# Expected Output 2

## Saída Esperada do broker-architect-agent
1. Apresentação da barreira atômica de Solvência:
   - Teto de risco fixado em 3% do capital total de float da corretora por vela de expiração.
2. Execução sub-milissegundo via script Lua no Redis:
   - Verificação atômica de `(current_exposure + additional_risk) <= max_cap`.
   - Rejeição imediata com HTTP `422 RISK_CAP_EXCEEDED` sem onerar o banco de dados.
3. Trava visual de 30 segundos no frontend:
   - Bloqueio de novas compras nos últimos 30 segundos da vela atual.
4. Preservação matemática da integridade financeira e blindagem contra insolvência.
