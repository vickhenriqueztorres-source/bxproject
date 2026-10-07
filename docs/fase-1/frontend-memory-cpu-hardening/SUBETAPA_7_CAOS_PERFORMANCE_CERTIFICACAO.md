# Subetapa 7 — Bateria de Caos C-16 a C-19, Carga de N Charts e Certificação Final

> **Documento:** `docs/fase-1/frontend-memory-cpu-hardening/SUBETAPA_7_CAOS_PERFORMANCE_CERTIFICACAO.md`  
> **Status:** ESPECIFICAÇÃO TÉCNICA  
> **Invariantes:** V-01 a V-13, Certificação Final de Estabilidade de Frontend

---

## 1. Objetivo Técnico

Executar a bateria final de testes de caos e resiliência de memória/CPU no frontend, comprovando matematicamente e sob estresse que as 6 técnicas funcionam de maneira harmoniosa e que a plataforma suporta 6 gráficos simultâneos em alta frequência sem vazamento de memória ou travamento de thread.

---

## 2. Matriz de Testes de Caos

| Código | Teste | Cenário de Caos | Critério de Aceite |
| :--- | :--- | :--- | :--- |
| **C-16** | **Ciclo Agressivo de Churn** | Montagem e desmontagem rápida de 100 gráficos consecutivos (trocas de layout e ativos em < 100ms). | Zero listeners acumulados no WebSocket/EventEmitter; zero contextos órfãos. |
| **C-17** | **Rajada de Ticks sob 6 Gráficos** | 500 ticks/segundo distribuídos entre 6 gráficos ativos com rAF throttling. | No máximo 60 atualizações visuais por segundo por gráfico (redução de $\ge 75\%$ no custo de CPU). |
| **C-18** | **Tentativa de Estouro de Limite** | Script tenta instanciar 12 gráficos simultaneamente. | Grade trunca rigidamente em 6 instâncias (`MAX_CHARTS = 6`) e emite aviso institucional. |
| **C-19** | **Pausa e Retomada em Segundo Plano** | Transição cíclica da aba entre visível e oculta (`visibilityState = hidden`). | Renderização imediatamente suspensa na ocultação e restabelecida no frame seguinte após retorno. |

---

## 3. Passos de Execução

1. **Passo 7.1:** Desenvolver o script de teste unificado `tests/test-subetapa-7-fe-memory-caos.mjs`.
2. **Passo 7.2:** Executar o Caos C-16 e validar a limpeza de listeners e memória.
3. **Passo 7.3:** Executar o Caos C-17 e comprovar a compressão de frames rAF sob 6 gráficos em paralelo.
4. **Passo 7.4:** Executar o Caos C-18 e comprovar a contenção do limite máximo de instâncias.
5. **Passo 7.5:** Executar o Caos C-19 e validar a suspensão sob segundo plano.
6. **Passo 7.6:** Revalidar a integridade contábil e as garantias V-01 a V-13.
7. **Passo 7.7:** Emitir o certificado formal de blindagem de memória e CPU no frontend.

---

## 4. Critérios de Homologação Final

- [x] Caos C-16, C-17, C-18 e C-19 aprovados com 100% de sucesso.
- [x] Zero regressões nos testes das 28 subetapas anteriores.
- [x] Invariantes contábeis do Blnk Ledger (V-13) integralmente preservadas.
