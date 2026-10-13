# SUBETAPA 1: I18N MODULAR POR NAMESPACES, LOCALES REGIONAIS E TIMEZONES

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `frontend-realtime-agent`  
**Agentes Revisores e Auditores:** `binmax-brand-agent`, `qa-resilience-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-ETAPA-1`  

---

## 1. Objetivo e Especificação Técnica

Implementar o subsistema de **Internacionalização (i18n)** em conformidade absoluta com a Seção 2 da especificação:
1. **Zero Strings Hardcoded**: Nenhuma string de interface no código sem invocação da função de tradução `t('namespace.key')`.
2. **5 Namespaces de Tradução**:
   - `common.json`: Ações gerais (confirmar, cancelar, salvar, fechar, carregar, erros genéricos).
   - `auth.json`: Login, registro, logout, recuperação de senha, mensagens de sessão Keycloak.
   - `wallet.json`: Carteira demo, exibição de saldo, histórico de transações, recarga de saldo demo ($10.000).
   - `contracts.json`: Boleta UP/DOWN, stake, tempo de expiração (60s), strike price, win/loss/draw, payout 85%.
   - `admin.json`: Painel administrativo, gestão de feature flags por país, status dos países, métricas.
3. **Estrutura de Diretórios de Locales (`apps/web/src/i18n/locales/`)**:
   ```text
   locales/
     ├── pt-BR/
     │   ├── common.json
     │   ├── auth.json
     │   ├── wallet.json
     │   ├── contracts.json
     │   └── admin.json
     ├── es-MX/
     │   └── [mesmos 5 namespaces com localização para México]
     ├── es-CO/
     │   └── [mesmos 5 namespaces com localização para Colômbia]
     ├── es-AR/
     │   └── [mesmos 5 namespaces com localização para Argentina]
     ├── es-CL/
     │   └── [mesmos 5 namespaces com localização para Chile]
     └── es-PE/
         └── [mesmos 5 namespaces com localização para Peru]
   ```
4. **Formatação Monetária com `Intl.NumberFormat`**:
   - Integrada no pacote `@broker/shared` (`currency.ts`).
   - Respeita símbolo regional e casas decimais exatas (`CLP` e `COP` sem centavos; `BRL`, `MXN`, `ARS`, `PEN` com 2 casas decimais).
5. **Formatação de Data e Hora com `Intl.DateTimeFormat`**:
   - Respeita o padrão horário e convenções regionais do país.
6. **Timezone por País**:
   - `BR`: `America/Sao_Paulo` (UTC-3)
   - `MX`: `America/Mexico_City` (UTC-6)
   - `CO`: `America/Bogota` (UTC-5)
   - `AR`: `America/Argentina/Buenos_Aires` (UTC-3)
   - `CL`: `America/Santiago` (UTC-4 / UTC-3 DST)
   - `PE`: `America/Lima` (UTC-5)
7. **Codificação**: UTF-8 estrito em todo o pipeline.

---

## 2. Invariantes e Regras Críticas

- **Paridade Exata de Chaves (100%)**: Todos os 6 diretórios regionais e todos os 5 namespaces devem conter as mesmas chaves sem exceção.
- **Fallback Gracioso Transparente**: Se uma chave não for encontrada no dialeto local (ex: `es-PE`), efetua fallback automático para `es-MX`, e em último caso para `pt-BR`, sem quebrar a UI.
- **Isolamento de Estado Reativo**: A comutação de idioma e país não reinicia a conexão WebSocket nem destrói gráficos em andamento.

---

## 3. Passo a Passo de Implementação Cirúrgica

1. **Passo 1.1**: Criar os diretórios e os 5 arquivos de namespaces para cada um dos 6 países em `apps/web/src/i18n/locales/`.
2. **Passo 1.2**: Adicionar suporte a timezones e formatadores `Intl.DateTimeFormat` em `packages/shared/src/datetime.ts` e exportar via `@broker/shared`.
3. **Passo 1.3**: Refatorar `apps/web/src/i18n/index.tsx` para carregar modularmente os namespaces sob demanda, suportando `useTranslation()` com chave no formato `t('namespace:chave.subchave')` ou `t('namespace.chave')`.
4. **Passo 1.4**: Corrigir a suíte de testes unitários `tests/unit/test-frontend-i18n.test.ts` para validar exata paridade entre todos os 6 países e os 5 namespaces.

---

## 4. Bateria de Testes Mandatórios

### 4.1 Testes Unitários de Paridade e Resolução
- `tests/unit/test-frontend-i18n.test.ts`:
  - Varre recursivamente todas as chaves de todos os 5 namespaces nos 6 países.
  - Assert de 100% de paridade (zero chaves ausentes em qualquer idioma).
  - Validação de interpolação de variáveis dinâmicas (ex.: `{{amount}}`, `{{seconds}}`).

### 4.2 Testes de Formatação Regional (`Intl.NumberFormat` e `Intl.DateTimeFormat`)
- Validação das 6 moedas e seus símbolos em diferentes cenários (zero, valores grandes, frações).
- Validação de conversão de data/hora nos 6 fusos horários oficiais.

### 4.3 Testes de Caos
- Injeção de locale inválido ou corrompido (ex: `xx-YY`): validação de que o sistema assume o fallback seguro (`pt-BR`) sem lançar erro de runtime.

---

## 5. Critério de Homologação do Gate (`GATE-F2-ETAPA-1`)
A Subetapa 1 está HOMOLOGADA quando:
- 100% dos arquivos de tradução existem e estão organizados por namespace e país.
- Todos os testes de paridade de tradução e formatação regional passam com código de saída 0.
- `post-implementation-verifier` audita e emite parecer positivo.
