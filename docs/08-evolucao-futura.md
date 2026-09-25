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
// 1. player-state.ts — acrescente o id
export const PlayerStateId = Object.freeze({
  IDLE: 'idle', WALK: 'walk', JUMP: 'jump', FALL: 'fall',
  DOUBLE_JUMP: 'doubleJump',        // novo
});

// 2. states/double-jump-state.ts — uma classe pequena, igual a JumpState
export class DoubleJumpState extends PlayerState {
  get id() { return PlayerStateId.DOUBLE_JUMP; }
  update(_dt) {
    this.player.applyAirMovement();
    if (this.player.body.vy >= 0) this.player.setState(PlayerStateId.FALL);
  }
}

// 3. player-controller.ts — registre o estado e permita o segundo pulo
this._states.set(PlayerStateId.DOUBLE_JUMP, new DoubleJumpState(this));

_jump() {
  if (this.body.grounded || this._coyoteTimer > 0) { this._performJump(); return; }
  if (this._airJumpsLeft > 0) { this._airJumpsLeft -= 1; this._performJump(/* ... */); }
}
```

**O que NÃO muda:** `keyboard-adapter.ts`, `touch-adapter.ts`, `input-manager.ts`,
`actions.ts`, `game-scene.ts`, `physics-engine.ts`, a UI e todos os testes existentes. A ação
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

## 3. Som e narração por voz — infraestrutura e síntese implementadas ✅

O jogo já conta com `AudioManager` (`src/audio/audio-manager.ts`) e `SpeechNarrator`
(`src/audio/speech-narrator.ts`):

- **Volumes por categoria**: controle independente de volume geral, música, efeitos sonoros (SFX) e voz/narração, com persistência em `audio-settings-store.ts`.
- **Efeitos de áudio procedural**: Web Audio API sintetiza tons de pulo, acerto, erro e comemoração sem exigir o carregamento prévio de arquivos pesados.
- **Síntese de voz com palavras de referência**: `SpeechNarrator` lê as instruções com apoio fonético (“A de amigo”) via `letter-reference-words.json`.

**Próxima evolução planejada:**
Substituir o sintetizador do navegador (`speechSynthesis`) por um pacote de áudios
gravados em estúdio com atores e crianças, garantindo consistência sonora impecável em
qualquer modelo de smartphone nas lojas de aplicativos (ver [14](14-plano-app-android-capacitor.md)).

---

## 4. Controles por toque e celular — já implementados ✅

- **Toque**: `src/input/touch-adapter.ts` traduz Pointer Events de botões virtuais em ações semânticas.
- **Controle por celular**: `src/input/phone-adapter.ts` recebe ações de pulo disparadas pelo acelerômetro de um Android acoplado à criança e encaminhadas via WebSocket pelo servidor de sinalização (`signaling/`).
- **Composição**: `src/input/composite-adapter.ts` combina teclado, toque e celular simultaneamente.
- **Corrida automática**: `src/input/auto-run-adapter.ts` conduz o personagem automaticamente para a frente no modo celular.

Nenhum arquivo de física, colisão ou gameplay precisou ser alterado para suportar essas fontes.

---

## 5. ESP32

Detalhado em [03 — Abstração de input](03-abstracao-de-input.md#7-como-plugar-o-esp32-no-futuro-o-caminho-exato).
Resumo do impacto:

| Camada | Muda? |
|---|---|
| `input/` | **Sim** — um arquivo novo (`esp32-adapter.ts`) |
| `main.ts` | **Sim** — uma linha no `CompositeAdapter` (o mesmo mecanismo que já liga teclado e toque) |
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

O `level-loader.ts` valida esquema e geometria; o `physics-engine` só conhece retângulos
sólidos e plataformas de mão única. Extensões naturais:

| Extensão | Onde |
|---|---|
| Plataformas móveis | Novo campo no schema + atualização na `GameScene` e no `PhysicsEngine` |
| Blocos que somem | Novo campo + reação a evento |
| Itens que se movem | `LevelManager` atualiza posição antes da checagem |
| Fundos em parallax | `render/sprites.ts` usa `camera.x` com fatores diferentes |

Como a física recebe uma **lista de retângulos**, uma plataforma móvel é apenas um
retângulo cuja posição muda por quadro — o núcleo da colisão continua o mesmo.

---

## 8. Acessibilidade — recursos entregues ✅ e próximos passos 💡

Grande parte do plano de acessibilidade já foi implementada na Fase 11:

| Recurso | Estado | Onde vive |
|---|---|---|
| Narração por voz do objetivo e palavras | ✅ Entregue | `src/audio/speech-narrator.ts` e `letter-reference.ts` |
| Níveis de apoio (*assistido*, *padrão*, *desafio*) | ✅ Entregue | `src/gameplay/support-policy.ts` |
| Alto contraste e modo noturno | ✅ Entregue | `src/persistence/experience-settings-store.ts` e CSS |
| Escala de fonte e texto ampliado no Canvas/HUD | ✅ Entregue | `src/render/hud.ts` e classes DOM |
| Redução de movimento (sem tremor/flashes) | ✅ Entregue | `effects.ts`, `sprites.ts` e CSS |
| Leitores de tela (ARIA Live Announcer) | ✅ Entregue | `src/ui/live-announcer.ts` |
| Teclas totalmente remapeáveis | 💡 Futuro | `src/input/keyboard-keymap.ts` (API pronta, falta UI) |
| Navegação espacial completa em tela para leitor de tela | 💡 Futuro | Interação tátil/espacial no Canvas para deficientes visuais severos |

Todas essas melhorias respeitaram a regra de não alterar regras físicas nem colisão do jogo.

---

## 9. Relatório para pais e professores

O `progress-store` já guarda `stats: { correct, wrong }` por perfil e o melhor resultado por
lição. Acrescentar, por exemplo, "quais unidades a criança mais erra" é ler esses dados e
agrupar por `unitId` — não exige mudar nenhuma regra de jogo.

---

## 10. Como decidir se uma extensão "cabe" na arquitetura

Antes de implementar algo novo, faça três perguntas:

1. **Isso é dado ou regra?** Se for dado (letras, fases, cores, dificuldade), vai para
   `config.ts` ou JSON — sem código.
2. **Isso é uma nova *fonte* de entrada?** Então é um `InputAdapter` novo.
3. **Isso é um novo *comportamento* do personagem?** Então é um `PlayerState` novo.

Se a resposta não estiver em nenhuma dessas, provavelmente é uma responsabilidade nova e
merece um módulo próprio — com uma única razão para existir.
