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
Exploração livre disponível desde o início, sem notas, vidas ou limite de tempo.
## Colors
Reutilizar a paleta existente de floresta, creme e dourado.
## Typography
Texto funcional em fonte simples. Fonte pixel reservada a títulos curtos.
## Layout
Menus usam a tela inteira em retrato e paisagem, com rolagem vertical quando
necessária. A partida usa o Canvas existente em paisagem. Respeitar safe areas.
## Elevation & Depth
Bordas sólidas e sombras curtas preservam a identidade existente.
## Shapes
Botões de toque com pelo menos 48 px; controles do jogo com 56–68 px.
## Components
Convite de tela cheia após o aviso inicial, uma vez por abertura, com aceite,
recusa e instrução para sair. Falha da API nunca impede jogar.
## Do's and Don'ts
Não exigir instalação, tela cheia ou leitura para experimentar a exploração.
Não encolher controles para caber: permitir rolagem nos menus curtos.
Movimento decorativo opcional; instruções visuais e voz se complementam.
