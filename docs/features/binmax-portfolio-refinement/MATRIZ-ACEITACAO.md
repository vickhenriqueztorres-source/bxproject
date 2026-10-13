# Matriz de Aceitação — Refinamento Institucional do Portafolio

| ID | Requisito / Critério de Aceite | Origem | Evidência de Teste | Status |
| :--- | :--- | :--- | :--- | :---: |
| **REQ-01** | Header "Portafolio total" sem emoji 💼 no modo Binmax | `media_1791582778148_5c35f99d.png` | Teste unitário de renderização | ✅ Aprovado |
| **REQ-02** | Abas Underline ("Abiertas N" ativa com barra branca, "Cerradas" inativa) | `media_1791582778148_5c35f99d.png` | Teste de abas & seletores | ✅ Aprovado |
| **REQ-03** | Card com fundo elevado `#171F2B`, borda discreta e cantos arredondados (8px) | `media_1791582778148_5c35f99d.png` | Teste visual / CSS inspeção | ✅ Aprovado |
| **REQ-04** | Ícone de par de bandeiras sobrepostas (`AssetFlagBadge`) e símbolo formatado | `media_1791582778148_5c35f99d.png` | Teste de bandeiras & símbolos | ✅ Aprovado |
| **REQ-05** | Badges de direção sólidos: `↑ ARRIBA` (verde) e `↓ ABAJO` (vermelho) | `media_1791582778148_5c35f99d.png` | Teste de badges de direção | ✅ Aprovado |
| **REQ-06** | P&L dinâmico em tempo real: `+$XX.XX` (verde) ou `-$XX.XX` (vermelho) | `media_1791582778148_5c35f99d.png` | Teste de cálculo dinâmico | ✅ Aprovado |
| **REQ-07** | Seção "Invertido $XX" alinhada à esquerda inferior do card | `media_1791582778148_5c35f99d.png` | Teste de montante investido | ✅ Aprovado |
| **REQ-08** | Barra horizontal de progresso com porcentagem dinâmica do tempo de expiração | `media_1791582778148_5c35f99d.png` | Teste de cálculo de progresso | ✅ Aprovado |
| **REQ-09** | Cronômetro regressivo decrescente `mm:ss` e carimbo `Expira HH:mm:ss` | `media_1791582778148_5c35f99d.png` | Teste de hook de contagem regressiva | ✅ Aprovado |
| **REQ-10** | Aba "Cerradas" consistente com histórico de operações e resultado | `media_1791582778148_5c35f99d.png` | Teste de operações fechadas | ✅ Aprovado |
| **REQ-11** | Estado vazio sóbrio e institucional quando não houver contratos | Padrão Binmax | Teste de estado vazio | ✅ Aprovado |
| **REQ-12** | Testes de Estresse (100+ contratos), Caos e Integridade Financeira | Protocolo de Robustez | Arquivo de teste de estresse & caos | ✅ Aprovado |
| **REQ-13** | Regressão zero na suíte global (508 testes verdes) | Invariante de Qualidade | Vitest run completo | ✅ Aprovado |
| **REQ-14** | Deploy em produção na VPS com serviços recarregados e saudáveis | Requisito Operacional | Deploy script e HTTP 200 OK | ✅ Aprovado |
