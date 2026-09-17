# 03 — Abstração de input

Este é o documento mais importante da arquitetura deste projeto.

> **O requisito, em uma frase:** o listener de teclado só traduz tecla em **ação
> semântica**; a lógica de jogo (por exemplo, "pular só se estiver no chão") vive em um
> método próprio do controlador do jogador — **nunca dentro do evento de tecla**.

O objetivo é permitir que qualquer fonte de entrada — hoje **toque**, amanhã um **ESP32**
(sensor, botão físico, tapete) — passe a controlar o jogo **sem alterar uma única linha
de gameplay**. Isso não é só teoria: o projeto já tem **dois** adaptadores reais rodando
ao mesmo tempo em produção (teclado e toque, seção 8), o que prova que a abstração
funciona antes mesmo do ESP32 existir.

---

## 1. O problema que estamos evitando

O caminho ingênuo, que este projeto proíbe:

```js
// ❌ NUNCA. Três problemas de uma vez.
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    if (player.y >= groundY && player.vy === 0) {   // lógica de jogo aqui dentro
      player.vy = -620;                              // número mágico aqui dentro
      player.jumping = true;
    }
  }
});
```

Problemas:

1. **Regra de jogo no listener.** Qualquer mudança no pulo mexe na camada de entrada.
2. **Hardware acoplado.** Para trocar teclado por sensor, é preciso reescrever a regra.
3. **Intestável.** Testar o pulo exige simular eventos de DOM.

---

## 2. O caminho adotado no projeto

Quatro peças, cada uma com uma responsabilidade:

```
   tecla física                       (hardware)
        │
        ▼
┌───────────────────────────┐
│ keyboard-keymap.ts        │  1. TRADUÇÃO  (função pura)
│ translateKey('Space')     │     'Space' ──► Actions.JUMP
│      → Actions.JUMP       │
└─────────┬─────────────────┘
          ▼
┌───────────────────────────┐
│ keyboard-adapter.ts       │  2. CAPTURA   (só DOM, zero regra)
│ onKeyDown → onAction(…)   │     preventDefault, ignora auto-repeat
└─────────┬─────────────────┘
          ▼
┌───────────────────────────┐
│ input-manager.ts          │  3. ESTADO    (segurado / apertado uma vez)
│ isActionHeld(…)           │     consumível uma vez por quadro
│ consumePressed(…)         │
└─────────┬─────────────────┘
          ▼
┌───────────────────────────┐
│ player-controller.ts      │  4. DECISÃO   (aqui, e só aqui, mora o pulo)
│ jump() { … }              │     chão? coyote? buffer? estado?
└───────────────────────────┘
```

E a ponte entre (3) e (4) é uma linha da cena:

```js
// src/scenes/game-scene.ts
if (this.game.input.consumePressed(Actions.JUMP)) this.player.jump();
```

Repare: a cena **pede** o pulo; ela não decide se ele é possível. Quem decide é o
controlador.

---

## 3. As ações semânticas

`src/input/actions.ts` é o **vocabulário compartilhado** por todas as fontes de entrada.
Ele não contém nome de tecla nem detalhe de hardware:

```js
export const Actions = Object.freeze({
  MOVE_LEFT:  'moveLeft',    // contínuo
  MOVE_RIGHT: 'moveRight',   // contínuo
  JUMP:       'jump',        // disparo único
  PAUSE:      'pause',       // disparo único
  CONFIRM:    'confirm',     // disparo único (menus)
  BACK:       'back',        // disparo único (menus)
  DEBUG:      'debug',       // disparo único (hitboxes)
  POWER_1:    'power1',      // reservado
  POWER_2:    'power2',      // reservado
});
```

`Actions.JUMP` **não é** a barra de espaço. É "o jogador quer pular". Essa distinção é o
coração da abstração.

## 4. O contrato do adaptador (Strategy)

`src/input/input-adapter.ts` define a interface que **toda** fonte de entrada implementa:

```js
export class InputAdapter {
  constructor(onAction) { this.onAction = onAction; }  // (ação, meta) => void
  attach() {}     // registra os listeners de hardware
  detach() {}     // remove os listeners
  dispose() {}    // limpa recursos
}
```

**Regra do contrato:** um adaptador só pode emitir ações semânticas. Ele **não pode**
importar `gameplay/`, `physics/`, `scenes/` nem `render/` — e há um teste que verifica
isso automaticamente:

```js
// src/architecture.test.js
it('the input layer never depends on gameplay, physics, render or scenes', () => { ... });
```

O adaptador de teclado é deliberadamente sem cérebro:

```js
// src/input/keyboard-adapter.ts
_handleKeyDown(event) {
  const action = translateKey(event.code, this._keymap);
  if (!action) return;
  event.preventDefault();                                   // Espaço/setas não rolam a página
  this.onAction(action, { pressed: true, repeated: event.repeat === true });
}
```

Não existe `if (está no chão)` aqui. Não existe número de gravidade. Só tradução e repasse.

## 5. O estado do input

`src/input/input-manager.ts` mantém duas visões:

| Pergunta | Método | Uso típico |
|---|---|---|
| "Está segurando?" | `isActionHeld(action)` | Andar; decidir se o pulo continua subindo |
| "Acabou de apertar?" | `consumePressed(action)` | Disparar o pulo, pausar, confirmar |

`consumePressed` **apaga** a marcação ao ser lido, e o laço de jogo (`main.ts`) chama
`input.endFrame()` ao final de cada passo simulado. Assim um aperto nunca "vaza" para um
quadro seguinte — segurar `Espaço` não faz o personagem pular repetidamente.

O `Event.repeat` do sistema operacional também é ignorado para eventos de disparo único,
pelo mesmo motivo.

Trocar de adaptador em tempo de execução é suportado:

```js
input.setAdapter(new KeyboardAdapter(input.handleAction));   // hoje
input.setAdapter(new Esp32Adapter(input.handleAction));      // amanhã, sem mudar o resto
```

`setAdapter` descarta o adaptador anterior, limpa o estado e conecta o novo — o jogo nem
percebe de onde vêm as ações.

## 6. Como o pulo é decidido (e por que importa)

A regra completa, em um só lugar, em `player-controller.ts`:

```js
// src/gameplay/player/player-controller.ts
jump() {
  this._jumpBufferTimer = this._config.jumpBufferTime;   // guarda a intenção
}

_tryBufferedJump() {
  const canJump = this.body.grounded || this._coyoteTimer > 0;
  if (this._jumpBufferTimer > 0 && canJump) this._performJump();
}

_performJump() {
  this.body.vy = this._config.jumpVelocity;   // o impulso vive SÓ aqui
  this.body.grounded = false;
  this._jumpBufferTimer = 0;
  this._coyoteTimer = 0;
  this._jumpCutPending = true;
  this.setState(PlayerStateId.JUMP);
}
```

Consequências diretas:

- Trocar a altura do pulo = mudar `PHYSICS.jumpVelocity` em `config.ts`.
- Adicionar pulo duplo = novo estado, sem mexer no input.
- **Trocar o teclado pelo ESP32 = zero mudanças neste arquivo.**

Testes que travam esse comportamento:

```js
it('jumps only when grounded', ...);
it('ignores a jump request while airborne (no double jump in v1)', ...);
it('allows a jump during coyote time after stepping off a ledge', ...);
it('buffers a jump pressed shortly before landing', ...);
```

E um teste de arquitetura garante que **ninguém** aplica o impulso em outro lugar:

```js
it('the jump impulse is applied only by the player controller', () => {
  const allowed = ['config.ts', 'player-controller.ts'];
  // falha se jumpVelocity aparecer em qualquer outro arquivo
});
```

---

## 7. Como plugar o ESP32 no futuro (o caminho exato)

O ESP32 **não** precisa saber nada sobre o jogo. Ele só precisa entregar as mesmas ações.
O roteiro, quando chegar a hora:

### 7.1. Definir o protocolo

O firmware envia uma mensagem curta por **Web Serial** ou **BLE** dizendo qual botão está
pressionado. Exemplo de mensagem:

```json
{ "button": "jump", "pressed": true }
```

Nada de física, nada de estado do jogo: apenas "botão X foi apertado/solto".

### 7.2. Escrever o adaptador

Um único arquivo novo, `src/input/esp32-adapter.ts`, implementando o mesmo contrato:

```js
import { InputAdapter } from './input-adapter.js';
import { Actions } from './actions.js';

/** Traduz botões do ESP32 para ações semânticas. */
const BUTTON_TO_ACTION = {
  left: Actions.MOVE_LEFT,
  right: Actions.MOVE_RIGHT,
  jump: Actions.JUMP,
  pause: Actions.PAUSE,
};

export class Esp32Adapter extends InputAdapter {
  constructor(onAction, { transport }) {
    super(onAction);
    this._transport = transport;   // Web Serial, Web Bluetooth, WebSocket…
  }

  attach() {
    this._transport.onMessage((message) => this._handle(message));
    this._transport.connect();
  }

  detach() {
    this._transport.disconnect();
  }

  _handle({ button, pressed }) {
    const action = BUTTON_TO_ACTION[button];
    if (!action) return;
    this.onAction(action, { pressed, repeated: false });
  }
}
```

### 7.3. Trocar o adaptador na montagem

Uma linha em `src/main.ts`:

```js
// input.setAdapter(new KeyboardAdapter(input.handleAction));
input.setAdapter(new Esp32Adapter(input.handleAction, { transport }));
```

### 7.4. O que **não** precisa mudar

| Arquivo | Precisa mudar? |
|---|---|
| `game-scene.ts` (gameplay) | **Não** |
| `player-controller.ts` (regra do pulo) | **Não** |
| `physics-engine.ts` | **Não** |
| `level-manager.ts`, `lives-manager.ts` | **Não** |
| `render/*`, `ui/*` | **Não** |
| Testes de gameplay | **Não** (usam um adaptador falso) |

Isso é o princípio **Aberto/Fechado** na prática: o sistema está **aberto** para uma nova
fonte de entrada e **fechado** para modificação do que já funciona.

### 7.5. Teclado e ESP32 (ou toque) ao mesmo tempo

`InputManager` aceita um adaptador por vez, mas isso não é uma limitação: o projeto já
tem um adaptador composto real, `src/input/composite-adapter.ts`, que encaminha vários
transportes para o mesmo `handleAction`. É exatamente esse mecanismo que hoje faz
teclado e toque funcionarem juntos (seção 8) e que receberia o ESP32 do mesmo jeito:

```ts
// src/input/composite-adapter.ts (simplificado)
export class CompositeAdapter extends InputAdapter {
  constructor(onAction: OnAction, adapters: InputAdapter[]) {
    super(onAction);
    this._adapters = adapters;
  }
  attach() { this._adapters.forEach((a) => a.attach()); }
  detach() { this._adapters.forEach((a) => a.detach()); }
}
```

```ts
// src/main.ts
input.setAdapter(
  new CompositeAdapter(input.handleAction, [
    new KeyboardAdapter(input.handleAction),
    new TouchAdapter(input.handleAction, { buttons: touchControls.buttons }),
    // new Esp32Adapter(input.handleAction, { transport }),  <- amanhã
  ]),
);
```

Esse é o tipo de extensão que a arquitetura permite **sem** alterar o núcleo.

---

## 8. Um segundo adaptador já em produção: o toque

O `TouchAdapter` (`src/input/touch-adapter.ts`) é a prova de que a abstração funciona:
foi adicionado **sem tocar** em `gameplay/`, `physics/` ou `game-scene.ts`. Ele segue a
mesma regra do teclado — zero lógica de jogo — só que traduz botões virtuais em vez de
teclas:

```ts
// src/input/touch-adapter.ts (resumido)
private _handleDown(event: PointerEvent, action: string): void {
  event.preventDefault();                 // sem scroll/seleção de texto no toque
  target?.setPointerCapture?.(event.pointerId);
  this.onAction(action, { pressed: true, repeated: false });
}

private _handleUp(event: PointerEvent, action: string): void {
  event.preventDefault();
  this.onAction(action, { pressed: false, repeated: false });
}
```

Pontos que valem a pena notar:

- Usa **Pointer Events** (`pointerdown`/`pointerup`/`pointercancel`/`pointerleave`), não
  Touch Events — assim os mesmos botões também respondem a mouse e caneta, e o adaptador
  fica testável sem simular um toque de verdade.
- `pointerleave` solta o botão se o dedo arrastar para fora antes de soltar — sem isso, a
  ação ficaria "presa" como se o botão continuasse pressionado.
- Os botões (`src/ui/touch-controls.ts`) são elementos DOM comuns; `main.ts` só passa uma
  lista `{ element, action }` para o adaptador — ele não sabe (nem precisa saber) como os
  botões foram desenhados.
- A detecção de dispositivo (`matchMedia('(pointer: coarse)')`, em `main.ts`) decide
  **apenas** se os botões aparecem na tela — o `TouchAdapter` continua registrado mesmo
  em desktop, então plugar um mouse/caneta num tablet nunca quebra nada.

Nenhum destes arquivos mudou para o toque existir: `player-controller.ts`,
`physics-engine.ts`, `level-manager.ts`, `lives-manager.ts`, `render/*` — a mesma lista
que a seção 7.4 promete para o ESP32.

Detalhes de UX (posição dos botões, orientação paisagem, PWA) estão em
[11 — Mobile, PWA e deploy](11-mobile-pwa-e-deploy.md).

---

## 9. Como testar sem hardware

Os testes de gameplay nunca simulam teclado nem toque. Eles usam um adaptador falso
(`FakeAdapter`, em `src/input/input-manager.test.js`) que dispara ações diretamente:

```ts
const input = new InputManager();
const adapter = new FakeAdapter(input.handleAction);
input.setAdapter(adapter);

adapter.press(Actions.JUMP, { pressed: true });
expect(input.consumePressed(Actions.JUMP)).toBe(true);
```

Existe **um** teste que usa teclado de verdade, para provar que a ponte funciona de ponta
a ponta (`src/integration.test.js`, em jsdom):

```js
press('Space');                       // KeyboardEvent real
tick(game, 2);
expect(scene.player.body.vy).toBeLessThan(0);   // o pulo aconteceu
```

O `TouchAdapter` e o `CompositeAdapter` têm sua própria suíte
(`src/input/touch-adapter.test.js`, `src/input/composite-adapter.test.js`), também sem
simular toques reais — só Pointer Events despachados em jsdom.

Ou seja: a regra é testada **sem** DOM; a ponte é testada **com** DOM. Cada coisa no seu
lugar.

---

## 10. Checklist de revisão de código

Antes de aprovar qualquer mudança na camada de entrada, confirme:

- [ ] Nenhum arquivo fora de `src/input/` usa `event.code`, `event.repeat` ou
      `addEventListener('keydown'/'keyup')`.
- [ ] Nenhum adaptador importa de `gameplay/`, `physics/`, `scenes/` ou `render/`.
- [ ] Nenhuma regra de jogo (chão, vidas, colisão) aparece em um handler de tecla ou de toque.
- [ ] `jumpVelocity` continua aparecendo apenas em `config.ts` e `player-controller.ts`.
- [ ] `npm test` passa — em especial `src/architecture.test.js`.

Os quatro primeiros itens **são verificados automaticamente** pela suíte de testes.
