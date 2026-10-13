# Inventário de preservação de contas — execução pendente

O proprietário confirmou que contas existentes devem permanecer acessíveis.
**Ainda falta identificar qual ambiente contém as contas autoritativas.** Os
contêineres `fase1-test-*` da máquina não são presumidos como fonte. Nenhuma
conta real, contrato ou lançamento Blnk foi alterado.

## Passo 1 — congelar a fonte e coletar contagens sem PII

Executar como transação PostgreSQL `READ ONLY` no ambiente identificado, com
saída registrada fora do repositório se houver dados sensíveis:

```sql
BEGIN TRANSACTION READ ONLY;
SELECT count(*) AS users_total,
       count(*) FILTER (WHERE id = '00000000-0000-4000-8000-000000000001') AS demo_seed
FROM users;
SELECT count(*) AS contracts_total,
       count(DISTINCT user_id) AS principals_with_contracts
FROM contracts;
SELECT count(DISTINCT c.user_id) AS principals_without_user_row,
       count(*) AS contracts_without_user_row
FROM contracts c LEFT JOIN users u ON u.id = c.user_id
WHERE u.id IS NULL;
SELECT to_regclass('public.identity_subject_links') AS identity_links_table;
COMMIT;
```

Não exportar `password_hash`, `password_salt`, email, token ou UUID individual
para relatório público. Se houver contratos sem linha em `users`, bloquear o
vínculo automático e investigar a origem desses UUIDs.

## Passo 2 — reconciliar Blnk por UUID, somente leitura

Para cada principal identificado, procurar no Blnk os identificadores que o
adaptador legado **esperava** (`@user_<UUID>:available`,
`@user_<UUID>:reserved`, `onboarding:<UUID>`) e as contas/saldos reais que a
versão implantada suporta. A prova com Blnk isolado mostrou que o adaptador
atual não cria essas contas; portanto, não assumir que existam. Fazer apenas
leituras, sem criar contas nem emitir transações. Registrar apenas
quantos UUIDs têm zero, uma ou ambas as contas, quantas referências de crédito
inicial existem e se há duplicatas. Fazer snapshot verificável antes de
qualquer migração. Se o serviço não suportar consulta de referência, registrar
essa lacuna e bloquear o crédito automático para legados até reconciliação.

## Passo 3 — contas que só existem no navegador

`localStorage` é por navegador e não permite inventário completo pelo servidor.
Esses registros não serão tratados como identidades válidas nem associados por
email simples. O fluxo de reivindicação precisa comprovar posse do email ou
outro fator aprovado e registrar método, data e `sub` Keycloak antes de criar
o vínculo. Até esse fluxo existir e ser testado, esse grupo permanece pendente.

## Passo 4 — reconciliação e gate

Comparar totais de `users`, UUIDs com contratos, contas Blnk e vínculos
Keycloak. Para cada divergência, registrar causa e decisão antes de aplicar
qualquer escrita. Repetir a mesma leitura depois da migração e provar que
nenhum contrato mudou de dono e nenhum crédito `onboarding:<UUID>` foi
duplicado. Aprovação financeira e de segurança é obrigatória para fechar o
gate 02.
