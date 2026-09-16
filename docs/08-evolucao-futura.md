# 08 — Evolução futura

Onde cada extensão planejada encaixa na arquitetura **sem quebrar o que já funciona**.
Cada seção mostra o ponto de extensão exato e o que **não** precisa mudar.

> A regra geral: se uma extensão exigir mexer em muitos arquivos não relacionados, a
> arquitetura está errada. As extensões abaixo tocam 1 ou 2 arquivos cada.

---

## 1. Pulo duplo

**Estado atual:** existe apenas um pulo; `_tryBufferedJump()` só permite pular quando
`body.grounded` ou dentro do tempo de coiote. Há um teste garantindo que não há pulo duplo.

**Ponto de extensão:** a máquina de estados do jogador.

```js
// 1. player-state.js — acrescente o id
export const PlayerStateId = Object.freeze({
  IDLE: 'idle', WALK: 'walk', JUMP: 'jump', FALL: 'fall',
  DOUBLE_JUMP: 'doubleJump',        // novo
});

// 2. states/double-jump-state.js — uma classe pequena, igual a JumpState
export class DoubleJumpState extends PlayerState {
  get id() { return PlayerStateId.DOUBLE_JUMP; }
  update(_dt) {
    this.player.applyAirMovement();
    if (this.player.body.vy >= 0) this.player.setState(PlayerStateId.FALL);
  }
}

// 3. player-controller.js — registre o estado e permita o segundo pulo
this._states.set(PlayerStateId.DOUBLE_JUMP, new DoubleJumpState(this));

_jump() {
  if (this.body.grounded || this._coyoteTimer > 0) { this._performJump(); return; }
  if (this._airJumpsLeft > 0) { this._airJumpsLeft -= 1; this._performJump(/* ... */); }
}
```

**O que NÃO muda:** `keyboard-adapter.js`, `input-manager.js`, `actions.js`,
`game-scene.js`, `physics-engine.js`, a UI e todos os testes existentes. A ação
`Actions.JUMP` continua igual — o que muda é só o que o controlador faz com ela. Esse é o
benefício direto de ter tirado a lógica de pulo do listener.

---

## 2. Poderes `E` e `Q`

As ações **já existem** no vocabulário: `Actions.POWER_1` e `Actions.POWER_2`, já mapeadas
para `E` e `Q`. Hoje não fazem nada além de serem registradas.

**Ponto de extensão:** uma estratégia de poder no controlador do jogador.

```js
export class PlayerController {
  usePower(powerId) {
    const power = this._powers.get(powerId);
    if (!power || !power.isReady() || !power.canActivate(this)) return;
    power.activate(this);
  }
}

// Estratégias concretas (Strategy, de novo):
//   DashPower     -> impulso horizontal com invulnerabilidade breve
//   FloatPower    -> queda lenta por alguns segundos
//   FreezePower   -> congela perigos temporariamente
```

Na cena:

```js
if (this.game.input.consumePressed(Actions.POWER_1)) this.player.usePower('dash');
```

**O que NÃO muda:** adaptadores, física, conteúdo, persistência. HUD ganha um indicador de
poder (novo campo no `HudModel`).

---

## 3. Som

**Ponto de extensão:** um `SoundManager` que se inscreve nos **mesmos eventos** já emitidos.

```js
// src/audio/sound-manager.js
export class SoundManager {
  constructor({ bus, library }) {
    this._bus = bus;
    this._library = library;
    bus.on(Events.ITEM_COLLECTED, () => this.play('collect'));
    bus.on(Events.ANSWER_CORRECT, () => this.play('correct'));
    bus.on(Events.ANSWER_WRONG, () => this.play('wrong'));
    bus.on(Events.LIVES_DEPLETED, () => this.play('gameOver'));
    bus.on(Events.LEVEL_COMPLETE, () => this.play('victory'));
  }
  play(name) { /* WebAudio ou HTMLAudioElement */ }
}
```

A `GameScene` **não sabe** que existe som. Ela já anuncia os fatos; o gerenciador de áudio
apenas escuta. Nenhum arquivo de gameplay é tocado.

Música por unidade: o campo `music` já existe no schema da fase (hoje `null`), previsto
exatamente para isso.

---

## 4. Controles por toque (tablet)

**Ponto de extensão:** um novo adaptador de entrada.

```js
// src/input/pointer-adapter.js
export class PointerAdapter extends InputAdapter {
  attach() { /* botões na tela -> onAction(Actions.JUMP, { pressed: true }) */ }
}
```

E um adaptador composto para aceitar teclado **e** toque ao mesmo tempo (ver
[03](03-abstracao-de-input.md#75-bônus-teclado-e-esp32-ao-mesmo-tempo)).

**O que NÃO muda:** tudo o que está acima da camada de input.

---

## 5. ESP32

Detalhado em [03 — Abstração de input](03-abstracao-de-input.md#7-como-plugar-o-esp32-no-futuro-o-caminho-exato).
Resumo do impacto:

| Camada | Muda? |
|---|---|
| `input/` | **Sim** — um arquivo novo (`esp32-adapter.js`) |
| `main.js` | **Sim** — uma linha (`setAdapter`) |
| Gameplay, física, render, conteúdo, persistência | **Não** |
| Testes existentes | **Não** |

---

## 6. Novas unidades e mais conteúdo

`curriculum.json` + `npm run generate:levels`. **Zero código.**

Ideias de conteúdo:

- Sílabas complexas (BRA, CRA, PLA…) e palavras trissílabas.
- Rimas: "qual palavra rima com PÃO?"
- Contagem de sílabas: coletar a palavra com 2 sílabas.
- Frases curtas para leitura.
- Números de 0 a 9 na mesma mecânica.

---

## 7. Novos tipos de fase

O `level-loader.js` valida esquema e geometria; o `physics-engine` só conhece retângulos
sólidos e plataformas de mão única. Extensões naturais:

| Extensão | Onde |
|---|---|
| Plataformas móveis | Novo campo no schema + atualização na `GameScene` e no `PhysicsEngine` |
| Blocos que somem | Novo campo + reação a evento |
| Itens que se movem | `LevelManager` atualiza posição antes da checagem |
| Fundos em parallax | `render/sprites.js` usa `camera.x` com fatores diferentes |

Como a física recebe uma **lista de retângulos**, uma plataforma móvel é apenas um
retângulo cuja posição muda por quadro — o núcleo da colisão continua o mesmo.

---

## 8. Acessibilidade

| Melhoria | Ponto de extensão |
|---|---|
| Narração do objetivo | Um `SpeechManager` inscrito em `lesson.started` |
| Alto contraste | Variáveis de cor já centralizadas em `config.js` e no CSS |
| Escala de fonte | `hud.js` recebe o tamanho por parâmetro |
| Teclas remapeáveis | `DEFAULT_KEYMAP` já é um parâmetro de `translateKey` e do adaptador |
| Modo com mais corações | `GAMEPLAY.startingLives` |
| Modo sem perigos | Campo por fase; o `level-manager` simplesmente ignora a lista |

Todas essas são **mudanças de dado ou de uma camada só** — nenhuma exige reescrever regras.

---

## 9. Relatório para pais e professores

O `progress-store` já guarda `stats: { correct, wrong }` por perfil e o melhor resultado por
lição. Acrescentar, por exemplo, "quais unidades a criança mais erra" é ler esses dados e
agrupar por `unitId` — não exige mudar nenhuma regra de jogo.

---

## 10. Como decidir se uma extensão "cabe" na arquitetura

Antes de implementar algo novo, faça três perguntas:

1. **Isso é dado ou regra?** Se for dado (letras, fases, cores, dificuldade), vai para
   `config.js` ou JSON — sem código.
2. **Isso é uma nova *fonte* de entrada?** Então é um `InputAdapter` novo.
3. **Isso é um novo *comportamento* do personagem?** Então é um `PlayerState` novo.

Se a resposta não estiver em nenhuma dessas, provavelmente é uma responsabilidade nova e
merece um módulo próprio — com uma única razão para existir.
