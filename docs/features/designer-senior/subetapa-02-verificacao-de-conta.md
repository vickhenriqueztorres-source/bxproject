# Subetapa 02 — Verificação de Conta (Hierarquia Narrativa & 5 Estados)

> **Filosofia:** Hierarquia como narrativa. Na verificação, o usuário veio enviar um documento: o Dropzone é o protagonista; os documentos válidos são coadjuvantes; exemplos e justificativas são notas de rodapé. Zero emojis soltos; ícones vetoriais de precisão cirúrgica.

---

## 1. Escopo de Arquivos

### Arquivos Permitidos:
- `apps/web/src/pages/VerificationPage.tsx` (Refatoração de hierarquia, dropzone e 5 estados)
- `apps/web/src/components/icons/PrecisionIcons.tsx` (Ícones vetoriais de traço uniforme: Document, Mail, UploadCloud, CheckCircle, Clock, Shield)
- `apps/web/src/pages/verification-settings.unit.test.tsx` (Atualização e expansão de testes)
- `apps/web/src/pages/verification-precision-stress.unit.test.tsx` (Testes de estresse, caos e 5 estados)

### Arquivos Proibidos:
- Qualquer alteração nos endpoints de KYC ou regras de negócio no backend.

---

## 2. Passo a Passo de Implementação

1. **Biblioteca de Ícones Vetoriais (`PrecisionIcons.tsx`)**:
   - Criar componentes SVG puros com traço uniforme de 1.5px/2px (sem emojis soltos `☁️`, `✉️`, `🪪`).

2. **Hierarquia Narrativa em `VerificationPage.tsx`**:
   - **Protagonista**: O Dropzone ocupa a posição visual de maior contraste, com borda tracejada que se torna sólida e fundo que clareia um tom em 100ms no drag over.
   - **Coadjuvante**: Lista de documentos válidos (Passaporte, DNI/Identidad, Carné de conducir) em formato técnico limpo.
   - **Nota de rodapé**: Documentos rejeitados e orientações de segurança em tom discreto Aço (`#8A92A1`).

3. **Física de Movimento e Feedback**:
   - Barra de progresso de upload com progressão real de bytes enviados (sem simulação de timer estúpido).
   - Indicador de progresso geral (ex: 2 de 3) cresce em 500ms suavemente na carga inicial.
   - Estado de erro: borda vermelha em 100ms e texto em 180ms (**sem animação de shake/tremor**).

4. **Os 5 Estados de Interface**:
   - Vazio (Sem documentos enviados)
   - Carregando / Uploading (Progresso numérico e barra precisa)
   - Cheio / Enviado (Card de documento com metadados e status)
   - Erro (Validação de formato/tamanho com aviso claro)
   - Sucesso / Aprovado (Badge verde discreto com data e hora exata)

---

## 3. Matriz de Testes

### 3.1 Testes Unitários
- Renderização de todos os 5 estados da interface.
- Confirmação da presença de ícones SVG e ausência de emojis soltos no DOM.
- Respeito aos tokens de superfície (`#0B0E14`, `#121721`, `#1A202C`).

### 3.2 Testes de Estresse
- Simulação de rajada de drag & drop com múltiplos arquivos e cancelamento rápido de requisições sem vazamento de memória ou quebra de render.

### 3.3 Testes de Caos
- Upload de arquivos corrompidos, arquivos maiores que 10MB ou com extensão inválida.
- Queda simulada de conexão durante o upload: a interface deve exibir estado de erro estático e permitir reenvio sem recarregar a página.

### 3.4 Testes de Segurança
- Sanitização estrita do nome de arquivos no DOM contra XSS (ex: `<script>.png`).

---

## 4. Critério de Aceite da Subetapa 02
- Suíte `verification-settings.unit.test.tsx` e `verification-precision-stress.unit.test.tsx` 100% verdes no Vitest.
- Auditoria do `designer-senior` aprovada.
