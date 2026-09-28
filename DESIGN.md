---
name: Quintal de descobertas
colors:
  primary: "#326855"
  surface: "#203632"
  on-surface: "#fbf4df"
  accent: "#ffd479"
  ink: "#233d38"
typography:
  body: { fontFamily: "Trebuchet MS, Segoe UI, sans-serif", fontSize: 16px, fontWeight: 400, lineHeight: 1.5 }
  label: { fontFamily: "Trebuchet MS, Segoe UI, sans-serif", fontSize: 16px, fontWeight: 700, lineHeight: 1.3 }
  title: { fontFamily: "Silkscreen, monospace", fontSize: 22px, fontWeight: 700, lineHeight: 1.4 }
spacing: { sm: 8px, md: 16px, lg: 24px }
rounded: { sm: 4px, md: 8px }
components:
  button: { backgroundColor: "{colors.primary}", textColor: "{colors.on-surface}", height: 48px, rounded: "{rounded.sm}" }
---

## Overview
Preservar personagens e pixel art; experiência acolhedora para qualquer idade.
Três modos desde o início: Aventura (lições guiadas), Explorar (monta uma
palavra por fase) e Corrida do alfabeto (A–Z cronometrada). Explorar apresenta ilustrações locais e jornadas de até três palavras, com resumo
e saída para descansar. O caderno de descobertas é um acesso secundário no menu.
Errar custa um
coração; no apoio assistido, errar a leitura não custa. O antigo quintal de
exploração livre foi substituído e só existe como histórico em `docs/13`.
## Colors
Reutilizar a paleta existente de floresta, creme e dourado.
## Typography
Texto funcional em fonte simples. Fonte pixel reservada a títulos curtos.
Tamanhos de texto do DOM em `rem`, para acompanhar "Texto ampliado". Base de
botão com especificidade zero (`:where(.overlay) button`) para que as
variantes definam a hierarquia sem `!important`.
## Layout
Menus usam a tela inteira em retrato e paisagem, com rolagem vertical quando
necessária e um único dono da rolagem por tela. A partida usa o Canvas em
paisagem com escala uniforme 16:9 (faixas laterais em telas mais largas, nunca
mundo esticado). HUD e controles respeitam safe areas; o HUD do Canvas desvia
dos botões DOM medidos e usa segunda linha quando falta espaço. Na home em
paisagem baixa: personagem compacto e ações em grade de duas colunas na mesma
ordem do foco.
## Elevation & Depth
Bordas sólidas e sombras curtas preservam a identidade existente.
## Shapes
Botões de toque com pelo menos 48 px; controles do jogo com 56 px (direções)
e 68 px (pulo), 12 px de separação, iguais em todos os breakpoints. Feedback de
toque por cor/borda, sem encolher o alvo. O estado "segurando" (`.is-held`) vem
do mesmo rastreamento de dedos do input, com anel e sombra interna, nunca
`transform`. Presets em Configurações → Controles de toque: tamanho maior
(68/80 px), pulo à esquerda e distância da borda (16/32/48 px); nenhum reduz os
mínimos acima.
## Components
Convite de tela cheia após o aviso inicial, uma vez por abertura, com aceite,
recusa e instrução para sair. Falha da API nunca impede jogar.
## Do's and Don'ts
Não exigir instalação, tela cheia ou leitura para experimentar a exploração.
Não encolher controles para caber: permitir rolagem nos menus curtos.
Movimento decorativo opcional; instruções visuais e voz se complementam.
