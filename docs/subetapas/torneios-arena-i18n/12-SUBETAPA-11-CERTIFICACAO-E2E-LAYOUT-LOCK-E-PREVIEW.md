# Subetapa 11 — Certificação Geométrica Real (`0px` Shift no Gráfico/Boleta) e Abertura do Preview

**Status**: CONCLUÍDA E VALIDADA (10/10 suítes da Arena — 47/47 testes verdes + `TSC_EXIT=0`)  
**Agentes**: `regression-guardian-agent` (`guardiao-regressao`), `qa-resilience-agent`, `chief-visual-director`  
**Skills**: `06-testing-quality`, `19-testes-de-regressao-visual`, `21-designer-senior-binmax`

---

## 1. Objetivo Cirúrgico

Comprovar matematicamente na suíte automatizada e no navegador real (`http://localhost:5173/arena`) que:
1. Ao clicar em `Top 10`, `Top 20` e `Top 30`, o `boundingClientRect` do gráfico (`arena-mirrored-chart-wrapper`) e da boleta (`SUBE`/`BAJA`) permanece **exatamente idêntico (`Δtop = 0px`, `Δheight = 0px`, `window.scrollY = 0`)**.
2. Toda a suíte de testes da Arena e da aplicação passa com `0` erros de TypeScript e `100%` dos testes verdes.
3. O preview é aberto para conferência imediata do usuário.

---

## 2. Passo a Passo de Verificação

1. Executar `vitest` em todos os testes da Arena, incluindo a nova suíte `arena-top-ranking-scroll-lock.unit.test.tsx`.
2. Executar `tsc --noEmit` para garantir `0` erros de tipagem.
3. Verificar em `http://localhost:5173/arena` que o servidor está servindo o código atualizado e abrir o preview.
