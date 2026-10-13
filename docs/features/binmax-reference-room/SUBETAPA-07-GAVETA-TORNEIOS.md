# SUBETAPA 07: GAVETA DE TORNEIOS (SESSÃO 7)

**Objetivo:** Implementar a gaveta lateral de `Torneos` acessada a partir do Sidebar Dock, apresentando competições ativas e futuras com badges de status, premiações e botão de inscrição, conforme a Sessão 7.

---

## 1. Escopo e Fronteiras

- **Arquivos Abrangidos:**
  * `apps/web/src/components/drawer/TournamentsDrawer.tsx` (ou componente equivalente)
  * `apps/web/src/components/sidebar/SidebarDock.tsx`
  * `apps/web/src/trade/tournaments.unit.test.tsx`
- **Fronteira Proibida:** Manter o contrato de torneios desacoplado de microserviços de ranking da Fase 2, garantindo que o frontend funcione 100% no ambiente demo.

---

## 2. Detalhamento da Gaveta de Torneios (Sessão 7)

### 2.1 Elementos Visuais e Conteúdo:
- **Cabeçalho da Gaveta:**
  * Título: `Torneos` em Archivo Bold.
  * Botão fechar: `×`.
- **Card de Torneio Ativo (Turbo Sprint):**
  * Badge superior: `● EN VIVO` (pílula verde) + `Termina en 14h 22m` (cinza suave).
  * Título: `Torneo Turbo Sprint`.
  * Descrição: `Compite con saldo de práctica por premios en efectivo.`.
  * Premiação: `Premio total $10.000 USD` (em tipografia de destaque).
  * Ação: Botão `Participar` (estilizado em ciano/azul escuro de alto contraste).
- **Card de Torneio Futuro (Torneo Semanal):**
  * Badge superior: `PRÓXIMAMENTE` (cinza escuro).
  * Título: `Torneo Semanal`.
  * Início: `Inicia en 3d 14h`.

---

## 3. Passo a Passo de Execução

1. **Criação do Componente `TournamentsDrawer.tsx`:**
   Estruturar os cards de torneio com fidelidade geométrica à imagem 7.
2. **Integração no `SidebarDock.tsx`:**
   Vincular o clique no ícone `Torneos` da barra lateral à abertura da gaveta correspondente.
3. **Persistência de Inscrição:**
   Ao clicar em `Participar`, atualizar o botão para `Inscrito ✓` com feedback visual.
4. **Execução de Testes Automatizados:**
   Testar abertura, fechamento e estado de inscrição.

---

## 4. Testes Rigorosos e Critérios de Aceite

### 4.1 Testes Unitários:
- Verificar renderização dos dois torneios (Ao Vivo e Próximo).
- Testar ação do botão `Participar`.

### 4.2 Teste de Caos:
- Alternar rapidamente entre as gavetas de Torneios, Portfólio e Histórico: nenhuma sobreposição indesejada ou congelamento de layout.

---

## 5. Critério de Gate
- **Status:** [ ] PENDENTE
- Gaveta de torneios abre perfeitamente a partir do sidebar.
- Visual dos cards idêntico à Sessão 7.
