# Subetapa 05 — estresse e caos em ambiente descartável

Responsáveis: `qa-resilience-agent`, revisões `security-reviewer` e `financial-correctness-reviewer`. Skills: 01, 02, 04, 05, 06, 07, 08, 09.

## Passo a passo

1. Incluir `assertNotProduction()` no início de cada ensaio; registrar endpoint, rede, IDs de contêiner e versão. Gerar usuários e emails sintéticos únicos por execução.
2. Carga: rampa de cadastro, login, logout e leitura `/me`, medindo p50/p95/p99, taxa de 4xx esperada, 5xx, timeout e saturação de conexões. Thresholds de aprovação definidos antes do ensaio e reprovam a execução.
3. Concorrência: repetir cadastro com o mesmo email 2× e N×; confirmar uma identidade, um vínculo de carteira, um provisionamento Blnk e nenhuma sessão cruzada.
4. Caos: parar/reiniciar Keycloak, banco de identidade, API e Blnk separadamente durante cadastro/login/provisionamento. Provar que a falha foi injetada (health/PID/erro de rede) e que o cliente não recebeu sucesso falso.
5. Recuperação: reiniciar dependência, repetir operação com chave estável, confirmar ausência de usuário órfão, duplicado, token indevido e divergência no Blnk.
6. Comparar contagem de identidades, vínculos e saldos antes/depois; verificar logs redigidos e ausência de eventos financeiros duplicados.

## Critérios de aceite

- AC-AUTH-16: Sob perfil de carga previamente fixado, p95 e erro ficam abaixo dos limites documentados e nenhuma pós-condição de integridade falha.
- AC-AUTH-17: Em cada indisponibilidade comprovada, cadastro/login falham fechados e a recuperação mantém exatamente uma identidade e uma carteira por `sub`.
- AC-AUTH-18: Após reinício, reconciliação Blnk/identidade/vínculo tem zero divergência e nenhum token ou senha aparece nos logs.

Gate: relatório de execução real com thresholds, falha injetada demonstrada e consultas pós-caos. Resultado não executado ou com limite ainda indefinido permanece pendente.
