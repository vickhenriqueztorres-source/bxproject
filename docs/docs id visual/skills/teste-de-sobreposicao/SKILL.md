---
name: teste-de-sobreposicao
description: Prova de que a sala da Binmax é igual à da IQ. Tira prints no mesmo tamanho da referência, sobrepõe os dois e confere cada elemento A1–F com tolerância de 10px. Use depois de todo passo visual e na revisão final.
---

# Teste de sobreposição

## 1. Mesmo tamanho de tela

- Veja o tamanho da referência: `docs/referencias/iq-traderoom-desktop.png`. Se o ImageMagick existir, use `identify <arquivo>`; senão, abra a imagem e anote.
- Abra a sala nova (flag ligada) numa janela com **essa mesma largura e altura de área visível**, mesmo zoom (100%), modo escuro.
- Use o mesmo ativo e o mesmo estado da referência, sempre que possível: aba de ativo aberta, ticket visível, painel de posições fechado.

## 2. Tirar o print

Use a ferramenta que o projeto já tiver, nesta ordem de preferência:
1. Playwright ou Cypress já instalados → script de screenshot **fora** da suíte de testes, sem adicionar dependência.
2. Ferramenta de browser do agente, se houver.
3. Manual: o dono tira o print e salva.

Salve em `docs/fotos/NN-passo-X-binmax.png`.

## 3. Sobrepor

- Com ImageMagick: `composite -dissolve 50 docs/fotos/NN-passo-X-binmax.png docs/referencias/iq-traderoom-desktop.png docs/fotos/NN-passo-X-sobreposicao.png`.
- Sem ImageMagick: Figma, Photopea ou qualquer editor, com uma camada a 50% de opacidade. O dono pode fazer.
- **Não** instale nada para isso sem aprovação.

## 4. Conferir

Para cada elemento A1–F de `docs/dashboard-ux.md`:

| Elemento | Desvio de posição (px) | Desvio de tamanho (px) | Presente nos dois? | Veredito |

- Desvio de **até 10px** = IGUAL.
- Acima de 10px, ou elemento ausente ou a mais = FORA DA IQ, exceto se estiver em D1–D10.
- Cor diferente **não** conta aqui (é da `marca-binmax`).

## 5. Celular e tablet

Repita com os prints `docs/referencias/iq-mobile-*.png`. **Se não existirem, o teste fica BLOQUEADO.** Peça ao dono, não invente.

## 6. Guardar

Coloque a tabela e os caminhos dos 3 arquivos (IQ, Binmax, sobreposição) no relatório da etapa.
