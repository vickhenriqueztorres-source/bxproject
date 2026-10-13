# Subetapa 03 — Tela de Login Fiel às Capturas (Pill Button + Disclaimer)

> **Objetivo:** Refatorar `LoginPage.tsx` para atingir 100% de correspondência com a imagem `media_1791679951150_0d0e67ed.png`: título "Bem-vindo de volta.", subtítulo "Entre para voltar a operar de onde parou.", inputs de 48px com cantos de 12px, botão verde pílula "Entrar →" e disclaimer com cadeado verde.

---

## 1. Escopo de Arquivos
- `apps/web/src/pages/LoginPage.tsx`
- `apps/web/src/pages/login-page-refinement.unit.test.tsx`

---

## 2. Detalhes de Implementação
1. **Card Container**:
   - `background: #0B0F17` (ou `#0E131F`)
   - `border-radius: 20px`
   - `border: 1px solid rgba(255, 255, 255, 0.07)`
   - `padding: 36px 32px`
2. **Textos**:
   - Título: `Bem-vindo de volta.` (h1, ~28px, peso 800, `#FFFFFF`)
   - Subtítulo: `Entre para voltar a operar de onde parou.` (~14px, `#8A92A1`, margem inferior 28px)
3. **Inputs**:
   - `E-mail` -> placeholder: `voce@email.com` (altura 48px, radius 12px, fundo `#121824`)
   - `Senha` -> placeholder vazio ou pontilhado, toggle de olho à direita, link `Esqueceu a senha?` alinhado à direita da label.
4. **Botão Primário**:
   - `Entrar →`
   - Altura: `48px`
   - `border-radius: 9999px`
   - Fundo verde: `#22C47A` / `#00E599`
   - Texto: `#08140B`, peso 700, gap de 8px com a seta
5. **Disclaimer de Segurança**:
   - Ícone de cadeado verde de segurança
   - `Conexão criptografada. A BINMAX nunca pede sua senha por WhatsApp, e-mail ou telefone.` (tamanho 12px, `#7E8B9F`, line-height 1.4)

---

## 3. Matriz de Testes & Critérios de Aceite
- [ ] Confirmação de presença de todos os textos oficiais da imagem.
- [ ] Inputs com altura de 48px e raio de 12px.
- [ ] Botão de submissão com estilo pill (raio 9999px) e seta `→`.
- [ ] Disclaimer de segurança criptografada presente no rodapé do card.
- [ ] Bateria de estresse e ausência de shake mantida.
