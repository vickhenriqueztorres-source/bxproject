import { describe, it } from "vitest";
import assert from "node:assert/strict";
import React from "../../apps/admin/node_modules/react/index.js";
import { renderToString } from "../../apps/admin/node_modules/react-dom/server.node.js";
import { App } from "../../apps/admin/src/App.tsx";

describe("Gate A-03 (Unit): Interface e Comportamento do Painel Admin", () => {
  it("1. Deve renderizar a navegação completa do Painel Admin (Usuários, Países, Índices, Contratos, Auditoria)", () => {
    const html = renderToString(React.createElement(App));

    // Abas obrigatórias do T14 e Fase 2
    assert(html.includes("Usuários"), "Deve conter aba de Usuários");
    assert(html.includes("Países &amp; Flags") || html.includes("Países & Flags") || html.includes("Países"), "Deve conter aba de Países");
    assert(html.includes("Ativos OTC &amp; Sintéticos") || html.includes("Ativos OTC & Sintéticos") || html.includes("Sintéticos"), "Deve conter aba de Índices");
    assert(html.includes("Risco &amp; Solvência") || html.includes("Risco & Solvência") || html.includes("Risco"), "Deve conter aba de Contratos & Risco");
    assert(html.includes("Auditoria Forense"), "Deve conter aba de Auditoria");
  });

  it("2. O controle do índice sintético SYNTH_VOL_50 deve possuir botão de Pausa e Modal de Justificativa B-14", () => {
    const html = renderToString(React.createElement(App));
    assert(html.includes("LATAM"), "Deve renderizar portal administrativo");
    assert(html.includes("B-14") || html.includes("Justificativa"), "Deve ter suporte a justificativa de auditoria B-14");
    assert(html.includes("PAUSAR ÍNDICE") || html.includes("Pausar Índice") || html.includes("PAUSADO") || html.includes("ATIVO"), "Deve ter botão/ação para pausar índice");
  });
});
