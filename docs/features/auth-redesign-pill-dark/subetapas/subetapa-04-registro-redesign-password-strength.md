# Subetapa 04 — Tela de Registro com Indicador de Força de Senha e Pill Design

> **Objetivo:** Refatorar `RegisterPage.tsx` para atingir 100% de correspondência com a imagem `media_1791679980404_44e0df9d.png`: título "Abra sua conta grátis.", subtítulo "Leva 15 segundos. Você começa na conta de prática.", inputs de Nome completo ("Como no seu documento"), E-mail ("voce@email.com"), Senha com 4 barras de força e 3 requisitos interativos (8+ caracteres, Uma letra, Um número), checkbox de Termos e Política de Riscos, e botão pílula verde "Criar minha conta grátis →".

---

## 1. Escopo de Arquivos
- `apps/web/src/pages/RegisterPage.tsx`
- `apps/web/src/pages/register-page-refinement.unit.test.tsx`

---

## 2. Detalhes de Implementação
1. **Card Container**:
   - `background: #0B0F17`
   - `border-radius: 20px`
   - `border: 1px solid rgba(255, 255, 255, 0.07)`
   - `padding: 36px 32px`
2. **Campos**:
   - `Nome completo`: placeholder `Como no seu documento`
   - `E-mail`: placeholder `voce@email.com`
   - `Senha`: com toggle de visibilidade
3. **Indicador de Força de Senha**:
   - 4 segmentos de barra horizontal que preenchem em verde de acordo com a força.
   - 3 requisitos em tempo real com indicador visual (círculo que preenche em verde ao ser atendido):
     - `8+ caracteres`
     - `Uma letra`
     - `Um número`
4. **Checkbox de Termos**:
   - Checkbox estilizado
   - `Tenho 18 anos ou mais e aceito os Termos e a Política de Riscos.` (com links de apoio)
5. **Botão Primário**:
   - `Criar minha conta grátis →`
   - `height: 48px`, `border-radius: 9999px`, fundo verde `#22C47A` / `#00E599`
6. **Disclaimer**:
   - `Conexão criptografada. A BINMAX nunca pede sua senha por WhatsApp, e-mail ou telefone.`

---

## 3. Matriz de Testes & Critérios de Aceite
- [ ] Validação do cálculo de força de senha (8+ caracteres, letra, número).
- [ ] Presença dos textos oficiais da captura.
- [ ] Botão pílula com texto `Criar minha conta grátis →`.
- [ ] Disclaimer de criptografia com ícone de cadeado verde.
