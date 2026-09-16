# Plano de Adaptação Mobile — Aventura do Nicolas&Eloá

Documento de planejamento para transformar o jogo (hoje desktop-only) em uma
versão web responsiva, jogável por toque, instalável como PWA. Este documento
não contém código — é o roteiro para a implementação, que deve ser feita em
etapas separadas.

## 1. Visão geral

O jogo é um platformer 2D em Canvas 2D + Vite (~4.600 linhas, sem engine),
com uma arquitetura de input já desenhada para múltiplas fontes de entrada:

- [`src/input/input-adapter.js`](src/input/input-adapter.js) define um
  contrato Strategy explícito. O próprio comentário do código já prevê isso:
  "this is the seam where a future ESP32 adapter plugs in" — um `TouchAdapter`
  é exatamente esse tipo de encaixe.
- A física e os estados do jogador
  ([`src/gameplay/player/`](src/gameplay/player/)) consomem apenas ações
  semânticas (`getMoveAxis()`, `isActionHeld(JUMP)`, `consumePressed(JUMP)`),
  nunca teclas cruas. Controles touch não exigem nenhuma mudança em
  física/gameplay.
- O layout já escala fluidamente via CSS
  (`.game-viewport` em [`src/styles/main.css`](src/styles/main.css), fórmula
  `width: min(100vw, calc(100vh*16/9))`), e o
  [`index.html`](index.html) já tem a meta viewport correta.
- Menus e HUD já são DOM ([`src/ui/menu.js`](src/ui/menu.js),
  [`src/ui/hud-controls.js`](src/ui/hud-controls.js)), então cliques já
  funcionam como toques sem alteração.

**Conclusão:** não é um port, é uma **adição de camada** — input touch,
controles visuais em tela, áudio compatível com mobile, e empacotamento PWA.

**Escopo decidido:** web responsivo + PWA instalável (tela inicial,
standalone, funciona offline). Sem loja de apps por enquanto — ver seção 8
para o caminho de evolução com Capacitor, se algum dia fizer sentido.

**Controle escolhido:** D-pad (esquerda/direita) + botão de pulo, como
botões fixos em tela.

## 2. Fase 1 — Input touch

- Criar `src/input/touch-adapter.js` implementando o contrato de
  `InputAdapter` (mesma interface do
  [`src/input/keyboard-adapter.js`](src/input/keyboard-adapter.js) existente).
- Emitir as mesmas ações semânticas já definidas em
  [`src/input/actions.js`](src/input/actions.js): `MOVE_LEFT`, `MOVE_RIGHT`,
  `JUMP`, `PAUSE`, `CONFIRM`, `BACK` — via `pointerdown` / `pointerup` /
  `pointercancel` nos botões virtuais (usar Pointer Events, não touch events,
  para funcionar também com mouse/caneta).
- Registrar o `TouchAdapter` ao lado do `KeyboardAdapter` no
  [`src/input/input-manager.js`](src/input/input-manager.js) — os dois podem
  ficar ativos simultaneamente (ex: notebook conversível com tela touch).
- Detectar se o dispositivo é touch via `matchMedia('(pointer: coarse)')`
  para decidir se os controles visuais em tela devem aparecer.

## 3. Fase 2 — Controles visuais em tela

- Novo componente DOM, seguindo o padrão de
  [`src/ui/hud-controls.js`](src/ui/hud-controls.js) e
  [`src/ui/dom.js`](src/ui/dom.js), montado em `#hud-controls-root`
  (já existe em [`index.html`](index.html)).
- Botões de esquerda/direita e pulo, fixados nos cantos inferiores da tela.
- CSS novo em [`src/styles/main.css`](src/styles/main.css) (ou arquivo
  dedicado, ex: `touch-controls.css`):
  - `touch-action: none` e `user-select: none` nos botões, para evitar
    scroll/zoom acidental e seleção de texto.
  - Alvos de toque com pelo menos 44×44px (diretriz de acessibilidade
    mobile).
  - Posicionamento respeitando `env(safe-area-inset-*)` para não colidir
    com notch/home-indicator em iPhones.
- Ocultar os controles em desktop (reaproveitando a detecção da Fase 1), para
  não poluir a tela de quem joga com teclado.

## 4. Fase 3 — Áudio compatível com mobile

- Navegadores mobile bloqueiam `Audio.play()` sem uma interação de usuário
  prévia. Hoje, [`src/audio/audio-manager.js`](src/audio/audio-manager.js)
  já engole erros de autoplay silenciosamente (`.play?.().catch(() => {})`,
  linhas 60 e 76), o que mascara o problema em vez de resolvê-lo.
- Garantir que a primeira reprodução de música/SFX aconteça dentro de um
  handler de toque/clique real (ex: o clique no botão "Jogar" do menu
  principal em [`src/ui/menu.js`](src/ui/menu.js)) — isso já "destrava" o
  áudio para o resto da sessão em todos os navegadores relevantes.
- Documentar esse requisito para quem for implementar: não iniciar música
  automaticamente ao carregar a página; sempre atrelar o primeiro `play()`
  a um gesto do usuário.

## 5. Fase 4 — Ajustes de tela/orientação

- O jogo é fixo em 960×540 (16:9 landscape,
  [`src/core/config.js`](src/core/config.js) `VIEWPORT`). Em celulares no
  modo retrato, a fórmula de escala atual deixa o jogo pequeno (limitado pela
  largura da tela).
- **Decisão recomendada:** manter o jogo landscape-only e mostrar um aviso
  "gire seu celular" quando o dispositivo estiver em portrait — menor
  esforço, não exige redesenhar a UI para proporções diferentes.
- Implementar via media query: quando `(pointer: coarse) and (orientation:
  portrait)`, mostrar um overlay full-screen (ex: ícone de rotação + texto)
  por cima do `#app`, escondendo o jogo até o usuário girar o aparelho.

## 6. Fase 5 — PWA instalável

- Adicionar [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) ao
  projeto (o projeto já usa Vite, então isso evita escrever manifest/service
  worker manualmente).
- Gerar `manifest.webmanifest`: nome, ícones (192×192 e 512×512, a partir do
  branding atual do jogo/logo em pixel art), `display: standalone`,
  `orientation: landscape`, cores de tema.
- Service worker com cache-first para assets estáticos e para os ~150 JSONs
  de nível em [`src/content/levels/`](src/content/levels/), permitindo jogar
  offline após a primeira visita.
- Referenciar o manifest e a `theme-color` no `<head>` de
  [`index.html`](index.html).

## 7. Fase 6 — Testes e validação

- Teste unitário do `TouchAdapter`, seguindo o padrão dos testes existentes
  para `KeyboardAdapter` (arquivo `*.test.js` correspondente).
- Checklist manual de dispositivo real:
  - Chrome Android (DevTools device mode + celular físico).
  - Safari iOS (atenção especial a autoplay de áudio e safe-area do notch).
  - Instalar como PWA em ambos e confirmar que abre em modo standalone.
- Critério de pronto: um jogador completa um nível inteiro usando apenas
  toque, sem teclado conectado.

## 8. Riscos e decisões em aberto

- **Portrait vs. landscape-only:** recomendado landscape-only com aviso de
  rotação (ver Fase 4); revisar se o público-alvo (crianças) lida bem com
  isso ou se vale investir em um layout portrait dedicado no futuro.
- **App de loja (Capacitor):** não fazer agora. Se um dia for necessário
  publicar nas lojas Android/iOS, o PWA resultante desta fase pode ser
  empacotado com Capacitor sem reescrever o jogo — é um passo incremental
  futuro, não um requisito deste plano.
- **Tamanho do cache offline:** os ~150 arquivos JSON de nível são pequenos
  individualmente, mas cachear todos de uma vez pode não ser necessário —
  avaliar cache sob demanda (por nível acessado) vs. cache total no primeiro
  carregamento, ao implementar o service worker.

## Ordem de execução sugerida

1. Fase 1 (Touch Adapter) — habilita a jogabilidade básica.
2. Fase 2 (Controles visuais) — sem isso a Fase 1 não é utilizável.
3. Fase 3 (Áudio) — pequena, mas crítica para não quebrar silenciosamente.
4. Fase 4 (Orientação) — evita a experiência quebrada em portrait.
5. Fase 5 (PWA) — valor agregado, não bloqueia jogabilidade.
6. Fase 6 (Testes) — validação contínua a cada fase, não só no final.
