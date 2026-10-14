# Binmax Option — Manual de Identidade Visual

**Direção escolhida:** Turbo Prata
**Assinatura:** *Al máximo.*
**Domínio de referência:** binmaxoption.com
**Público:** traders de opções binárias na América Latina (México, Colômbia, Argentina, Chile, Peru, Brasil), 18 a 45 anos, a maioria já usou IQ Option, Quotex ou Polarium.

---

## 1. Conceito

A Binmax é o **painel de um carro esportivo à noite**: tudo em metal escuro e prata, e a única coisa que acende é o dinheiro.

A regra central da marca:

> **Prata é a marca. Verde é o dinheiro. Vermelho é o risco. Nada mais tem cor.**

Isso tem um efeito direto no comportamento do lead: como a interface inteira é monocromática, o olho vai automaticamente para o que está em verde — saldo, lucro, o botão SUBE e o botão Depositar. O verde vira sinônimo de *grana* dentro do produto.

---

## 2. Logo

### 2.1 Símbolo — a seta dupla

Duas setas em "V" invertido, empilhadas. A de cima em Prata (o movimento, o máximo); a de baixo em Aço (a base, a segurança).

```
     /\        <- Prata  #DCE1EA
    /  \
   / /\ \
    /  \       <- Aço    #8A92A1
   /    \
```

**Construção (grade de 48 × 48):**

| Elemento | Medida |
|---|---|
| Traço das setas | 6,5 unidades |
| Ângulo | 45° exatos |
| Junta | `miter` (ponta reta, nunca arredondada) |
| Seta superior | de (9, 26) a (24, 11) a (39, 26) |
| Seta inferior | de (9, 41) a (24, 26) a (39, 41) |

Arquivos: `public/brand/binmax-mark.svg` e `public/brand/binmax-app-icon.svg`.

### 2.2 Logotipo

`BINMAX` em **Geist SemiBold/ExtraBold**, caixa-alta, espaçamento −1%.
`OPTION` em **Geist Medium**, caixa-alta, espaçamento +18%, na cor Aço.

### 2.3 Versões

| Versão | Uso |
|---|---|
| Horizontal (símbolo + BINMAX + OPTION) | Cabeçalho do site, e-mail, assinatura |
| Horizontal curta (símbolo + BINMAX) | Barra superior da plataforma, telas pequenas |
| Vertical (símbolo em cima, nome embaixo) | Redes sociais, patrocínio, uniforme |
| Símbolo isolado | Favicon, ícone do app, marca d'água de vídeo |

### 2.4 Área de proteção e tamanho mínimo

- **Área de proteção:** em volta do logo, deixe livre um espaço igual à altura de **uma seta** do símbolo.
- **Tamanho mínimo:** símbolo com 16 px; logotipo horizontal com 96 px de largura.

### 2.5 Usos proibidos

- Não colorir as setas de verde ou vermelho (essas cores são do mercado).
- Não arredondar as pontas das setas.
- Não aplicar sombra, brilho, contorno ou gradiente arco-íris.
- Não girar o símbolo para baixo (vira "BAJA").
- Não aplicar sobre fotos sem uma camada escura de no mínimo 60%.

---

## 3. Cores

### 3.1 Paleta principal

| Nome | HEX | RGB | Função |
|---|---|---|---|
| **Noche** | `#0D0F14` | 13, 15, 20 | Fundo principal |
| **Panel** | `#151922` | 21, 25, 34 | Superfícies, cards, barras |
| **Prata** | `#DCE1EA` | 220, 228, 234 | Marca, logo, foco, preço atual |
| **Blanco** | `#F4F5F7` | 244, 245, 247 | Texto principal |
| **Aço** | `#8A92A1` | 138, 146, 161 | Texto secundário, rótulos, ícones |

### 3.2 Cores do dinheiro (funcionais)

| Nome | HEX | Função |
|---|---|---|
| **Verde Ganancia** | `#22C47A` | Saldo, lucro, botão SUBE, botão Depositar, vela de alta |
| **Rojo Baja** | `#F2545B` | Perda, botão BAJA, vela de baixa |

### 3.3 Contraste (WCAG)

| Combinação | Contraste | Nível |
|---|---|---|
| Blanco sobre Noche | 18,1 : 1 | AAA |
| Prata sobre Noche | 14,9 : 1 | AAA |
| Aço sobre Noche | 6,4 : 1 | AA |
| Verde Ganancia sobre Noche | 8,6 : 1 | AAA |
| Rojo Baja sobre Noche | 5,9 : 1 | AA |
| Noche sobre Verde Ganancia (texto do botão SUBE) | 8,6 : 1 | AAA |
| Noche sobre Rojo Baja (texto do botão BAJA) | 5,9 : 1 | AA |

> O Aço foi clareado de `#737B8A` para `#8A92A1` para que os rótulos pequenos (12 px) passem no nível AA.

### 3.4 Regras de uso do verde ("ver grana")

1. **O saldo é sempre verde.** Em qualquer tela, o número do saldo aparece em Verde Ganancia.
2. **Todo ganho tem sinal de +** e aparece em verde: `+$23.00`, `+92%`.
3. **O botão Depositar é verde e cheio**, nunca só contornado.
4. **Proibido usar verde em decoração** (ícones, fundos, ilustrações). Se o verde aparece, é dinheiro.
5. **O botão SUBE e o BAJA têm o mesmo tamanho e o mesmo peso.** A marca não induz direção.

### 3.5 Proporção na tela

- 80% Noche / Panel
- 12% Blanco / Aço (texto)
- 5% Prata (marca e foco)
- 3% Verde e Vermelho (dinheiro e risco)

---

## 4. Tipografia

| Família | Uso | Pesos |
|---|---|---|
| **Geist** | Logotipo, títulos, interface | 400, 500, 600, 700, 800 |
| **Geist Mono** | Preços, saldos, contadores, horários | 400, 500, 600 |

**Por que o ecossistema Geist:** Geist é um sistema tipográfico suíço de alta precisão projetado especificamente para interfaces de densidade técnica, engenharia e terminais financeiros. Elimina a estética amadora/pesada de fontes esportivas e garante pareamento nativo e harmônico com o Geist Mono (largura fixa) nos preços e contadores.

### Escala (plataforma)

| Token | Tamanho | Uso |
|---|---|---|
| `display` | 40 px / 800 / Expanded | Porcentagem de lucro no ticket |
| `title` | 18 px / 600 | Nome do ativo |
| `body` | 14 px / 500 | Texto geral, botões |
| `label` | 12 px / 600 / caixa-alta / +6% | Rótulos de campos |
| `price` | 14 px / Mono | Preços, saldo |
| `micro` | 11 px / Mono | Eixos do gráfico (único lugar permitido abaixo de 12 px) |

---

## 5. Iconografia

- Biblioteca: **Lucide**, traço de 1,75 px.
- Tamanhos: 16 px (dentro de botões), 20 px (barra lateral), 24 px (destaques).
- Ícones sempre em Aço; ficam Prata quando ativos. Nunca verdes (ver 3.4).

---

## 6. Forma e espaçamento

- **Grade base:** 4 px.
- **Raio:** 6 px (campos, chips), 10 px (cards, botões grandes). Nada totalmente redondo, exceto avatares e indicadores.
- **Linhas:** 1 px em Blanco com 8% de opacidade.
- **Sem sombras pesadas.** Profundidade vem da troca Noche → Panel.

---

## 7. Movimento

| Evento | Animação |
|---|---|
| Tick de preço | O preço muda sem animação (velocidade = confiança) |
| Operação aberta | Linha de entrada aparece no gráfico em 150 ms |
| Operação ganha | Aviso desliza da direita com `+$` em verde, 4,5 s |
| Hover em SUBE/BAJA | A área acima/abaixo do preço ganha um véu verde/vermelho de 8% |

Respeitar `prefers-reduced-motion`: sem deslizamentos, só troca de opacidade.

---

## 8. Voz e tom

**Idioma:** espanhol neutro latino-americano, tratamento por **tú**.
**Personalidade:** direto, rápido, confiante. Como um piloto falando com a equipe.

### Vocabulário oficial da plataforma

| Use | Não use |
|---|---|
| SUBE / BAJA | Arriba / Abajo, Call / Put, Buy / Sell |
| Monto | Inversión, Invest |
| Expiración (igual à IQ) | Expiry, Vencimiento |
| Ganancia | Lucro, Profit |
| Depositar / Retirar | Recargar, Cash in |
| Cuenta demo / Cuenta real | Práctica, Torneo (para conta) |

### Microcopy

- Botão principal: **SUBE** / **BAJA**
- Ganho: **¡Ganaste! +$23.00**
- Perda: **No esta vez · −$25.00** (sem culpa, sem drama)
- Saldo insuficiente: **Saldo insuficiente. Deposita y sigue operando.**
- Vazio: **Aún no tienes operaciones abiertas. Elige SUBE o BAJA para empezar.**

### Proibido

- Prometer ganho garantido ("gana seguro", "dinero fácil").
- Esconder o aviso de risco.
- Misturar inglês e espanhol na mesma tela.

---

## 9. Aplicações

| Peça | Especificação |
|---|---|
| Ícone do app | Símbolo Prata sobre Noche, raio de 22% (padrão iOS) |
| Favicon | Só a seta superior, Prata sobre Noche |
| Perfil das redes | Símbolo centralizado, fundo Noche |
| Anúncios | Foto escura + saldo verde em destaque + "Al máximo." |
| Patrocínio esportivo | Versão vertical em Prata sobre preto fosco |

---

## 10. Aviso de risco (obrigatório)

Em todo material de marketing e no rodapé da plataforma:

> *Operar opciones binarias implica un alto riesgo de pérdida. Opera solo con dinero que puedas permitirte perder.*
