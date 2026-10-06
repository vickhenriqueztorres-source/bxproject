# Fase 0 — preparação humana (antes de ligar a IDE)

Tudo aqui depende de você. Pule um item e a corrida trava no pré-voo ou, pior, roda com decisões inventadas.
Faça na ordem.

## 1. Repositório do produto

```bash
mkdir indices-sinteticos && cd indices-sinteticos && git init -b main
cp -r <este-repo>/{ORCHESTRATOR.md,agents,skills,docs} .      # mesmos caminhos relativos
printf '.orchestrator/\nnode_modules/\n.env\n.env.*\n!.env.example\ntests/reports/\n' > .gitignore
mkdir -p docs/vendor
git add -A && git commit -m "governança da Fase 1"
```

- O site Next.js deste repositório **não** vai para o produto; só os quatro itens acima.
- `.orchestrator/` fora do git é obrigatório: o `gate.sh` reprova se não estiver no `.gitignore`.
- Remoto (GitHub) é recomendado como backup. Se usar, marque `REMOTE_PUSH: sim` no item 7.

## 2. Máquina da corrida

| Item | Mínimo | Conferir |
|---|---|---|
| Docker Engine + Compose v2 | Rodando sem `sudo` | `docker info && docker compose version` |
| RAM | 16 GB (Keycloak, Blnk, Postgres, Redis, Grafana, Loki, k6 juntos) | — |
| Disco livre | 30 GB | `df -h` |
| Node.js LTS + pnpm | Versões do item 4 | `node -v && pnpm -v` |
| IDE com modo headless | Claude Code (`claude -p`), Cursor CLI ou equivalente | `<cmd> --help` |
| k6 | Instalado | `k6 version` |
| Energia e sono | Notebook na tomada; suspensão desligada | — |

**Isolamento:** o modo headless roda comandos sem pedir permissão. Rode numa VM ou devcontainer **sem**
credenciais de produção, chaves de nuvem ou SSH pessoal. A corrida não precisa de nada disso.

## 3. Decisões que só você pode tomar (L-06)

Edite `skills/01-project-context/SKILL.md` e troque `Pendente` por `Tomada` com a escolha.

| ID | Pergunta | Recomendação | Por quê |
|---|---|---|---|
| D-16 | React Admin ou Refine? | **React Admin** | Lista, filtro e busca prontos com `ra-data-simple-rest`; menos código gerado pela IA (F-11). App separado `apps/admin` |
| D-17 | RDS Multi-AZ em staging/prod? | **Fase 1 do TCC: Docker Compose em dev e na máquina da demo.** RDS documentado como Fase 2 | RDS não é demonstrável na banca e consome tempo de infraestrutura |
| D-19 | Arredondamento do lucro de 85% | **`profit_minor = floor(stake_minor * 85 / 100)`** em inteiros; `payout_minor = stake_minor + profit_minor` | A favor da casa, determinístico, sem float. Ex.: 101 → 85 de lucro |

Texto sugerido para a linha D-19:

```text
| D-19 | Lucro do WIN = floor(stake_minor * 85 / 100), inteiro; payout = stake + lucro | Tomada |
```

Confirme também (já estão no PRD; só não mude sem atualizar `09-oraculos.md`):

- Stake: `100 ≤ stake_minor ≤ 10000` (US$ 1,00 a US$ 100,00), inteiro em centavos.
- DRAW = preço de saída igual ao de entrada → stake devolvido.
- Expiração 60 s; tick de saída = **primeiro** tick com `ts ≥ expires_at`.
- Moeda USD (D-18), exibida em `pt-BR` como `US$ 10.000,00`.
- MFA: opcional para `USER`; obrigatório para `ADMIN` e `AUDITOR` (skill 04, S-01).

## 4. Versões fixadas (P-02)

```bash
bash docs/fase-1/scripts/pin-versions.sh      # precisa de rede e Docker
```

O script resolve a versão exata de cada pacote e o digest de cada imagem e grava
`docs/fase-1/versoes.lock.md`. Revise 2 minutos: nenhuma linha pode ficar `FALHOU`. As majors estão em
`08-versoes-fixadas.md`.

## 5. Documentação oficial anexada (combate F-01)

Salve em `docs/vendor/<lib>/` as páginas da **versão fixada** (Imprimir → PDF, ou copiar o texto para `.md`):

| Pasta | O que salvar | Usado em |
|---|---|---|
| `blnk/` | Ledgers, Balances, Transactions (incluindo `inflight`, `reference`, `precision`), erros | T04, T09, T10, T11 |
| `keycloak/` | Realm import/export, clients OIDC + PKCE, required actions (verify email, TOTP), health na porta de management | T01, T02 |
| `lightweight-charts/` | Getting started da v5, `addSeries` + `CandlestickSeries`, `series.update`, formato de tempo `UTCTimestamp` | T13 |
| `oidc-client-ts/` | `UserManager`, `InMemoryWebStorage`, `signinRedirect`, refresh silencioso | T13, T14 |
| `redis/` | `XADD`, `XREADGROUP`, `XACK`, `XAUTOCLAIM`, `XPENDING`, `SET NX PX`, `EVAL` | T05–T11 |
| `react-admin/` (ou `refine/`) | DataProvider REST, `List`, `Datagrid`, filtros, `authProvider` | T14 |

Sem essas pastas, os prompts mandam a IA parar (BLOCKED) em vez de inventar.

## 6. Testes-oráculo (P-03)

Leia `09-oraculos.md` (26 casos, sem código). Corrija o que discordar **agora**. Depois assine no fim do
arquivo. A IA escreve o teste de cada oráculo, mas não pode mudar o que ele exige: o gate reprova a
subtask se o ID `[OR-xx]` não estiver num teste executado.

## 7. Configuração da corrida

Crie `.env` a partir de valores seus (nunca commitado) e registre em `docs/fase-1/08-versoes-fixadas.md`,
seção "Configuração da corrida":

- `REMOTE_PUSH: sim | não`
- IDE e comando headless usados
- Contas seed da demo (e-mails; as senhas ficam só no `.env`): `admin@demo.local` (ADMIN), `auditor@demo.local` (AUDITOR), `aluno@demo.local` (USER)

## 8. Travar a governança

```bash
git add -A && git commit -m "Fase 0 concluída: decisões, versões, oráculos"
git tag fase1-governanca
```

A partir daqui, qualquer alteração em `ORCHESTRATOR.md`, `agents/`, `skills/` ou `docs/fase-1/` faz o gate
reprovar. Se **você** precisar mudar algo durante a corrida: pare (`echo "HALTED: manual" > .orchestrator/STATUS`),
edite, commite e mova a tag (`git tag -f fase1-governanca`). Registre o motivo no commit; é dado do TCC.

## Pronto para ligar

- [ ] `.orchestrator/` no `.gitignore`
- [ ] `docker info` funciona sem `sudo`
- [ ] D-16, D-17 e D-19 com `Tomada` na skill 01
- [ ] `versoes.lock.md` gerado sem `FALHOU`
- [ ] `docs/vendor/` com as 6 pastas
- [ ] `09-oraculos.md` assinado
- [ ] `.env` criado e fora do git
- [ ] Tag `fase1-governanca` criada
- [ ] Máquina isolada, na tomada, sem suspensão

```bash
AGENT_CMD='claude -p' bash docs/fase-1/scripts/run-loop.sh
```
