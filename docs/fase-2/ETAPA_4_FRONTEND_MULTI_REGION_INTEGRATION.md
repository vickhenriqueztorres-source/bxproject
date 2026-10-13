# SUBETAPA 4: INTEGRAÇÃO FRONTEND MULTI-REGIÃO E EXPERIÊNCIA DO USUÁRIO

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `frontend-realtime-agent`  
**Agentes Revisores e Auditores:** `binmax-brand-agent`, `compliance-risk-reviewer`, `qa-resilience-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-ETAPA-4`  

---

## 1. Objetivo e Especificação Técnica

Integrar a experiência completa multi-região na aplicação web (`apps/web`):
1. **Inicialização com Resolução de Região**:
   - No bootstrap da aplicação, consulta `/api/v1/geo/resolve`.
   - Se o país não for suportado ou estiver desabilitado, renderiza a tela `GeoblockedScreen` com mensagem oficial e explicativa no idioma mais adequado.
   - Se autorizado, aplica o `locale` regional padrão (`pt-BR`, `es-MX`, `es-CO`, `es-AR`, `es-CL`, `es-PE`), a moeda padrão e o timezone correspondente.
2. **Seletor de Moeda e Idioma na Interface**:
   - Permite ao usuário alternar a moeda de exibição (`BRL`, `MXN`, `COP`, `ARS`, `CLP`, `PEN` ou `USD`) mantendo o saldo contábil sempre intacto no Blnk.
   - Permite ao usuário comutar entre Português e os dialetos Espanhóis sem recarregar a página e sem perder o estado dos gráficos.
3. **Erradicação de Strings Hardcoded**:
   - Varredura e substituição por `t('namespace.key')` em cabeçalhos, boletas, modais, carteira e mensagens de erro.
4. **Exibição de Data, Hora e Timezone**:
   - Renderização dos horários de expiração e timestamps de ticks no fuso horário do país selecionado.

---

## 2. Invariantes de Interface e Compliance

- **Transparência Demo Inviolável**: O selo de CONTA DEMO permanece visível e inequívoco em todos os idiomas e moedas.
- **Simetria dos Botões SUBE / BAJA**: Preservação exata do design de precisão nos botões operacionais sem quebras de layout decorrentes do comprimento dos textos traduzidos.
- **Aviso de Risco Regulatório**: Presente no rodapé traduzido conforme o país de navegação.

---

## 3. Passo a Passo de Implementação Cirúrgica

1. **Passo 4.1**: Conectar `apps/web/src/App.tsx` / `main.tsx` ao serviço de resolução geográfica com renderização condicional da `GeoblockedScreen`.
2. **Passo 4.2**: Atualizar o `I18nProvider` para injetar o contexto de timezone e formatação de data/hora regional.
3. **Passo 4.3**: Garantir que o seletor de moedas exiba os 6 símbolos oficiais (`R$`, `Mex$`, `Col$`, `$`, `CLP$`, `S/.`).
4. **Passo 4.4**: Atualizar testes unitários e de integração de frontend garantindo zero quebras de renderização.

---

## 4. Critério de Homologação do Gate (`GATE-F2-ETAPA-4`)
A Subetapa 4 está HOMOLOGADA quando:
- Navegadores de qualquer um dos 6 países recebem automaticamente sua moeda, idioma e timezone nativos.
- Tentativas de acesso com país não autorizado são interceptadas com a tela de bloqueio regional.
- Todos os testes de renderização de frontend passam com sucesso.
