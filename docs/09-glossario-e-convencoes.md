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
| **Ação semântica** | Intenção abstrata do jogador (`jump`), não uma tecla ou um toque |
| **Adaptador de entrada** | Traduz hardware em ações semânticas (`KeyboardAdapter`, `TouchAdapter`) |
| **Adaptador composto** | `CompositeAdapter`: liga vários adaptadores ao mesmo tempo (hoje teclado + toque) |
| **AABB** | *Axis-Aligned Bounding Box*: caixa retangular alinhada aos eixos |
| **Alvo de colisão / corpo** | Retângulo `{x, y, w, h}` que participa da física |
| **Acumulador** | Técnica do laço de jogo para steps de duração fixa |
| **Composition root** | O único lugar que monta as peças (`src/main.ts`) |
| **EventBus** | Publicador/assinante que desacopla quem anuncia de quem reage |
| **Hitbox** | Área de colisão, visualizável com `F2` |
| **Composição root** | ver *Composition root* |
| **Overlay / sobreposição** | Tela de menu em DOM sobre o canvas (React em `ui/screens/*.tsx`, orquestrada sem React por `ui/menu.ts`) |
| **Plataforma de mão única** | Sólida apenas quando se cai de cima |
| **Template de terreno** | Molde de mapa reaproveitado por várias fases |
| **Timestep fixo** | Simulação sempre em fatias de 1/60 s |
| **Checkpoint** | Onde o jogador reaparece depois de cair |
| **Slug** | Texto simplificado para usar em id/nome de arquivo (`PÉ` → `pe`) |
| **Perfil** | Jogador cadastrado, com progresso próprio |
| **PWA** | *Progressive Web App*: o jogo é instalável e funciona offline (ver [11](11-mobile-pwa-e-deploy.md)) |
| **Service worker** | Script do navegador que faz o cache offline do PWA (gerado pelo `vite-plugin-pwa`/Workbox) |

---

## 4. Convenções de nomes

| Tipo | Convenção | Exemplo |
|---|---|---|
| Arquivo de módulo do motor | `kebab-case.ts` | `player-controller.ts` |
| Componente de tela React | `kebab-case.tsx` em `ui/screens/` | `main-menu.tsx` |
| Arquivo de teste | mesmo nome + `.test.js` | `player-controller.test.js` |
| Classe | `PascalCase` | `PlayerController` |
| Função / variável | `camelCase` | `applyGravity()` |
| Constante de configuração | `SCREAMING_SNAKE_CASE` | `FIXED_STEP` |
| Enum / mapa de opções | `PascalCase` + `Object.freeze` | `Actions`, `PlayerStateId` |
| Membro privado | prefixo `_` | `this._jumpBufferTimer` |
| Módulo puro / utilitário | `kebab-case.ts` sem classe | `text-utils.ts` |
| Fase gerada | `fase-<unidade>-<alvo>.json` | `fase-alfabeto-a.json` |
| Id de lição | `<unidade>-<slug>` | `palavras-dissilabas-bola` |
| Chave de armazenamento | `<prefixo>.v<versão>` | `joguinho.sobrinhos.v1` |

**Imports internos usam extensão `.js`, mesmo em arquivos `.ts`** (ex.:
`import { Actions } from './actions.js';` dentro de `actions.ts`): é a convenção do
`moduleResolution: "bundler"` do TypeScript, não um erro — o arquivo real é `.ts`/`.tsx`,
só a especificação do import aponta para `.js`.

**Idioma nos nomes:** sempre inglês. Exceção deliberada: os **dados** carregam português
porque são conteúdo (`"name": "Planície — A"`, `title: "Família do B"`).

---

## 5. Regras de código

### Obrigatórias

1. **Nenhuma lógica de jogo em listener de tecla.** Ver [03](03-abstracao-de-input.md).
2. **`event.code` só em `src/input/`.** Nada fora da camada de entrada conhece teclas.
3. **O impulso de pulo só existe em `config.ts` e `player-controller.ts`.**
4. **Números de balanceamento só em `config.ts`.**
5. **Conteúdo só em JSON** (`curriculum.json`, `levels/*.json`, `characters.ts`).
6. **Nada de `innerHTML`.** Sempre `textContent` via `ui/dom.ts`.
7. **Dependências injetadas.** Só `main.ts` escolhe implementações concretas.
8. **`npm test`, `npm run typecheck` e `npm run build` antes de commitar.**

### Recomendadas

- Prefira funções **puras** quando não houver estado envolvido.
- Use `Object.freeze` em enums e configurações.
- Comente **por quê**, não **o quê**. O código já diz o quê.
- Mensagens de erro devem dizer **qual campo** falhou, não só que falhou.
- Estados do jogador com poucas linhas: a complexidade vai para o controlador.

### Proibidas

- Lógica de jogo em handler de evento de DOM.
- Números mágicos espalhados (`620`, `1500`, `3`) fora de `config.ts`.
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
| Cenários, itens, objetos, terreno e `manifest.json` (`public/assets/`) | **MIT**, de [Aventura das Letras](https://github.com/samarameneses/aventura-das-letras). Ver `THIRD_PARTY_NOTICES.md` |
| Personagens e retratos (`public/assets/characters/`, `portraits/`) | **Proprietária, não distribuível fora do projeto.** Ver detalhes abaixo |
| Fonte Silkscreen (`public/fonts/`) | SIL Open Font License 1.1 (texto em `public/fonts/OFL.txt`) |

> **Regra:** nenhum arquivo em `imgs_referencia/` pode ser empacotado no build — isso é
> verificado manualmente a cada revisão de `vite.config.js`/`public/`.

### Arte de produção (personagens, cenários, itens)

A arte que está hoje em `public/assets/` (personagens, cenários, itens e objetos, pixel
art) foi **gerada por IA** (ferramenta de geração de imagem) a partir de **referências
fotográficas privadas de crianças da família**, para preservar a semelhança dos quatro
personagens. A proveniência de cada arquivo está registrada em
`public/assets/manifest.json` (`source: "private generation source (not distributed)"`).

Consequências práticas:

- **Não é CC0 nem de terceiros licenciados.** É proprietária do projeto.
- **Não deve ser redistribuída, reaproveitada ou publicada fora deste projeto** — as
  imagens de origem são fotos privadas de crianças reais.
- `public/assets/manifest.json` **não deve ser tratado como documentação pública**: é um
  log operacional de geração, mantido versionado só para rastreabilidade interna.
- Se o projeto algum dia for aberto/publicado, a arte de produção precisa ser revisada
  separadamente (trocar por arte original sem referência de identidade, ou manter privada).

| Personagem | Pasta em `public/assets/characters/` |
|---|---|
| João Miguel | `joao_miguel/` |
| Luna | `luna/` |
| Lucas (engenheiro) | `lucas_engenheiro/` |
| Samara | `samara/` |

(Os nomes dos personagens jogáveis são diferentes do nome do jogo — "Nicolas & Eloá" é a
marca do jogo, não um dos quatro personagens.)

---

## 8. Glossário de arquivos (referência rápida)

| Arquivo | Em uma frase |
|---|---|
| `main.ts` | Monta tudo e inicia o laço |
| `core/config.ts` | Todos os números do jogo |
| `core/game-loop.ts` | Timestep fixo |
| `core/event-bus.ts` | Comunicação por eventos |
| `input/actions.ts` | O que o jogador pode querer fazer |
| `input/keyboard-keymap.ts` | Qual tecla corresponde a qual ação |
| `input/keyboard-adapter.ts` | Lê o teclado e repassa ações |
| `input/touch-adapter.ts` | Lê os botões de toque e repassa ações |
| `input/composite-adapter.ts` | Liga vários adaptadores ao mesmo tempo (hoje: teclado + toque) |
| `input/input-manager.ts` | Guarda "segurado" e "apertou uma vez" |
| `gameplay/player/player-controller.ts` | **Onde a regra do pulo vive** |
| `physics/physics-engine.ts` | Gravidade e colisão |
| `gameplay/level-manager.ts` | Itens, perigos e queda |
| `gameplay/lives-manager.ts` | Corações |
| `content/answer-validator.ts` | Acertou ou errou |
| `content/curriculum.json` | O conteúdo pedagógico |
| `content/levels/*.json` | As fases |
| `render/sprites.ts` | Desenho do mundo com a arte de produção |
| `render/hud.ts` | Corações, objetivo e mensagens |
| `ui/menu.ts` | Orquestra qual tela React está montada |
| `ui/screens/*.tsx` | As telas de menu em si (React) |
| `ui/touch-controls.ts` | D-pad e botão de pulo em tela |
| `persistence/progress-store.ts` | Progresso por jogador |
| `scenes/game-scene.ts` | Orquestra uma lição |
| `vite.config.js` | Build, dev server e configuração do PWA (`vite-plugin-pwa`) |
| `Dockerfile` / `docker-compose.yml` / `docker/` | Build e deploy em produção — ver [11](11-mobile-pwa-e-deploy.md) |
