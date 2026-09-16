# 01 — Arquitetura

Este documento descreve como o jogo é organizado por dentro: as camadas, quem pode
conhecer quem, como os dados fluem de uma tecla até o progresso salvo, e como o laço
de jogo e as cenas funcionam.

> **Princípio geral:** cada módulo tem uma responsabilidade e recebe suas dependências
> de fora (injeção de dependência). O único lugar que monta as peças concretas é
> `src/main.js`, o *composition root*.

---

## 1. Camadas

O projeto é organizado em camadas. A regra de dependência é simples: **uma camada só
pode conhecer as que estão abaixo dela** (ou a si mesma). Notificações que sobem de
volta viajam pelo **barramento de eventos** (`EventBus`), nunca por chamada direta.

```
┌──────────────────────────── Apresentação ─────────────────────────────┐
│  ui/menu.js (overlays DOM)  ·  render/hud.js  ·  render/sprites.js    │
├──────────────────────────── Orquestração ─────────────────────────────┤
│  scenes/*.js  ·  core/scene-manager.js                                │
├──────────────────────────── Regras de jogo ───────────────────────────┤
│  gameplay/player/*  ·  lives-manager  ·  level-manager                │
│  content/answer-validator                                             │
├──────────────────────────── Simulação ────────────────────────────────┤
│  physics/physics-engine.js  ·  physics/aabb.js                        │
├──────────────────────────── Entrada ──────────────────────────────────┤
│  input/input-manager.js  ·  input/keyboard-adapter.js  ·  actions.js  │
├──────────────────────────── Núcleo (engine) ──────────────────────────┤
│  core/game-loop.js  ·  core/event-bus.js  ·  core/config.js           │
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
| As ações semânticas são definidas uma única vez (`input/actions.js`) | `src/architecture.test.js` |

Esses testes são "funções de aptidão arquitetural": se alguém violar a regra no futuro,
a suíte falha e explica o motivo.

---

## 2. Fluxo de dados: de uma tecla até o progresso salvo

```
  tecla física
      │
      ▼
┌──────────────────────────────┐
│ keyboard-adapter.js          │  só traduz. Zero lógica de jogo.
│  translateKey(event.code)    │
└──────────────┬───────────────┘
               │  ação semântica (Actions.JUMP)
               ▼
┌──────────────────────────────┐
│ input-manager.js             │  guarda "segurado" e "apertado uma vez"
│  isActionHeld / consumePressed│
└──────────────┬───────────────┘
               │  GameScene lê a intenção
               ▼
┌──────────────────────────────┐
│ game-scene.js                │  a ÚNICA ponte entre input e gameplay
│  player.moveRight()/jump()   │
└──────────────┬───────────────┘
               │  chamada semântica
               ▼
┌──────────────────────────────┐
│ player-controller.js         │  AQUI vive a regra do pulo
│  chão? coyote? buffer?       │  (estado do jogador, timers)
└──────────────┬───────────────┘
               │  velocidade
               ▼
┌──────────────────────────────┐
│ physics-engine.js            │  gravidade, colisão AABB eixo a eixo
└──────────────┬───────────────┘
               │  corpo atualizado
               ▼
┌──────────────────────────────┐
│ level-manager.js             │  itens, perigos, queda
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
sabe o que é "pular"; nada abaixo dela sabe que existe um teclado.

---

## 3. Laço de jogo (timestep fixo)

`src/core/game-loop.js` usa o padrão *accumulator*:

- O navegador chama o laço via `requestAnimationFrame` (delta irregular).
- A simulação **sempre** avança em fatias fixas de `FIXED_STEP = 1/60 s`.
- O número de passos por quadro é limitado a `MAX_STEPS_PER_FRAME = 5`. Se o jogo ficou
  travado (troca de aba, computador lento), o excesso é **descartado** em vez de tentar
  recuperar tudo — isso evita a "espiral da morte".
- O desenho acontece **uma vez por quadro**, com o estado mais recente.

Consequências práticas:

- A física é determinística e igual em monitores de 60 Hz, 120 Hz ou 144 Hz.
- Testar é fácil: `advance(0.5)` roda 30 passos; `advance(10)` roda 5 e descarta o resto.

```js
// exemplo real do teste
const loop = new GameLoop({ update, render, maxSteps: 5 });
loop.advance(0.5);  // -> 30 passos simulados, 1 desenho
```

---

## 4. Cenas

Cenas são estados de tela. `core/scene-manager.js` guarda um registro de cenas e troca
a ativa; cada cena implementa uma interface mínima (`enter`, `exit`, `update`, `draw`).

```
boot  ──►  menu  ──►  game  ──►  victory
            ▲          │           │
            └──────────┴───────────┘
              (voltar ao menu / próxima fase)
```

| Cena | Papel |
|---|---|
| `boot-scene.js` | Primeira cena. Prepara o necessário e troca para o menu no primeiro quadro |
| `menu-scene.js` | Menu principal, escolha de jogador, personagem e fase |
| `game-scene.js` | Orquestra uma lição: input → jogador → física → regras → desenho |
| `victory-scene.js` | Tela de fase concluída, com estrelas e atalho para a próxima |

Adicionar uma cena nova é registrar uma entrada em `main.js` — o `SceneManager` não muda
(princípio Aberto/Fechado).

**Pausa e Game Over não são cenas**: são sobreposições de DOM controladas por um estado
interno da `GameScene` (`running | paused | won | gameOver`). Isso evita criar cenas
inteiras para telas que só precisam pausar a simulação.

---

## 5. Barramento de eventos

`core/event-bus.js` é um publicador/assinante minúsculo. Os nomes canônicos ficam em
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
| `app.blurred` / `app.focused` | `main.js` | `GameScene` (pausa automática) |

Por que isso importa: a `GameScene` **não importa** o HUD, nem os confetes, nem o
armazenamento. Ela só anuncia fatos. Quem se interessa, se inscreve. Isso é o padrão
*Observer* e é o que mantém os módulos desacoplados.

---

## 6. Árvore de arquivos

```
src/
├── main.js                  # composition root (único ponto de montagem)
├── core/
│   ├── config.js            # TODOS os números ajustáveis
│   ├── event-bus.js         # pub/sub + nomes canônicos de eventos
│   ├── game-loop.js         # timestep fixo com acumulador
│   ├── scene.js             # classe base de cena
│   ├── scene-manager.js     # registro e troca de cenas
│   └── asset-manager.js     # carregamento de imagens (para a arte real)
├── input/
│   ├── actions.js           # enum de ações semânticas (sem teclas!)
│   ├── input-adapter.js     # contrato (Strategy) + MemoryStorage... não: contrato só
│   ├── keyboard-keymap.js   # mapa tecla→ação + translateKey (função pura)
│   ├── keyboard-adapter.js  # DOM → ações. Zero lógica de jogo.
│   └── input-manager.js     # facade: isActionHeld / consumePressed / setAdapter
├── physics/
│   ├── aabb.js              # geometria pura de caixas
│   └── physics-engine.js    # gravidade, movimento, colisão eixo a eixo
├── gameplay/
│   ├── player/
│   │   ├── player-controller.js  # API semântica + regra do pulo
│   │   ├── player-state.js       # enum + base da máquina de estados
│   │   └── states/               # idle, walk, jump, fall
│   ├── lives-manager.js     # corações
│   └── level-manager.js     # itens, perigos, queda dentro da fase
├── render/
│   ├── canvas-renderer.js   # única classe que fala com o Canvas 2D
│   ├── camera.js            # câmera horizontal (matemática pura)
│   ├── sprites.js           # desenho do mundo com formas provisórias
│   ├── hud.js / hud-model.js# interface (modelo puro + desenho)
│   ├── effects.js           # partículas (confete)
│   └── atlas-meta.js        # medidas da sprite sheet de referência
├── content/
│   ├── curriculum.json      # fonte de verdade do conteúdo pedagógico
│   ├── curriculum-model.js  # expande currículo em lições (usado também pelo gerador)
│   ├── curriculum.js        # visão de runtime do currículo
│   ├── level-loader.js      # valida e normaliza uma fase
│   ├── level-registry.js    # indexa todos os arquivos de fase
│   ├── text-utils.js        # normalização de texto (acentos, caixa)
│   ├── answer-validator.js  # acertou ou errou?
│   ├── characters.js        # os 4 personagens
│   └── levels/*.json        # 152 fases geradas
├── persistence/
│   ├── storage-adapter.js   # contrato + implementação em memória
│   ├── local-storage-adapter.js
│   ├── storage-keys.js      # chaves versionadas
│   ├── migration.js         # escada de migração de saves
│   ├── save-store.js        # leitura/escrita do documento único
│   ├── profile-store.js     # perfis de jogador
│   └── progress-store.js    # progresso por perfil
├── ui/
│   ├── dom.js               # helpers de DOM (textContent, nunca innerHTML)
│   └── menu.js              # todas as sobreposições de menu (pt-BR)
└── scenes/
    ├── boot-scene.js
    ├── menu-scene.js
    ├── game-scene.js
    └── victory-scene.js

tools/
└── generate-levels.mjs      # gera as fases a partir do currículo

docs/                        # esta documentação (pt-BR)
imgs_referencia/             # sprite sheet apenas como referência de medida
```

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

Todo número que dá "sensação" ao jogo está em `src/core/config.js`:

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
| Pressionar um botão do menu rouba o foco | Todo botão de menu tem `tabindex="-1"` e perde o foco ao ser clicado |
| Layout de teclado (ABNT2 vs US) | Mapeamento por `event.code` (posição física), não por `event.key` |
| Save corrompido quebra o jogo | `migration.js` + cópia degradada em `joguinho.sobrinhos.v1.degraded` |
| localStorage indisponível (modo privado) | Adaptador em memória como reserva; o jogo roda sem salvar |
| Tunelamento através de paredes finas | Limite de 5 passos por quadro e terrenos gerados com pelo menos 1 tile de espessura |
