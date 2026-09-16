# 05 — SOLID e padrões de projeto

Onde cada princípio vive no código, com exemplos reais e o motivo da escolha.

---

## 1. SOLID, princípio por princípio

### S — Responsabilidade Única

Cada módulo faz **uma** coisa, e o nome diz qual é.

| Módulo | Sua única responsabilidade | O que ele **não** faz |
|---|---|---|
| `physics-engine.js` | Gravidade, movimento e colisão | Não lê input, não desenha, não sabe o que é uma letra |
| `player-controller.js` | Estado do jogador e regra do pulo | Não desenha, não lê teclado |
| `level-manager.js` | Itens, perigos e queda na fase | Não decide se o item era a resposta certa |
| `answer-validator.js` | Comparar item coletado com a resposta | Não mexe em vidas nem em efeitos |
| `lives-manager.js` | Contagem de corações | Não sabe por que o coração foi perdido |
| `canvas-renderer.js` | Falar com o Canvas 2D | Não decide o que desenhar |
| `hud-model.js` | Estado do HUD (corações, mensagens) | Não desenha nada |
| `save-store.js` | Ler/escrever o documento de save | Não conhece perfis nem progresso |
| `progress-store.js` | Progresso por perfil | Não sabe onde o dado é guardado |
| `keyboard-adapter.js` | DOM → ações semânticas | Nenhuma regra de jogo |

**Sinal de alerta usado na revisão:** se para descrever um módulo é preciso usar "e"
("ele move **e** valida **e** desenha"), ele tem responsabilidades demais.

### O — Aberto/Fechado

Aberto para extensão, fechado para modificação. Três exemplos concretos:

**1. Conteúdo novo não muda código.** Acrescentar uma lição é editar
`curriculum.json` + rodar o gerador. Nenhum arquivo `.js` é tocado.

**2. Nova fonte de input não muda gameplay.** Um adaptador ESP32 implementa o mesmo
contrato e entra com uma linha em `main.js`. Ver [03](03-abstracao-de-input.md#7-como-plugar-o-esp32-no-futuro-o-caminho-exato).

**3. Nova cena não muda o `SceneManager`.** Cenas são registradas em um mapa:

```js
scenes.register('game', GameScene);    // adicionar cena = adicionar entrada
```

O mesmo vale para a escada de migração de saves (`MIGRATIONS[versão]`) e para os templates
de terreno (`TEMPLATES[]`).

### L — Substituição de Liskov

Todo adaptador de entrada é intercambiável:

```js
class InputAdapter { attach() {}  detach() {}  dispose() {} }
class KeyboardAdapter extends InputAdapter { /* ... */ }
class Esp32Adapter extends InputAdapter { /* ... */ }   // mesmo contrato
```

O `InputManager` e os testes usam `FakeAdapter`, que também estende `InputAdapter`. Como
todos respeitam o mesmo contrato, qualquer um pode ocupar o lugar do outro sem
surpresas. O `MemoryStorageAdapter` faz o mesmo papel para o armazenamento.

### I — Segregação de Interfaces

Nenhum módulo é forçado a depender de coisas que não usa:

- O `PhysicsEngine` recebe apenas o que precisa: um **corpo** e uma **lista de retângulos
  sólidos**. Não recebe o nível inteiro, não conhece itens nem perigos.
- `AnswerValidator` recebe uma lição com `target` e `variants`. Não conhece fase, HUD ou placar.
- Um adaptador de entrada recebe **apenas** uma função de callback. Não recebe a cena, o
  jogador nem o barramento de eventos.

### D — Inversão de Dependência

Módulos de alto nível dependem de **abstrações**, e as concretas são injetadas:

| Depende de (abstração) | Implementação real | Implementação de teste |
|---|---|---|
| `StorageAdapter` | `LocalStorageAdapter` | `MemoryStorageAdapter` |
| `InputAdapter` | `KeyboardAdapter` | `FakeAdapter` |
| Carregador de imagens (`AssetManager`) | `new Image()` | função falsa |
| Fonte de tempo (`GameLoop`) | `performance.now` | contador controlado |
| Renderizador | `CanvasRenderer` | objeto que só registra chamadas |

E o `GameLoop` recebe `update` e `render` como funções — ele não sabe que existe uma cena:

```js
new GameLoop({ update: (dt) => scenes.update(dt), render: () => scenes.draw(renderer) })
```

O único lugar que escolhe implementações concretas é `src/main.js`.

---

## 2. Padrões de projeto usados (e por quê)

### Strategy — fontes de entrada

**Problema:** o jogo precisa aceitar teclado hoje e ESP32 amanhã.
**Solução:** `InputAdapter` é a estratégia; teclado e ESP32 são estratégias concretas; o
`InputManager` é o contexto que as usa sem conhecer os detalhes.

### State — estados do jogador

**Problema:** o personagem se comporta diferente parado, andando, subindo e caindo.
**Solução:** `PlayerState` e as classes `IdleState`, `WalkState`, `JumpState`, `FallState`.
Cada uma é **pequena** (poucas linhas) e decide duas coisas: o movimento horizontal e
quando trocar de estado. Adicionar pulo duplo = adicionar uma classe.

```js
// A classe inteira de "caindo":
export class FallState extends PlayerState {
  get id() { return PlayerStateId.FALL; }
  update(_dt) {
    this.player.applyAirMovement();
    if (this.player.body.grounded) {
      this.player.setState(this.player.moveIntent === 0 ? PlayerStateId.IDLE : PlayerStateId.WALK);
    }
  }
}
```

### Observer — barramento de eventos

**Problema:** ao coletar um item, várias coisas reagem (HUD, corações, confete, save) e a
cena não deveria conhecer nenhuma delas.
**Solução:** `EventBus`. A `GameScene` anuncia `item.collected`; quem se interessa se inscreve.

### Facade — `InputManager`

**Problema:** a cena não deveria saber se o input veio de teclado, sensor ou rede.
**Solução:** duas perguntas bastam — `isActionHeld` e `consumePressed`.

### Composition Root (com uma exceção consciente)

**Problema:** alguém precisa escolher as implementações concretas.
**Solução:** `src/main.js` monta o que é **global e duradouro** — barramento, renderizador,
input e adaptador, armazenamento, lojas e cenas. Os módulos que ele cria recebem tudo pronto.

**Exceção deliberada:** a `GameScene` instancia os colaboradores que pertencem a **uma
lição** e vivem apenas enquanto ela dura (`PhysicsEngine`, `LevelManager`, `LivesManager`,
`AnswerValidator`, `HudModel`, `Camera`). Faz sentido que sejam dela: recriá-los a cada
fase é mais simples e seguro do que mantê-los vivos entre lições. O que importa para o
princípio é que **nenhum desses colaboradores conhece implementações concretas** — a física
continua sendo injetada no controlador do jogador, e é isso que torna o conjunto testável
(`PlayerController` recebe um `physics` por parâmetro, não o cria).

### Data-Driven Design

**Problema:** 152 fases e centenas de palavras não podem ser código.
**Solução:** currículo e fases em JSON; o gerador monta, o `loadLevel` valida, o
`import.meta.glob` carrega.

### Template Method (leve) — `Scene`

**Problema:** todas as cenas têm o mesmo ciclo de vida.
**Solução:** `Scene` define `enter/exit/update/draw` como no-ops; cada cena sobrescreve só
o que usa.

---

## 3. Padrões deliberadamente **não** usados

Bons princípios também incluem saber o que **não** fazer.

| Padrão | Por que não |
|---|---|
| ECS (Entity-Component-System) | A complexidade não se paga com 4 tipos de entidade; estados + managers bastam e são mais legíveis |
| Framework de jogo (Phaser etc.) | Esconderia a arquitetura, que aqui é justamente o objetivo didático |
| Redux/store global de estado | O `EventBus` + managers resolvem sem indireção extra |
| Sistema genérico de "habilidades" | Especulativo: não há poderes no escopo atual. O estado `POWER_1/2` já reserva o espaço |
| Injeção de dependência por contêiner | O composition root manual é mais explícito e não precisa de biblioteca |
| Otimização prematura (spatial hashing, atlas packing) | ~40 retângulos por fase não justifica. Se crescer, os testes de performance indicam |

---

## 4. Regras de estilo do código

| Regra | Motivo |
|---|---|
| Identificadores e comentários em **inglês** | Padrão técnico e busca/reuso |
| Texto de interface e documentação em **português** | Público-alvo e requisito do projeto |
| ES Modules com `import`/`export` nomeados | Sem build extra, fácil de rastrear |
| Sem dependências de runtime | Só Canvas 2D; nada para quebrar |
| Números mágicos só em `config.js` | Balancear é mudar dados |
| `Object.freeze` em enums e configs | Impede mutação acidental |
| Erros com mensagem clara em português ou inglês descritivo | `LevelValidationError` diz **qual** campo falhou |
| Funções puras quando possível | Física, validação, migração e câmera são testáveis sem DOM |
| Nada de `innerHTML` | `dom.js` usa sempre `textContent` — sem risco de injeção de markup |

---

## 5. Resumo visual: quem depende de quem

```
                    main.js  (composition root)
                       │ monta tudo
        ┌──────────────┼───────────────────────┐
        ▼              ▼                       ▼
   SceneManager   InputManager            SaveStore
        │              │                       │
        ▼              ▼                       ▼
   Scenes ──────► PlayerController ──► PhysicsEngine     StorageAdapter
     │                 ▲                                    ▲
     │                 │ (chamadas semânticas)               │
     ▼                 │                                    │
   Render ◄── eventos ─┴─ EventBus ─► LivesManager / ProgressStore / Effects
     ▲
     └── LevelManager ──► content/*  (dados)
```

**Leitura do diagrama:** nenhuma seta aponta para fora da abstração. `PhysicsEngine` não
conhece `PlayerController`; `ProgressStore` não conhece `GameScene`; `KeyboardAdapter` não
conhece nada além de `Actions`.
