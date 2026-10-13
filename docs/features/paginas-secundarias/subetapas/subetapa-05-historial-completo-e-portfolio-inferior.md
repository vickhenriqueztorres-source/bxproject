# Subetapa 05: Histórico Completo de Operações & Portfólio das Operações Abertas

**Responsáveis:** `financial-correctness-reviewer`, `surgical-frontend-agent`, `qa-resilience-agent`  
**Imagens de Referência:**
- `Imagem do ChatGPT 9 de out. de 2026, 20_50_24-9.png` (Historial Completo `/historial`)
- `Imagem do ChatGPT 9 de out. de 2026, 20_50_21-4.png` (Portfólio Inferior na Sala e Toast de Ganho)
- `Imagem do ChatGPT 9 de out. de 2026, 20_50_22-5.png` (Portfólio com Historial Cerrado)

---

## 1. Objetivo Técnico
Entregar a página completa de Histórico de Operações (`/historial`) em formato de extrato bancário institucional, com filtros compostos, ordenação e exportação em CSV RFC-4180, e consolidar o painel inferior de Portfólio das operações abertas na sala de trading com exibição em tempo real de posições ativas, timers regressivos e toast oficial de encerramento (`Ganaste +$185.00`).

---

## 2. Requisitos Visuais e Funcionais

### 2.1 Histórico Completo (`/historial`)
- **Filtros Superiores (4 dropdowns em cartões `#111A2B`):**
  1. **Período:** `Últimos 7 días` (padrão), `Hoy`, `Últimos 30 días`, `Todo el historial`.
  2. **Activo:** `Todos` (padrão), `SYNTH_VOL_10`, `SYNTH_VOL_25`, `SYNTH_VOL_50`, etc.
  3. **Resultado:** `Todos` (padrão), `Solo Ganadas (WIN)`, `Solo Perdidas (LOSS)`.
  4. **Cuenta:** `Cuenta de práctica` (padrão) / `Cuenta real`.
- **Tabela de Operações com Cabeçalho Ordenável:**
  - `Fecha`: Data e hora exatas (`09 oct. 2026, 21:45:32`).
  - `Activo`: Símbolo do índice sintético (`SYNTH_VOL_50`).
  - `Dirección`: Chips elegantes verdes com seta para cima `SUBE` ou vermelhos com seta para baixo `BAJA`.
  - `Monto`: Valor investido em Geist Mono tabular (`$100.00`).
  - `Apertura`: Preço de entrada no tick oficial (`507.1200`).
  - `Cierre`: Preço de fechamento no tick oficial de expiração (`507.9397`).
  - `Resultado`: Payout com sinal e cor (`+$85.00` em verde ou `-$50.00` em vermelho).
- **Rodapé de Extrato Bancário:**
  - Card `Operaciones`: Total de contratos no filtro selecionado (ex: `15 en este período`).
  - Card `Total invertido`: Soma de todos os montantes (`$1,050.00`).
  - Card `Resultado neto`: Lucro/prejuízo consolidado (`+$243.75` com indicador verde).
  - Botão outline com ícone de download: `"Exportar CSV"`.
    - Gera arquivo `.csv` no padrão RFC-4180 com cabeçalhos sanitizados para Excel/Google Sheets.

### 2.2 Portfólio de Operações Abertas na Sala (Barra e Gaveta Inferior)
- Conforme as imagens 4 e 5:
  - Barra inferior colapsável: `"Portafolio total  0 activas"`, botão `"Mostrar posiciones ^"`.
  - Abas: `"Operaciones abiertas (0)"` e `"Historial cerrado (1)"`.
  - Card vazio quando não há operações: `"Aún no tienes operaciones abiertas. Elige SUBE o BAJA para empezar."`.
  - Lista de operações abertas quando houver contratos em andamento:
    - Chip de direção SUBE/BAJA.
    - Símbolo do ativo.
    - Montante apostado e rendimento esperado.
    - Preço de entrada e preço atual com variação cromática.
    - Timer regressivo visual e numérico até a expiração (`00:13`).
  - Toast de resultado no canto inferior esquerdo:
    - Ícone circular de check verde.
    - `"Ganaste"` / `"+$185.00"`.
    - `"SYNTH_VOL_50 - SUBE"`.
    - Botão de fechar (X).

---

## 3. Testes Obrigatórios da Subetapa 05
1. **Testes de Filtros e Paginação:**
   - Filtragem correta por período, símbolo e resultado.
   - Cálculo aritmético exato de soma dos totais (operações, investido e líquido).
2. **Testes de Exportação CSV:**
   - Validação da estrutura das colunas, separador por vírgula e encoding UTF-8 com BOM para Excel.
   - Prevenção contra injeção de fórmulas CSV (ex: sanitização de strings começando com `=`, `+`, `-`, `@`).
3. **Testes de Performance do Portfólio em Tempo Real:**
   - 50 contratos simultâneos atualizando timers a cada segundo sem engasgos de renderização.
