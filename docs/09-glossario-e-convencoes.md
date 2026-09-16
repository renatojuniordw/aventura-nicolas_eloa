# 09 — Glossário e convenções

Vocabulário do projeto (pedagógico e técnico), convenções de nomes e regras de código.
Serve para que qualquer pessoa — inclusive quem for ajudar no futuro — fale a mesma língua.

---

## 1. Idioma: três camadas

| Onde | Idioma | Exemplo |
|---|---|---|
| Identificadores, nomes de arquivos, comentários de código | **Inglês** | `playerController.jump()`, `// Applies gravity` |
| Documentação (`docs/`, README) | **Português** | Este arquivo |
| Texto visível no jogo | **Português** | `"Colete a letra A"`, `"Muito bem!"` |

**Motivo:** código em inglês é padrão técnico, facilitando busca e reuso; o jogo precisa
estar em português porque o público é uma criança brasileira em alfabetização.

---

## 2. Glossário pedagógico

| Termo | Significado | Exemplo | No jogo |
|---|---|---|---|
| **Letra** | Símbolo do alfabeto | A, B, C | Unidade "Alfabeto" |
| **Sílaba** | Unidade sonora com uma vogal | BA, BE, BI | Unidades "Família do B" etc. |
| **Família silábica** | Consoante + cada vogal | BA BE BI BO BU | Uma unidade por consoante |
| **Dígrafo** | Duas letras com um só som | CH, LH, NH | Unidade "Dígrafos" |
| **Encontro consonantal** | Consoantes seguidas, cada uma com seu som | BR, CR, PL | Unidade "Encontros Consonantais" |
| **Palavra monossílaba** | Uma sílaba | SOL, MAR, PÉ | Unidade "Palavras de Uma Sílaba" |
| **Palavra dissílaba** | Duas sílabas | BO-LA, CA-SA | Unidade "Palavras de Duas Sílabas" |
| **Alvo** (*target*) | A resposta certa da lição | "A" | Item `type: "target"` |
| **Distrator** | Opção errada, do mesmo tipo do alvo | "E" para a lição do "A" | Item `type: "distractor"` |
| **Lição** | Uma rodada com um alvo | "Colete BA" | Deriva de `unit × pool` |
| **Unidade** | Agrupamento didático de lições | "Família do B" | Entrada em `curriculum.json` |

---

## 3. Glossário técnico

| Termo | Significado neste projeto |
|---|---|
| **Ação semântica** | Intenção abstrata do jogador (`jump`), não uma tecla |
| **Adaptador de entrada** | Traduz hardware em ações semânticas (`KeyboardAdapter`) |
| **AABB** | *Axis-Aligned Bounding Box*: caixa retangular alinhada aos eixos |
| **Alvo de colisão / corpo** | Retângulo `{x, y, w, h}` que participa da física |
| **Acumulador** | Técnica do laço de jogo para steps de duração fixa |
| **Composition root** | O único lugar que monta as peças (`src/main.js`) |
| **EventBus** | Publicador/assinante que desacopla quem anuncia de quem reage |
| **Hitbox** | Área de colisão, visualizável com `F2` |
| **Composição root** | ver *Composition root* |
| **Overlay / sobreposição** | Tela de menu em DOM sobre o canvas |
| **Plataforma de mão única** | Sólida apenas quando se cai de cima |
| **Template de terreno** | Molde de mapa reaproveitado por várias fases |
| **Timestep fixo** | Simulação sempre em fatias de 1/60 s |
| **Checkpoint** | Onde o jogador reaparece depois de cair |
| **Slug** | Texto simplificado para usar em id/nome de arquivo (`PÉ` → `pe`) |
| **Perfil** | Jogador cadastrado, com progresso próprio |

---

## 4. Convenções de nomes

| Tipo | Convenção | Exemplo |
|---|---|---|
| Arquivo de módulo | `kebab-case.js` | `player-controller.js` |
| Arquivo de teste | mesmo nome + `.test.js` | `player-controller.test.js` |
| Classe | `PascalCase` | `PlayerController` |
| Função / variável | `camelCase` | `applyGravity()` |
| Constante de configuração | `SCREAMING_SNAKE_CASE` | `FIXED_STEP` |
| Enum / mapa de opções | `PascalCase` + `Object.freeze` | `Actions`, `PlayerStateId` |
| Membro privado | prefixo `_` | `this._jumpBufferTimer` |
| Módulo puro / utilitário | `kebab-case.js` sem classe | `text-utils.js` |
| Fase gerada | `fase-<unidade>-<alvo>.json` | `fase-alfabeto-a.json` |
| Id de lição | `<unidade>-<slug>` | `palavras-dissilabas-bola` |
| Chave de armazenamento | `<prefixo>.v<versão>` | `joguinho.sobrinhos.v1` |

**Idioma nos nomes:** sempre inglês. Exceção deliberada: os **dados** carregam português
porque são conteúdo (`"name": "Planície — A"`, `title: "Família do B"`).

---

## 5. Regras de código

### Obrigatórias

1. **Nenhuma lógica de jogo em listener de tecla.** Ver [03](03-abstracao-de-input.md).
2. **`event.code` só em `src/input/`.** Nada fora da camada de entrada conhece teclas.
3. **O impulso de pulo só existe em `config.js` e `player-controller.js`.**
4. **Números de balanceamento só em `config.js`.**
5. **Conteúdo só em JSON** (`curriculum.json`, `levels/*.json`, `characters.js`).
6. **Nada de `innerHTML`.** Sempre `textContent` via `ui/dom.js`.
7. **Dependências injetadas.** Só `main.js` escolhe implementações concretas.
8. **`npm test` e `npm run build` antes de commitar.**

### Recomendadas

- Prefira funções **puras** quando não houver estado envolvido.
- Use `Object.freeze` em enums e configurações.
- Comente **por quê**, não **o quê**. O código já diz o quê.
- Mensagens de erro devem dizer **qual campo** falhou, não só que falhou.
- Estados do jogador com poucas linhas: a complexidade vai para o controlador.

### Proibidas

- Lógica de jogo em handler de evento de DOM.
- Números mágicos espalhados (`620`, `1500`, `3`) fora de `config.js`.
- Importar `gameplay/` a partir de `input/`.
- Acoplar a `GameScene` a HUD, efeitos ou armazenamento (use eventos).
- Arte de terceiros sem licença — ver seção 7.

---

## 6. Comentários no código

Os comentários explicam **decisões**, não sintaxe:

```js
// ✅ Bom: explica a intenção e o motivo
// Exclude anything that normalises to the answer: VOVÔ and VOVÓ are the same
// word for the answer rule, so one must never appear as a distractor.

// ❌ Ruim: repete o código
// increments i by one
i += 1;
```

Comentários em inglês (é código). Documentação em português.

---

## 7. Licenças e procedência de arte

| Item | Situação |
|---|---|
| Código do projeto | Próprio do projeto |
| `imgs_referencia/mario_graphics1.png` | **Referência apenas.** É arte estilo Mario (IP da Nintendo). **Não distribuir.** Usada só para medir proporções |
| Arte de produção (fase 5) | Deve ser **original ou CC0**, com a licença registrada aqui |

> **Regra:** nenhum arquivo em `imgs_referencia/` pode ser empacotado no build. O jogo
> atual desenha formas geométricas; a troca por arte real está descrita em
> [07 — Fase 5](07-plano-de-desenvolvimento-fases.md#fase-5--polimento-e-arte-).

Ao adicionar arte na fase 5, preencha aqui:

| Arquivo | Autor | Licença | Fonte |
|---|---|---|---|
| *(a preencher)* | | | |

---

## 8. Glossário de arquivos (referência rápida)

| Arquivo | Em uma frase |
|---|---|
| `main.js` | Monta tudo e inicia o laço |
| `core/config.js` | Todos os números do jogo |
| `core/game-loop.js` | Timestep fixo |
| `core/event-bus.js` | Comunicação por eventos |
| `input/actions.js` | O que o jogador pode querer fazer |
| `input/keyboard-keymap.js` | Qual tecla corresponde a qual ação |
| `input/keyboard-adapter.js` | Lê o teclado e repassa ações |
| `input/input-manager.js` | Guarda "segurado" e "apertou uma vez" |
| `gameplay/player/player-controller.js` | **Onde a regra do pulo vive** |
| `physics/physics-engine.js` | Gravidade e colisão |
| `gameplay/level-manager.js` | Itens, perigos e queda |
| `gameplay/lives-manager.js` | Corações |
| `content/answer-validator.js` | Acertou ou errou |
| `content/curriculum.json` | O conteúdo pedagógico |
| `content/levels/*.json` | As fases |
| `render/sprites.js` | Desenho do mundo |
| `render/hud.js` | Corações, objetivo e mensagens |
| `ui/menu.js` | Todas as telas de menu |
| `persistence/progress-store.js` | Progresso por jogador |
| `scenes/game-scene.js` | Orquestra uma lição |
