# 01 — Arquitetura

Este documento descreve como o jogo é organizado por dentro: as camadas, quem pode
conhecer quem, como os dados fluem de uma tecla (ou toque) até o progresso salvo, e como
o laço de jogo e as cenas funcionam.

> **Princípio geral:** cada módulo tem uma responsabilidade e recebe suas dependências
> de fora (injeção de dependência). O único lugar que monta as peças concretas é
> `src/main.ts`, o *composition root*.

> **TypeScript + React:** o motor inteiro — `core/`, `physics/`, `gameplay/`, `render/`,
> `input/`, `audio/`, `scenes/`, `persistence/`, `content/` e `main.ts` — é TypeScript com
> `strict: true`. A camada de UI (`src/ui/`) é **React + TSX** para as telas de menu
> (`ui/screens/*.tsx`); a orquestração de qual tela está visível (`ui/menu.ts`) e os
> controles de toque em DOM (`ui/touch-controls.ts`) continuam sem framework, por design —
> ver seção 6. Essa fronteira — **React nunca importa do motor, e o motor nunca importa
> React** — é verificada automaticamente por dois testes em `src/architecture.test.js`
> (`describe('architecture: React stays out of the engine')`), igual à regra de
> abstração de input.

---

## 1. Camadas

O projeto é organizado em camadas. A regra de dependência é simples: **uma camada só
pode conhecer as que estão abaixo dela** (ou a si mesma). Notificações que sobem de
volta viajam pelo **barramento de eventos** (`EventBus`), nunca por chamada direta.

```
┌──────────────────────────── Apresentação ─────────────────────────────┐
│  ui/screens/*.tsx (React)  ·  ui/menu.ts (orquestra)  ·  render/hud.ts │
├──────────────────────────── Orquestração ─────────────────────────────┤
│  scenes/*.ts  ·  core/scene-manager.ts                                │
├──────────────────────────── Regras de jogo ───────────────────────────┤
│  gameplay/player/*  ·  lives-manager  ·  level-manager                │
│  content/answer-validator                                             │
├──────────────────────────── Simulação ────────────────────────────────┤
│  physics/physics-engine.ts  ·  physics/aabb.ts                        │
├──────────────────────────── Entrada ──────────────────────────────────┤
│  input/input-manager.ts  ·  input/keyboard-adapter.ts                 │
│  input/touch-adapter.ts  ·  input/composite-adapter.ts  ·  actions.ts │
├──────────────────────────── Núcleo (engine) ──────────────────────────┤
│  core/game-loop.ts  ·  core/event-bus.ts  ·  core/config.ts           │
├──────────────────────────── Dados ────────────────────────────────────┤
│  content/curriculum.json  ·  content/levels/*.json  ·  persistence/*  │
└───────────────────────────────────────────────────────────────────────┘
```

### Regras de dependência (verificadas automaticamente)

| Regra | Onde é garantida |
|---|---|
| A camada de input **não importa** gameplay, physics, scenes ou render | `src/architecture.test.js` |
| Listeners de `keydown`/`keyup` só existem dentro de `src/input/` | `src/architecture.test.js` |
| Códigos físicos de tecla (`event.code`) só aparecem em `src/input/` | `src/architecture.test.js` |
| O impulso de pulo (`jumpVelocity`) só é aplicado pelo controlador do jogador | `src/architecture.test.js` |
| As ações semânticas são definidas uma única vez (`input/actions.ts`) | `src/architecture.test.js` |
| Todo arquivo `.jsx`/`.tsx` mora em `src/ui/` e não importa `core/physics/gameplay/render/scenes` | `src/architecture.test.js` |
| Nenhum arquivo do motor (`core/physics/gameplay/render/scenes`) importa `react`/`react-dom` | `src/architecture.test.js` |

Esses testes são "funções de aptidão arquitetural": se alguém violar a regra no futuro,
a suíte falha e explica o motivo.

---

## 2. Fluxo de dados: de uma tecla (ou toque) até o progresso salvo

```
  tecla física OU botão de toque na tela
      │
      ▼
┌──────────────────────────────┐
│ keyboard-adapter.ts          │  só traduz. Zero lógica de jogo.
│ touch-adapter.ts             │  (os dois implementam o mesmo InputAdapter)
└──────────────┬───────────────┘
               │  ação semântica (Actions.JUMP), combinada por CompositeAdapter
               ▼
┌──────────────────────────────┐
│ input-manager.ts             │  guarda "segurado" e "apertado uma vez"
│  isActionHeld / consumePressed│
└──────────────┬───────────────┘
               │  GameScene lê a intenção
               ▼
┌──────────────────────────────┐
│ game-scene.ts                │  a ÚNICA ponte entre input e gameplay
│  player.moveRight()/jump()   │
└──────────────┬───────────────┘
               │  chamada semântica
               ▼
┌──────────────────────────────┐
│ player-controller.ts         │  AQUI vive a regra do pulo
│  chão? coyote? buffer?       │  (estado do jogador, timers)
└──────────────┬───────────────┘
               │  velocidade
               ▼
┌──────────────────────────────┐
│ physics-engine.ts            │  gravidade, colisão AABB eixo a eixo
└──────────────┬───────────────┘
               │  corpo atualizado
               ▼
┌──────────────────────────────┐
│ level-manager.ts             │  itens, perigos, queda
└──────────────┬───────────────┘
               │  eventos: item.collected / hazard.hit / player.fell
               ▼
┌──────────────────────────────┐
│ EventBus  ──► answer-validator│  acertou?
│          ├──► lives-manager   │  perde coração
│          ├──► effects (confete)
│          └──► progress-store  │  salva no localStorage
└──────────────────────────────┘
```

**Ponto central:** a seta `GameScene → PlayerController` é a fronteira. Nada acima dela
sabe se a entrada veio de teclado ou de toque; nada abaixo dela sabe que existe um
`InputAdapter`.

---

## 3. Laço de jogo (timestep fixo)

`src/core/game-loop.ts` usa o padrão *accumulator*:

- O navegador chama o laço via `requestAnimationFrame` (delta irregular).
- A simulação **sempre** avança em fatias fixas de `FIXED_STEP = 1/60 s`.
- O número de passos por quadro é limitado a `MAX_STEPS_PER_FRAME = 5`. Se o jogo ficou
  travado (troca de aba, computador lento), o excesso é **descartado** em vez de tentar
  recuperar tudo — isso evita a "espiral da morte".
- O desenho acontece **uma vez por quadro**, com o estado mais recente.

Consequências práticas:

- A física é determinística e igual em monitores de 60 Hz, 120 Hz ou 144 Hz.
- Testar é fácil: `advance(0.5)` roda 30 passos; `advance(10)` roda 5 e descarta o resto.

```ts
// exemplo real do teste
const loop = new GameLoop({ update, render, maxSteps: 5 });
loop.advance(0.5);  // -> 30 passos simulados, 1 desenho
```

---

## 4. Cenas

Cenas são estados de tela. `core/scene-manager.ts` guarda um registro de cenas e troca
a ativa; cada cena implementa uma interface mínima (`enter`, `exit`, `update`, `draw`).

```
boot  ──►  menu  ──►  game  ──►  victory
            ▲          │           │
            └──────────┴───────────┘
              (voltar ao menu / próxima fase)
```

| Cena | Papel |
|---|---|
| `boot-scene.ts` | Primeira cena. Carrega o manifesto de assets e troca para o menu |
| `menu-scene.ts` | Menu principal, escolha de jogador, personagem e fase |
| `game-scene.ts` | Orquestra uma lição: input → jogador → física → regras → desenho |
| `victory-scene.ts` | Tela de fase concluída, com estrelas e atalho para a próxima |

Adicionar uma cena nova é registrar uma entrada em `main.ts` — o `SceneManager` não muda
(princípio Aberto/Fechado).

**Pausa e Game Over não são cenas**: são telas React (`ui/screens/pause.tsx`,
`ui/screens/game-over.tsx`) montadas sobre o canvas, controladas por um estado interno da
`GameScene` (`running | paused | won | gameOver`). Isso evita criar cenas inteiras para
telas que só precisam pausar a simulação.

---

## 5. Barramento de eventos

`core/event-bus.ts` é um publicador/assinante minúsculo. Os nomes canônicos ficam em
`Events` para não haver strings soltas pelo código:

| Evento | Quem emite | Quem escuta |
|---|---|---|
| `lesson.started` | `GameScene` | (extensões, telemetria) |
| `item.collected` | `LevelManager` | `GameScene` |
| `hazard.hit` | `LevelManager` | `GameScene` |
| `player.fell` | `LevelManager` | `GameScene` (respawn) |
| `answer.correct` / `answer.wrong` | (derivados da validação) | HUD, efeitos |
| `lives.changed` / `lives.depleted` | `LivesManager` | `HudModel`, `GameScene` |
| `level.complete` | `GameScene` | `ProgressStore`, `VictoryScene` |
| `progress.saved` | `ProgressStore` | (extensões) |
| `scene.changed` | `SceneManager` | (extensões) |
| `app.blurred` / `app.focused` | `main.ts` | `GameScene` (pausa automática) |

Por que isso importa: a `GameScene` **não importa** o HUD, nem os confetes, nem o
armazenamento. Ela só anuncia fatos. Quem se interessa, se inscreve. Isso é o padrão
*Observer* e é o que mantém os módulos desacoplados.

---

## 6. Árvore de arquivos

```
src/
├── main.ts                     # composition root (único ponto de montagem)
├── core/
│   ├── config.ts                # TODOS os números ajustáveis
│   ├── event-bus.ts             # pub/sub + nomes canônicos de eventos
│   ├── game-loop.ts             # timestep fixo com acumulador
│   ├── scene.ts                 # classe base de cena
│   ├── scene-manager.ts         # registro e troca de cenas
│   └── asset-manager.ts         # carregamento de imagens (arte de produção)
├── input/
│   ├── actions.ts               # enum de ações semânticas (sem teclas!)
│   ├── input-adapter.ts         # contrato (Strategy)
│   ├── keyboard-keymap.ts       # mapa tecla→ação + translateKey (função pura)
│   ├── keyboard-adapter.ts      # DOM (teclado) → ações. Zero lógica de jogo.
│   ├── touch-adapter.ts         # DOM (Pointer Events) → ações. Zero lógica de jogo.
│   ├── composite-adapter.ts     # combina vários adaptadores (Composite)
│   └── input-manager.ts         # facade: isActionHeld / consumePressed / setAdapter
├── physics/
│   ├── aabb.ts                  # geometria pura de caixas
│   └── physics-engine.ts        # gravidade, movimento, colisão eixo a eixo
├── gameplay/
│   ├── player/
│   │   ├── player-controller.ts  # API semântica + regra do pulo
│   │   ├── player-state.ts       # enum + base da máquina de estados
│   │   └── states/                # idle, walk, jump, fall
│   ├── lives-manager.ts         # corações
│   ├── level-manager.ts         # itens, perigos, queda dentro da fase
│   └── speedrun-course.ts       # curso contínuo A→Z do modo Speed Run
├── render/
│   ├── canvas-renderer.ts       # única classe que fala com o Canvas 2D
│   ├── camera.ts                # câmera horizontal (matemática pura)
│   ├── sprites.ts               # desenho do mundo com a arte de produção
│   ├── sprite-assets.ts         # recortes/atlas da sprite sheet
│   ├── hud.ts / hud-model.ts    # interface (modelo puro + desenho)
│   └── effects.ts               # partículas (confete)
├── content/
│   ├── curriculum.json          # fonte de verdade do conteúdo pedagógico
│   ├── curriculum-model.ts      # expande currículo em lições (usado também pelo gerador)
│   ├── curriculum.ts            # visão de runtime do currículo
│   ├── level-loader.ts          # valida e normaliza uma fase
│   ├── level-registry.ts        # indexa todos os arquivos de fase
│   ├── text-utils.ts            # normalização de texto (acentos, caixa)
│   ├── answer-validator.ts      # acertou ou errou?
│   ├── characters.ts            # os 4 personagens
│   ├── atlas-meta.ts            # medidas da sprite sheet de produção
│   └── levels/*.json            # 152 fases geradas
├── persistence/
│   ├── storage-adapter.ts       # contrato + implementação em memória
│   ├── local-storage-adapter.ts
│   ├── storage-keys.ts          # chaves versionadas
│   ├── migration.ts             # escada de migração de saves
│   ├── save-store.ts            # leitura/escrita do documento único
│   ├── profile-store.ts         # perfis de jogador
│   ├── progress-store.ts        # progresso por perfil
│   └── audio-settings-store.ts  # preferência de volume/mudo
├── audio/
│   └── audio-manager.ts         # mute/volume + registro de música e efeitos
├── ui/
│   ├── dom.ts                   # helpers de DOM (textContent, nunca innerHTML)
│   ├── menu.ts                  # orquestra qual tela React está montada (sem React)
│   ├── touch-controls.ts        # D-pad + botão de pulo em DOM (deliberadamente sem React)
│   ├── pixel-logo.ts            # logo em SVG
│   └── screens/                 # telas de menu em React/TSX
│       ├── mount-screen.ts      # monta um <ReactNode> num container DOM
│       ├── main-menu.tsx / character-picker.tsx / lesson-picker.tsx
│       ├── pause.tsx / game-over.tsx / victory.tsx
│       └── privacy-notice.tsx   # aviso parental (LGPD)
└── scenes/
    ├── boot-scene.ts
    ├── menu-scene.ts
    ├── game-scene.ts
    └── victory-scene.ts

tools/
├── generate-levels.mts          # gera as fases a partir do currículo
└── generate-pwa-icons.mjs       # gera os ícones do PWA

public/assets/    arte de produção (pixel art): personagens, cenários, itens
public/fonts/     fonte self-hosted (OFL 1.1)
public/icons/     ícones do PWA
docker/           Nginx do contêiner + Nginx de proxy reverso da VPS
docs/             esta documentação (pt-BR)
imgs_referencia/  sprite sheet apenas como referência de medida (não distribuída)
```

> Por que `ui/menu.ts` e `ui/touch-controls.ts` não são React: `menu.ts` só decide qual
> tela React montar/desmontar (via `mountScreen`), sem depender do framework para isso; e
> os botões de toque em `touch-controls.ts` precisam ser os mesmos elementos DOM que o
> `TouchAdapter` escuta durante toda a partida — remontá-los via React arriscaria destacar
> os listeners do adaptador do DOM real. Ver [11 — Mobile, PWA e deploy](11-mobile-pwa-e-deploy.md).

---

## 7. Sistema de coordenadas

Adotamos o sistema do Canvas: **pixels de tela, origem no canto superior esquerdo,
`y` crescendo para baixo**.

- A gravidade é **positiva** (`+1500 px/s²`).
- A velocidade de pulo é **negativa** (`-620 px/s`).
- A câmera subtrai sua posição ao desenhar (`worldFillRect` faz `x - camera.x`).

Escolher isso de forma explícita evita a confusão clássica de sinais invertidos. Há
testes de câmera justamente para fixar essa convenção.

---

## 8. Configuração central

Todo número que dá "sensação" ao jogo está em `src/core/config.ts`:

| Constante | Valor | Efeito |
|---|---|---|
| `FIXED_STEP` | `1/60` | Ritmo da simulação |
| `MAX_STEPS_PER_FRAME` | `5` | Proteção contra travamentos |
| `PHYSICS.gravity` | `1500` | Queda mais pesada ou mais leve |
| `PHYSICS.jumpVelocity` | `-620` | Altura do pulo |
| `PHYSICS.walkSpeed` | `260` | Velocidade ao andar |
| `PHYSICS.airControl` | `0.75` | Controle no ar |
| `PHYSICS.jumpCutMultiplier` | `0.45` | Pulo curto ao soltar a tecla |
| `PLAYER.jumpBufferTime` | `0.1 s` | Apertar um pouco antes de aterrissar ainda vale |
| `PLAYER.coyoteTime` | `0.1 s` | Período de graça ao sair da borda |
| `GAMEPLAY.startingLives` | `3` | Corações |
| `GAMEPLAY.celebrationDuration` | `2.2 s` | Tempo de comemoração antes da próxima tela |

Balancear o jogo é **mudar dados aqui**, sem tocar em lógica — exatamente o princípio
Aberto/Fechado aplicado ao ajuste de dificuldade.

---

## 9. Decisões e armadilhas evitadas

| Armadilha | Como o projeto resolve |
|---|---|
| Sistema de coordenadas ambíguo | Convenção do Canvas documentada + testes de câmera |
| Movimento dependente da taxa de quadros | Timestep fixo com acumulador |
| Espaço/setas rolando a página | `preventDefault()` nas teclas mapeadas, no `keydown` **e** no `keyup` |
| Segurar a tecla pular repetidamente | `event.repeat` é ignorado para ações de disparo único |
| Tecla presa após perder o foco | `blur`/`visibilitychange` limpam o input e pausam o jogo |
| Pressionar um botão do menu rouba o foco | Todo botão de menu perde o foco ao ser clicado (`blurOnClick`) |
| Layout de teclado (ABNT2 vs US) | Mapeamento por `event.code` (posição física), não por `event.key` |
| Dedo arrastando para fora do botão de toque | `pointerleave`/`pointercancel` soltam a ação, igual a `pointerup` |
| Eventos sintéticos de mouse/rolagem no toque | `TouchAdapter` usa Pointer Events com `preventDefault()` + `setPointerCapture` |
| Save corrompido quebra o jogo | `migration.ts` + cópia degradada em `joguinho.sobrinhos.v1.degraded` |
| localStorage indisponível (modo privado) | Adaptador em memória como reserva; o jogo roda sem salvar |
| Tunelamento através de paredes finas | Limite de 5 passos por quadro e terrenos gerados com pelo menos 1 tile de espessura |
