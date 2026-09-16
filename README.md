# Aventura do Nicolas&Eloá

Jogo de plataforma 2D educativo, em português, para crianças em alfabetização.
O jogador corre e pula para coletar **a letra, sílaba ou palavra pedida**.

Feito em **JavaScript puro com Canvas 2D** — sem framework de jogo, sem dependências de
execução. Toda a arquitetura é visível e a **entrada é abstraída desde o início**, de modo
que um **ESP32** possa ser plugado no futuro sem alterar a lógica do jogo.

---

## Como rodar

Requisitos: **Node.js 20 ou superior**.

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (por padrão `http://localhost:5173`).

### Outros comandos

| Comando                   | O que faz                                          |
| ------------------------- | -------------------------------------------------- |
| `npm run dev`             | Servidor de desenvolvimento com recarga automática |
| `npm test`                | Roda os 171 testes                                 |
| `npm run test:watch`      | Testes em modo observador                          |
| `npm run build`           | Gera a versão de produção em `dist/`               |
| `npm run preview`         | Serve a versão de produção localmente              |
| `npm run generate:levels` | Regenera as fases a partir do currículo            |

---

## Como jogar

| Ação              | Teclas                    |
| ----------------- | ------------------------- |
| Andar             | `←` `→` ou `A` `D`        |
| Pular             | `Espaço`, `↑`, `W` ou `Z` |
| Pausar            | `Esc` ou `P`              |
| Confirmar (menus) | `Enter`                   |
| Voltar (menus)    | `Backspace`               |
| Mostrar hitboxes  | `F2`                      |

- Colete o item indicado **no topo da tela**.
- **Acertar** comemora e conclui a fase. **Errar** custa um coração (são 3).
- **Cair em um buraco não custa coração** — o personagem volta para o mesmo lugar.
- Segurar o pulo faz o personagem subir mais; soltar cedo encurta o pulo.

---

## Conteúdo

**16 unidades** e **152 lições**, cobrindo alfabeto, famílias silábicas, dígrafos,
encontros consonantais e palavras de uma e duas sílabas. O progresso é salvo por jogador
no próprio navegador, com estrelas por precisão.

Todo o conteúdo é **dado**: acrescentar palavras é editar
`src/content/curriculum.json` e rodar `npm run generate:levels` — sem mexer em código.

---

## Documentação

Toda a documentação está em [`docs/`](docs/README.md), em português:

| Documento                                                         | Assunto                                                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [01 — Arquitetura](docs/01-arquitetura.md)                        | Camadas, fluxo de dados, laço de jogo, cenas                               |
| [02 — Gameplay e controles](docs/02-gameplay-e-controles.md)      | Regras, vidas, movimento, progressão                                       |
| [03 — Abstração de input](docs/03-abstracao-de-input.md)          | **Documento central**: teclado sem lógica de jogo e o caminho para o ESP32 |
| [04 — Modelo de conteúdo](docs/04-modelo-de-conteudo.md)          | Schemas de currículo, fases e save                                         |
| [05 — SOLID e padrões](docs/05-solid-e-padroes-de-projeto.md)     | Onde cada princípio vive no código                                         |
| [06 — Estratégia de testes](docs/06-estrategia-de-testes.md)      | O que é testado, como e checklist de QA                                    |
| [07 — Plano por fases](docs/07-plano-de-desenvolvimento-fases.md) | Roadmap e critérios de aceite                                              |
| [08 — Evolução futura](docs/08-evolucao-futura.md)                | Pulo duplo, poderes, som, toque, ESP32                                     |
| [09 — Glossário e convenções](docs/09-glossario-e-convencoes.md)  | Termos, nomes e regras de código                                           |

---

## Princípios do projeto

1. **Código em inglês, documentação e jogo em português.**
2. **SOLID**, com ênfase em Aberto/Fechado: conteúdo, balanceamento e fases são **dados**.
3. **Input abstraído desde o primeiro commit:** o listener de teclado só traduz teclas em
   ações semânticas. A regra do pulo vive **exclusivamente** em
   `src/gameplay/player/player-controller.js` — nunca dentro de um evento de tecla. Isso é
   garantido por testes automáticos que falham se alguém violar a regra.
4. **Sem frameworks de jogo:** apenas Canvas 2D e ES Modules, para manter a arquitetura
   clara e didática.

```js
// src/scenes/game-scene.js — a única ponte entre entrada e gameplay
if (this.game.input.consumePressed(Actions.JUMP)) this.player.jump();

// src/gameplay/player/player-controller.js — onde a decisão realmente acontece
_tryBufferedJump() {
  const canJump = this.body.grounded || this._coyoteTimer > 0;
  if (this._jumpBufferTimer > 0 && canJump) this._performJump();
}
```

---

## Estrutura

```
src/
├── core/         laço de jogo, eventos, cenas, configuração
├── input/        ações semânticas, adaptador de teclado, gerenciador
├── physics/      colisão AABB e motor de movimento
├── gameplay/     controlador do jogador, estados, vidas, fase
├── render/       canvas, câmera, sprites, HUD, efeitos
├── content/      currículo, fases, validação de resposta
├── persistence/  perfis e progresso no localStorage
├── ui/           telas de menu em DOM
└── scenes/       boot, menu, game, victory

docs/             documentação completa em português
tools/            gerador de fases
imgs_referencia/  sprite sheet apenas para referência de medidas
```

---

## Créditos e licenças

Código do projeto. A imagem em `imgs_referencia/` é **apenas referência de proporções** e
**não deve ser distribuída** (arte de terceiros). A arte de produção está prevista para a
fase 5 do plano e deve ser original ou CC0 — ver
[09 — Glossário e convenções](docs/09-glossario-e-convencoes.md#7-licenças-e-procedência-de-arte).
