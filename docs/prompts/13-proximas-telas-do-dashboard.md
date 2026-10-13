# Etapa 13 — Próximas telas do dashboard

**Quando usar:** só depois que a sala de operação estiver em 100% (etapa 12 concluída).
**Como usar:** escolha **uma** tela da lista, preencha o modelo abaixo e rode como uma etapa nova.

---

## Telas sugeridas (ordem recomendada)

| # | Tela | Por que nesta ordem |
|---|---|---|
| 13.1 | **Depósito em 2 cliques** | É onde o dinheiro entra. Maior impacto direto. |
| 13.2 | **Onboarding na conta demo** | Leva o lead novo à 1ª operação e depois ao 1º depósito. |
| 13.3 | **Mi Binmax** (home pós-login) | Saldo, "Operar ahora", ativos com maior payout. |
| 13.4 | **Mi Rendimiento** | Evolução do saldo, taxa de acerto, melhor ativo. |
| 13.5 | **Torneos** | Ranking ao vivo, prêmio em verde, contagem regressiva. |
| 13.6 | **Notificaciones** | Resultado, depósito acreditado, payout alto em favorito. |

Os detalhes de cada tela estão em `../dashboard-ux.md`, seção "Ideias para o restante do dashboard".

**Depósito (13.1) toca em pagamento — zona proibida.** Nessa tela a IA só pode mexer na interface; gateway, valores, bônus e confirmação continuam exatamente como estão.

---

## Modelo de prompt (preencha os campos entre colchetes)

````text
Você é o Engenheiro de Prompt coordenando os agentes de docs/prompts/agentes.md, no código da plataforma Binmax Option.

IMPORTANTE: não presuma nada sobre o código. Use todos os relatórios em docs/relatorios/ e confirme lendo os arquivos. Esta tela pode estar em partes do código que as etapas anteriores não mapearam: mapeie antes de planejar.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md
2. docs/prompts/agentes.md
3. docs/prompts/checklist-de-testes.md
4. docs/identidade-visual.md
5. docs/dashboard-ux.md (seção "Ideias para o restante do dashboard", item [NOME DA TELA])
6. Todos os relatórios em docs/relatorios/

OBJETIVO DESTA ETAPA
Aplicar a identidade Turbo Prata e a especificação abaixo à tela [NOME DA TELA], atrás de uma chave liga/desliga própria ([NOME_DA_CHAVE]).

ESPECIFICAÇÃO
[Cole aqui os itens da tela, copiados de docs/dashboard-ux.md, e o que mais quiser.]

REFERÊNCIA DE FAMILIARIDADE
[Salve o print da tela equivalente da IQ Option em docs/referencias/iq-<nome-da-tela>.png e escreva o caminho aqui. Esse print é o molde.]

ZONAS PROIBIDAS EXTRAS DESTA TELA
[Ex.: no Depósito — gateway, valores mínimos, bônus, confirmação, webhooks.]

Trabalhe em 5 fases e não pule nenhuma. Pense passo a passo e mostre o raciocínio.

FASE 1 — ENTENDER
Mapeie a tela atual: arquivos, componentes, dados, rotas, analytics, testes. Tire fotos do "antes" em docs/relatorios/fotos/13-[nome]/antes/.

FASE 2 — CONSELHO DOS AGENTES
Os seis agentes, cada um na sua seção, como em docs/prompts/agentes.md. Fidelidade IQ descreve a tela equivalente da IQ elemento por elemento e exige que a da Binmax seja igual; Marca Binmax troca só cores, logo e textos; Compliance e Risco revisa promessas, bônus e avisos. Sem print da tela da IQ, a IA para e pede.

FASE 3 — PLANO (e PARE)
Layout em texto (desktop e celular), arquivos, riscos, testes, como desfazer.
Escreva "Aguardando aprovação" e NÃO altere nenhum arquivo até eu responder "aprovado".

FASE 4 — EXECUTAR (depois da aprovação)
Um commit por passo, testes depois de cada um, fotos do "depois".

FASE 5 — RELATÓRIO
Grave docs/relatorios/13-[nome].md no formato da seção 7 de docs/prompts/cuidados-gerais.md.

TESTES OBRIGATÓRIOS: checklist-de-testes.md seções 1, 5, 6 e 7, mais os testes específicos desta tela que os agentes definirem.
````
