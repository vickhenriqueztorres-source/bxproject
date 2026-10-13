# Relatório da Etapa 09 — Textos em Espanhol

**Data:** 08 de Outubro de 2026  
**Responsável:** `tech-lead-orchestrator` com `cirurgiao`, `marca-binmax`, `compliance-risco`, `guardiao-regressao`  
**Status:** **APROVADO E 100% VERDE**

---

## 1. Resumo Executivo

A Etapa 09 padronizou integralmente a comunicação textual da plataforma em espanhol latino-americano neutro (tratamento por "tú"), eliminando termos em inglês/português não autorizados na sala de operações (exceto os tickers financeiros canônicos como `EUR/USD`, `SYNTH_VOL_50`). Foi harmonizado o arquivo `apps/web/src/i18n/locales/es-ES.json` com o catálogo de microcopy e as regras do manual de identidade de marca.

---

## 2. Dicionário Canônico Aplicado (IQ pt → Binmax es)

| Termo Proibido / Antigo | Termo Oficial Binmax | Onde é Usado |
|:---|:---|:---|
| Call / Acima / Arriba | **SUBE** | Botão D4, Mood Bar, Portfólio |
| Put / Abaixo / Abajo | **BAJA** | Botão D5, Mood Bar, Portfólio |
| Invest / Inversión / Importe | **Monto** | Bloco D1 do Ticket |
| Expiry / Vencimiento | **Expiración** | Bloco D2 do Ticket, Linhas temporais |
| Lucro / Profit | **Ganancia** | Bloco D3 do Ticket, Cabeçalhos |
| Recargar / Cash in | **Depositar** | Botão de topo e atalhos |
| Conta Prática / Treinamento | **Cuenta demo** | Badge da carteira de demonstração |
| Conta Real | **Cuenta real** | Badge da carteira de dinheiro real |
| Suporte / Support | **Soporte** | Rodapé e Menu lateral |
| Todo dia, a toda hora | **Todos los días, a toda hora** | Rodapé |
| Hora atual | **Hora actual** | Relógio oficial do rodapé |

---

## 3. Microcopy Oficial

- **Vitória:** `¡Ganaste! +$XX.XX`
- **Derrota:** `No esta vez · −$XX.XX` (tom sóbrio, sem drama)
- **Empate:** `Empate · se devolvió $XX.XX`
- **Saldo insuficiente:** `Saldo insuficiente. Deposita y sigue operando.`
- **Portfólio vazio:** `Aún no tienes operaciones abiertas. Elige SUBE o BAJA para empezar.`
- **Histórico vazio:** `Aún no tienes operaciones cerradas.`
- **Aviso de risco regulatório no rodapé:**
  > *"Operar opciones binarias implica un alto riesgo de pérdida. Opera solo con dinero que puedas permitirte perder."*

---

## 4. Resultados dos Testes Automatizados

- **Suíte Vitest:** 17 arquivos de teste, 84 testes executados, **84 aprovados (100% verde)**.
- **Novo teste:** `apps/web/src/trade/i18n-es.unit.test.ts` (2 testes adicionados e validados).
