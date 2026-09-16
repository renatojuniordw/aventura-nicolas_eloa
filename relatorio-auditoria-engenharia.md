# Auditoria de Engenharia de Software — Aventura do Nicolas&Eloá

**Data:** 2026-09-16 · **Modo:** somente leitura (nenhum arquivo do repositório foi alterado; apenas este relatório foi criado) · **Idioma:** PT-BR
**Comandos executados:** `npm test` (27 arquivos, 211 testes, todos passando), `npx vite build --outDir /tmp/joguinho-dist` (sucesso, 217 módulos), `npx vitest run --coverage` (via `@vitest/coverage-v8@5.0.1` instalado em diretório temporário do npx; relatório JSON lido de `/tmp/joguinho-cov`), greps/`import.meta.glob`/leituras de arquivo citadas abaixo.
**Limiar Clean Code adotado:** função/método com mais de 40 linhas de corpo **ou** com mais de 1 responsabilidade clara.

---

## 1. Stack detectada (com evidência)

| Camada | Detecção | Evidência |
|---|---|---|
| Linguagem | JavaScript puro, ES modules (`"type": "module"`) | `package.json:5` |
| Build/bundler + dev server | Vite 8 (`vite@^8.3.0`), alvo `es2022`, `outDir dist`, sourcemap ligado, porta 65000 | `package.json:17`, `vite.config.js:1-11` |
| Testes | Vitest 5 (`vitest@^5.0.1`), ambiente `node`, inclui `src/**/*.test.js` e `tools/**/*.test.mjs`, `globals: false` | `package.json:18`, `vitest.config.js:1-11` |
| DOM em testes | `jsdom@^29.1.1` como devDependency, mas usado **apenas** via diretiva `// @vitest-environment jsdom` em 2 arquivos | `package.json:16`, `src/integration.test.js:1`, `src/ui/pixel-logo.test.js:1` |
| Render | Canvas 2D via fachada `CanvasRenderer`; menus/HUD-controles como overlays DOM | `src/render/canvas-renderer.js:11-20`, `src/ui/menu.js:21-29`, `index.html:23-31` |
| Backend | Inexistente — bundle estático servido por `nginxinc/nginx-unprivileged` | `Dockerfile:13-22`, `docker-compose.yml:1-14` |
| Dados de fase | ~152 JSON em `src/content/levels/` gerados por script, empacotados via `import.meta.glob` (eager) | `src/content/level-registry.js:8`, `tools/generate-levels.mjs:1-22` |
| CI | **Não detectada no repositório** — não há `.github/`, `.gitlab-ci.yml` ou similar (verificado via `ls -a`) | não verificável além da ausência observada |

**Regra de stack aplicada:** por ser JS puro sem framework, nenhuma regra específica de framework (hooks, tree-shaking, tipagem) foi aplicada. Regras de cobertura do Vitest/V8 se aplicam (seção 7).

---

## 2. Resumo executivo

| Categoria | Crítico | Alto | Médio | Baixo | Total |
|---|---|---|---|---|---|
| SOLID | 0 | 2 | 2 | 0 | 4 |
| DRY | 0 | 1 | 2 | 0 | 3 |
| KISS | 0 | 0 | 1 | 0 | 1 |
| YAGNI | 0 | 0 | 2 | 2 | 4 |
| Clean Code | 0 | 1 | 2 | 1 | 4 |
| Código morto confirmado | 0 | 0 | 1 | 3 | 4 |
| Dependências | 0 | 0 | 0 | 0 | 0 |
| Cobertura abaixo da meta (80% branch, lógica crítica) | 0 | 2 | 6 | — | 8 arquivos |
| **Total** | **0** | **6** | **16** | **6** | **28** |

**Leitura geral:** arquitetura bem disciplinada (composition root em `src/main.js:33-39`, invariante de abstração de input garantida por `src/architecture.test.js:32-74`, 211/211 testes passando, cobertura global 93,01% statements / 74,7% branches). Não há achado Crítico. Os achados Alto concentram-se em: `GameScene` fazendo orquestração demais (SRP), `SpriteRenderer` conhecendo chaves de asset e geometria de sprites (DIP), duplicação de `clamp01`, função `buildMainMenuScreen` com 221 linhas, e dois arquivos de lógica crítica com branch coverage abaixo de 80% (`src/main.js`, `src/render/canvas-renderer.js`). Código morto confirmado é pequeno e de baixo risco. Há 9 itens suspeitos que exigem validação manual (seção 5).

---

## 3. Achados por severidade

### 3.1 Crítico — nenhum achado

Nenhum risco real de bug, dado incorreto ou débito bloqueante foi confirmado com evidência. Os pontos que *pareciam* críticos na triagem (ex.: `GameScene.enter` lançando `Error` em `src/scenes/game-scene.js:63-65`, `BootScene` sem `await` no preload) foram descartados após verificação: o primeiro é validação intencional de conteúdo com teste correspondente, o segundo é fire-and-forget documentado com fallback para placeholders (`src/scenes/boot-scene.js:28-31`, `src/render/sprites.js:231-238`).

### 3.2 Alto

#### A1 — SOLID (SRP) · `src/scenes/game-scene.js:32-396` — `GameScene` acumula orquestração de input, física, regras de resposta, vidas, HUD, câmera, efeitos, pausa, speedrun e navegação
**Descrição objetiva:** a classe tem ~365 linhas e 15+ métodos cobrindo: `enter` (construção de player/câmera/HUD/model), `_applyInput`, `onItemCollected` (~70 linhas), `onHazardHit`, `respawn`, `finishLevel`, `onGameOver`, `togglePause/pause/resume/_showPauseMenu`, `update`, `draw`.
**Por que é problema:** viola Single Responsibility — qualquer mudança em regra de resposta, pausa, speedrun ou apresentação toca o mesmo arquivo; o próprio `update` (`src/scenes/game-scene.js:118-147`) mistura leitura de input, timer de speedrun, timer de vitória, física, câmera e efeitos. É o acoplador central do jogo.
**Evidência:**
```
src/scenes/game-scene.js:32:export class GameScene extends Scene {
src/scenes/game-scene.js:40:  enter({ lessonId, mode = 'normal', speedrunCourse = null, speedrunState = null } = {}) {
src/scenes/game-scene.js:118:  update(dt) {
src/scenes/game-scene.js:149:  draw(renderer) {
src/scenes/game-scene.js:338:  onGameOver() {
src/scenes/game-scene.js:369:  _showPauseMenu() {
```
Contraponto registrado: o cabeçalho da classe declara a intenção (`src/scenes/game-scene.js:24-31` — "It is the only place that connects input -> gameplay -> rules"), logo a extração deve preservar esse ponto único de conexão (ex.: extrair *políticas* — pausa, vitória, speedrun — mantendo a cena como mediadora fina).

#### A2 — SOLID (DIP) · `src/render/sprites.js:1-323` — `SpriteRenderer` depende de chaves concretas de asset e de geometria fixa de sprites
**Descrição objetiva:** o renderizador conhece strings de chave (`'object:checkpoint'`, `'object:finish-portal'`, `'item:letter-carrier'`, prefixo `bg:`), dimensões de crop fixas (`LETTER_CARRIER_BOUNDS`, `CHECKPOINT_BOUNDS`, `FINISH_PORTAL_BOUNDS` em `src/render/sprites.js:16-18`) e monta chave de personagem via template (`src/render/sprites.js:261`).
**Por que é problema:** módulo de apresentação de baixo nível depende de detalhes concretos de conteúdo/asset em vez de recebê-los como abstração/dados — trocar um sprite exige editar o renderizador (também fere Open/Closed). O mesmo vale para `resolveBackgroundKey` (`src/render/sprites.js:20-36`), que contém regra de negócio temática (categoria da fase → fundo).
**Evidência:**
```
src/render/sprites.js:16:const LETTER_CARRIER_BOUNDS = Object.freeze({ sx: 257, sy: 279, sw: 740, sh: 718 });
src/render/sprites.js:113:    const cpImg = this._assets?.has('object:checkpoint')
src/render/sprites.js:140:    const portalImg = this._assets?.has('object:finish-portal')
src/render/sprites.js:194:    const carrierImg = this._assets?.has('item:letter-carrier')
src/render/sprites.js:261:    const key = `${character.id}:${character.sprites[pose] ? pose : 'idle'}`;
```

#### A3 — DRY · `src/audio/audio-manager.js:1-3` × `src/persistence/audio-settings-store.js:3-5` — função `clamp01` duplicada
**Descrição objetiva:** a mesma função de clamp `[0,1]` está definida identicamente em dois módulos sem relação.
**Por que é problema:** duplicação semântica — correção futura (ex.: tratar `NaN`, que hoje `Math.min/Math.max` propaga) precisa ser feita em dois lugares; há ainda um terceiro clamp ad-hoc (`src/render/camera.js:3`).
**Evidência:**
```
src/audio/audio-manager.js:1:function clamp01(value) {
src/audio/audio-manager.js:2:  return Math.min(1, Math.max(0, value));
src/persistence/audio-settings-store.js:3:function clamp01(value) {
src/persistence/audio-settings-store.js:4:  return Math.min(1, Math.max(0, value));
src/render/camera.js:3:const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
```

#### A4 — Clean Code (função longa) · `src/ui/screens/main-menu.js:64-285` — `buildMainMenuScreen` com ~221 linhas e 4 responsabilidades
**Descrição objetiva:** uma única função monta header/logo, faixa de personagens (com loop de 4 slots), painel do herói (retrato + canvas de celebração animado) e painel de ações/rodapé, retornando `{ node, primary, back, cleanup }`.
**Por que é problema:** excede em 5× o limiar de 40 linhas; impossível reutilizar ou testar uma seção isoladamente; o `createCelebrationCanvas` interno (`src/ui/screens/main-menu.js:13-58`) já é uma unidade extraível.
**Evidência:**
```
src/ui/screens/main-menu.js:64:export function buildMainMenuScreen(options) {
src/ui/screens/main-menu.js:84:  // --- 1. Header (Centered Logo + Tagline) ---
src/ui/screens/main-menu.js:93:  // --- 2. Character Selector Strip (KoF Small Thumbnails) ---
src/ui/screens/main-menu.js:155:  // --- 3. Main Stage ---
src/ui/screens/main-menu.js:263:  // --- 4. Footer Tips ---
src/ui/screens/main-menu.js:277:  return {
```

#### A5 — Cobertura · `src/main.js` — 61,11% branches (lógica crítica: composition root + blur/pause + bootstrap)
**Descrição objetiva:** abaixo da meta de 80% para lógica crítica. Trechos sem cobertura: `handleBlur`/emissão `APP_BLURRED` (`src/main.js:119-122`), ramo `visibilitychange` (`src/main.js:124-127`), fallbacks de `hudControlsRoot`/`storage` e o bloco de bootstrap (`src/main.js:136-142`).
**Por que é problema:** pausa automática ao perder foco é comportamento crítico de jogo infantil (aba trocada = jogo pausado); sem teste de branch, regressão passa silenciosa. O `integration.test.js` monta o jogo via `createGame` mas nunca dispara `blur`/`visibilitychange`.
**Evidência:** cobertura V8: `src/main.js | 85.1 stmts | 61.11 branch`; linhas descobertas `120-121, 125-126, 141-142` (relatório `/tmp/cov-full.txt`); `src/main.js:119-127` contém os handlers não cobertos.

#### A6 — Cobertura · `src/render/canvas-renderer.js` — 73,33% branches (lógica crítica: única camada que toca o Canvas)
**Descrição objetiva:** `worldImage` (flipX), `screenFillRect` e `screenImage` têm 0% de cobertura de função; branches de `flipX` verdadeiro/falso nunca exercitados.
**Por que é problema:** espelhamento do sprite (`flipX`, direção do personagem) e o caminho feliz de desenho de imagem passam apenas pelo smoke test com contexto falso (Proxy noop em `src/integration.test.js:29-45`), que aceita qualquer chamada — um erro de argumento nunca falharia.
**Evidência:** cobertura V8: `canvas-renderer.js | 73.46 stmts | 73.33 branch | 75 func`; funções descobertas `worldImage@66, screenFillRect@82, screenImage@109`; `src/render/canvas-renderer.js:66-78` (ramo `flipX`).

### 3.3 Médio

#### M1 — SOLID (SRP) · `src/scenes/menu-scene.js:19-53` — `render()` cria perfil, renomeia perfil legado e monta menu
**Descrição:** o método `render` garante existência de perfil (`createProfile('Nicolas', ...)` em `src/scenes/menu-scene.js:28`), migra nome `'Jogador'`→`'Nicolas'` (`src/scenes/menu-scene.js:31-34`) e monta o menu principal. Criação/migração de perfil é responsabilidade de `ProfileStore`/migração, não da cena.
**Evidência:** `src/scenes/menu-scene.js:19: render() {`, linhas `22-34` (criação/renomeação), linhas `45-70` (montagem do menu).

#### M2 — SOLID (ISP/DIP) · `src/core/scene.js:15-27` — contrato base `Scene` com 4 métodos vazios que a maioria das cenas não usa
**Descrição:** `enter/update/draw/onEvent` vazios no base; `MenuScene` não implementa `update/draw/onEvent`, `BootScene.update` só troca de cena, `VictoryScene` não implementa `onEvent`. Nenhuma cena chama `onEvent` (grep confirma zero chamadas em `src/` fora da definição).
**Evidência:** `src/core/scene.js:15: enter(_params) {}`, `:21: update(_dt) {}`, `:24: draw(_renderer) {}`, `:27: onEvent(_event, _payload) {}`; cobertura V8: `scene.js func 33.33%`.

#### M3 — DRY · `src/render/sprites.js:89-104` × `drawDebug` (`src/render/sprites.js:290-304`) — iteração sobre `solids`/`oneWayPlatforms` com `worldFillRect`/`worldStrokeRect` espelhadas
**Descrição:** `drawTerrain` e `drawDebug` percorrem as mesmas coleções com a mesma estrutura de loop, diferindo só na primitiva de desenho. Duplicação estrutural localizada.
**Evidência:** `src/render/sprites.js:89-104` (loops de `drawTerrain`) e `src/render/sprites.js:291-296` (loops de `drawDebug`).

#### M4 — DRY · `src/gameplay/speedrun-course.js:94` × `tools/generate-levels.mjs` — `shuffle` local vs. lógica de embaralhamento/posicionamento do gerador
**Descrição:** `shuffle(array, random)` (`src/gameplay/speedrun-course.js:94`) existe só para o course builder; o gerador de fases resolve o mesmo problema (distribuição determinística de itens) com `choicesForLesson` + slots fixos. Duas estratégias de aleatoriedade/posicionamento para o mesmo domínio, sem util compartilhado.
**Evidência:** `src/gameplay/speedrun-course.js:94:function shuffle(array, random) {`; `tools/generate-levels.mjs:164` (`decorations: []`, slots determinísticos); `src/content/curriculum-model.js:61-84` (`choicesForLesson`).

#### M5 — KISS · `src/content/level-loader.js:208-218` — `deepFreeze` congela só 2 níveis e é chamado de "deep"
**Descrição:** a função congela o objeto, seus valores diretos e (se array) os itens — mas não recursa em objetos aninhados além disso (ex.: `viewport`, `camera`, `playerStart` são congelados por serem valores diretos; um objeto 3 níveis abaixo não seria). O nome promete mais do que cumpre; para o uso real (níveis gerados com 2 níveis) funciona, mas a abstração é enganosa.
**Evidência:** `src/content/level-loader.js:208:export function deepFreeze(object) {` linhas `208-218`.

#### M6 — YAGNI · `src/input/actions.js:25-28` + `src/input/keyboard-keymap.js:26-27` — `POWER_1`/`POWER_2` mapeados, sem nenhum consumidor
**Descrição:** ações "reservadas para habilidade futura" com keymap ativo (`KeyE`, `KeyQ`) e labels pt-BR, mas grep confirma zero leitura via `consumePressed`/`isActionHeld` em `src/` fora de testes.
**Evidência:** `src/input/actions.js:25-28`, `src/input/keyboard-keymap.js:26-27`; nenhum `consumePressed(Actions.POWER` em `src/` (grep citado na apuração).

#### M7 — YAGNI · `src/core/event-bus.js:47-53` — `once()` sem nenhum uso em produção
**Descrição:** API de assinatura única usada apenas em `src/core/event-bus.test.js:25`; nenhum chamador em `src/` produtivo.
**Evidência:** `src/core/event-bus.js:47: once(event, handler) {`; grep por `\.once(` em `src/` produtivo retorna apenas a definição.

#### M8 — Clean Code (função longa) · `src/gameplay/speedrun-course.js:109-237` — `buildSpeedrunCourse` com ~129 linhas
**Descrição:** monta 26 segmentos, embaralha alfabeto, filtra spots por hazard, posiciona itens, costura checkpoints e congela o curso — 5 responsabilidades numa função.
**Evidência:** `src/gameplay/speedrun-course.js:109` (início) a `:237` (fim); medição por scanner de chaves: 129 linhas.

#### M9 — Clean Code (função longa) · `src/scenes/game-scene.js:216-285` — `onItemCollected` com ~70 linhas
**Descrição:** trata acerto/erro nos modos normal e speedrun, vidas, confete, HUD, progresso, checkpoint e avanço — o ramo speedrun (`src/scenes/game-scene.js:228-258`) e o normal (`:259-284`) são dois fluxos independentes.
**Evidência:** `src/scenes/game-scene.js:216` (início estimado) a `:285`; medição: 70 linhas.

#### M10 — Código morto confirmado · `src/content/characters.js:38-40` — `getCharacterData()` sem chamadas
**Descrição:** exportada mas nunca chamada em `src/`, `tools/` ou testes (grep completo retorna só a definição). Passou no checklist: sem side-effect, sem barrel, sem referência dinâmica, não é entry de build.
**Evidência:** `src/content/characters.js:38:export function getCharacterData(id) {`; grep por `getCharacterData` em `src tools` → 1 ocorrência (a definição).

#### M11–M16 — Cobertura abaixo da meta (80% branch) em arquivos de lógica relevante
| ID | Arquivo | Branch | Trechos descobertos (linhas) | Risco |
|---|---|---|---|---|
| M11 | `src/scenes/menu-scene.js` | 37,77% | `25-26, 32-33, 53-69, 75-130, 133, 136` — criação de perfil, todos os callbacks, `startSpeedrun/playNext/openCharacterPicker/openLessonPicker` | Fluxo de menu quase sem teste; regressão em desbloqueio/continue passa silenciosa |
| M12 | `src/scenes/victory-scene.js` | 77,77% | `24-35` (ramo speedrun inteiro), `53-54` (callbacks), `65-66` (input CONFIRM/BACK) | Vitória do speedrun e navegação pós-vitória sem cobertura |
| M13 | `src/ui/screens/pause.js` | 33,33% | `26-27` (restart/menu do passo `menu`), `34-35, 47` (confirm) | Ações destrutivas (recomeçar/sair) sem teste |
| M14 | `src/ui/screens/game-over.js`, `lesson-picker.js`, `character-picker.js` | 0% | arquivos inteiros | Telas de game-over, escolha de fase e escolha de personagem sem nenhum teste |
| M15 | `src/core/game-loop.js` | 52,63% | `20-22` (defaults `now/requestFrame/cancelFrame`), `42-68` (`start/stop/_scheduleNextFrame`) | Loop real (rAF) nunca testado; só `advance()` é coberto (`src/core/game-loop.test.js`) |
| M16 | `src/core/asset-manager.js` | func 44,44% | `33` (`get`), `42-46` (`defaultLoadImage`) | `get()` sem teste; loader real de `Image` sem teste (só stub no integration) |

Evidência: tabela V8 em `/tmp/cov-full.txt` + JSON `/tmp/joguinho-cov/coverage-final.json` (linhas exatas extraídas por script).

### 3.4 Baixo

#### B1 — YAGNI · `src/content/curriculum.js:23-30` — `getUnit()`/`lessonsOfUnit()` sem chamadas
**Evidência:** `src/content/curriculum.js:23:export function getUnit(unitId) {`, `:28:export function lessonsOfUnit(unitId) {`; grep em `src tools` retorna só definições e a chamada interna `getUnit` dentro de `lessonsOfUnit`.

#### B2 — YAGNI · `src/content/level-registry.js:11-15` — `LEVELS_BY_ID`/`LEVEL_COUNT` exportados sem uso
**Evidência:** `src/content/level-registry.js:11:export const LEVELS_BY_ID`, `:15:export const LEVEL_COUNT`; `getLevelData` usa o Map internamente (`:19`), mas nenhum outro módulo importa `LEVELS_BY_ID` ou `LEVEL_COUNT` (grep confirma).

#### B3 — Código morto confirmado · `src/render/hud-model.js:50-52` — `setLevelName()` sem chamadas
**Evidência:** `src/render/hud-model.js:50: setLevelName(levelName) {`; grep em `src tools` → só definição (o `levelName` é fixado no construtor, `src/scenes/game-scene.js:93-101`).

#### B4 — Código morto confirmado · `src/input/input-manager.js:78-80` — `isPressed()` sem chamadas
**Evidência:** `src/input/input-manager.js:78: isPressed(action) {`; grep em `src tools` → só definição (menus usam `consumePressed`, gameplay usa `isActionHeld`/`consumePressed`).

#### B5 — Código morto confirmado · `src/physics/aabb.js:24-30` — `right()`/`bottom()` sem chamadas
**Evidência:** `src/physics/aabb.js:24:export function right(box) {`, `:28:export function bottom(box) {`; cobertura V8 confirma `right@24, bottom@28` com 0 chamadas; grep em `src tools` → só definições.

#### B6 — Clean Code (nomenclatura) · `src/gameplay/speedrun-course.js:4` — `ALPHABET` em inglês no meio de código de conteúdo pt-BR
**Evidência:** `src/gameplay/speedrun-course.js:4:const ALPHABET = ...`; a política do projeto manda identificadores em inglês — este está conforme, mas o conteúdo (letras A–Z) e o arquivo-irmão `tools/generate-levels.mjs` (comentários em pt-BR) misturam idiomas no mesmo domínio. Item estético, sem impacto funcional.

---

## 4. Itens verificados e considerados saudáveis (amostra, com evidência)

- **Abstração de input íntegra:** `src/input/keyboard-adapter.js:40-53` só traduz `event.code`→ação; `PlayerController` decide pulo (`src/gameplay/player/player-controller.js:9-21`); fitness functions em `src/architecture.test.js:32-74` travam as 5 regras.
- **Sem TODO/FIXME/HACK:** grep em `src tools` retorna vazio.
- **Sem `console.log` em produção:** único `console.*` é `console.warn` documentado em `src/scenes/boot-scene.js:50`.
- **`innerHTML` seguro:** único uso produtivo é `src/ui/pixel-logo.js:73` com escape via `escapeXml` (`src/ui/pixel-logo.js:6-13`); `src/ui/dom.js:2-3` documenta `textContent`-only.
- **Sem imports não consumidos:** scanner de imports × corpo em `src/` retorna vazio.
- **Eventos:** `ANSWER_CORRECT/ANSWER_WRONG/CELEBRATION/HUD_REFRESH/APP_FOCUSED` são emitidos/ouvidos em zero ponto produtivo — classificados como suspeitos (S3), não como mortos, pois `Events` é enum público.
- **Build íntegro:** `vite build` gera `index-DwnINqF1.js` (500,97 kB, com aviso de chunk > 500 kB — ver M17/suspeito S9) e preserva link de fonte externa (ver S8).

---

## 5. Suspeitos, requer validação manual (checklist de falso positivo não conclusivo)

| ID | Item | Motivo da suspeita | Ponto do checklist que impede confirmação |
|---|---|---|---|
| S1 | `src/scenes/boot-scene.js:15` `'item:speed'` e `:22` `'terrain:grass-tile'` pré-carregados, sem leitura em `src/` | Nenhum `assets.get('item:speed'/'terrain:grass-tile')` encontrado | Referência dinâmica: chaves podem ser lidas via variável/`character.sprites` ou usadas por CSS/fase futura; remover quebra preload silenciosamente |
| S2 | `src/content/text-utils.js:37` `letters()`, `:42` `displayLabel()`, `src/content/answer-validator.js:37` `validateLabel()`, `src/input/keyboard-keymap.js:46` `keyLabelFor()`, `src/input/actions.js:39` `ACTION_LABELS`, `src/render/camera.js:19` `worldToScreen()`, `src/persistence/save-store.js:55` `clear()`, `src/persistence/profile-store.js:18,70` `getProfile()/deleteProfile()` | Usados **só em teste**, zero uso produtivo | Categoria própria do prompt: "usado só em teste", não morto — podem ser API pública intencional ou resíduo |
| S3 | `Events.ANSWER_CORRECT/ANSWER_WRONG/CELEBRATION/HUD_REFRESH/APP_FOCUSED` (`src/core/event-bus.js:16-17,22-24`) sem emit/ouvinte produtivo | Parecem resíduo de design por eventos | Enum público: podem ser contrato para ESP32/telemetria futura; remoção muda API |
| S4 | `src/gameplay/level-manager.js:31` `remainingItems`, `src/render/effects.js:22` `count`, `src/physics/physics-engine.js:151` `isGrounded` — usados só em teste | Possível API de debug/introspecção | Mesmo que S2; `isGrounded` pode ser intencional para IA/inimigos futuros |
| S5 | `src/persistence/storage-adapter.js:6-19` classe base `StorageAdapter` + `src/persistence/local-storage-adapter.js:40-49` `isLocalStorageAvailable` | Base lançando `not implemented`; probe usado só em `createStorageAdapter` | Ponto de extensão documentado ("IndexedDB ou perfil remoto", `src/persistence/storage-adapter.js:1-5`); teste cobre via subclasses |
| S6 | `src/content/level-loader.js:99` `physics: {...}` por nível e `decorations` (`src/content/level-loader.js:67,104`) — gravados mas nunca lidos | Nenhum consumidor de `level.physics`/`level.decorations` em `src/` | Podem ser contrato de conteúdo futuro (fases com gravidade própria); gerador já emite `decorations: []` (`tools/generate-levels.mjs:164`) |
| S7 | `src/render/sprites.js:43-44` campo `this.atlas` (sempre `null` no `createGame`) | Escrito no construtor, nunca lido | Pode ser seam para atlas futuro; confirmar com o time antes de remover |
| S8 | `index.html:11-16` fonte externa Google Fonts (`fonts.googleapis.com`) com CSP que permite só `'self'` (+`unsafe-inline` em style) | `docker/nginx.conf:13` — `style-src 'self' 'unsafe-inline'`, sem `fonts.googleapis.com` no `connect-src/font-src`; build preserva o `<link>` (verificado em `/tmp/joguinho-dist/index.html`) | **Requer validação manual em ambiente real**: não foi possível verificar runtime aqui; se a CSP bloqueia a fonte, o logo pixelado cai para fallback — comportamento, não código morto |
| S9 | Bundle `assets/index-DwnINqF1.js` 500,97 kB (aviso do Vite; inclui os ~152 JSON de fase, 608K em `src/content/levels/`) | Acima do limite padrão de 500 kB | Não é duplicação de dependência; code-splitting de fases mudaria `import.meta.glob eager` (decisão arquitetural) — fora do escopo desta auditoria recomendar a troca |

---

## 6. Dependências

**Declaradas** (`package.json:15-19`): `jsdom@^29.1.1`, `vite@^8.3.0`, `vitest@^5.0.1` — todas devDependencies, projeto `private: true`, sem `dependencies`.

| Verificação | Resultado | Evidência |
|---|---|---|
| Dependência sem nenhum import/uso | **Nenhuma** — `vite` (build/dev), `vitest` (26 suítes + config), `jsdom` (2 arquivos via diretiva de ambiente) | `vitest.config.js:7-8`, `src/integration.test.js:1`, `src/ui/pixel-logo.test.js:1` |
| Dependências duplicadas/sobrepostas | **Nenhuma** — 3 devDeps com funções disjuntas | `package.json:15-19` |
| Uso só em config/build | `vite` — reportado separadamente conforme o prompt, mas é o bundler do projeto, não candidato a remoção | `vite.config.js`, `package.json:9` |
| Binários plataforma-específicos | Observado `lightningcss-darwin-arm64` e `@rolldown/binding-darwin-arm64` em `node_modules/` (dependências transitivas do Vite 8); **não verificável** se há lockfile/plataforma de CI que os cubra — sem CI no repositório (seção 1) | `ls node_modules` citado na apuração |

---

## 7. Cobertura de testes

**Método:** `npx vitest run --coverage` com `@vitest/coverage-v8@5.0.1` (provedor ausente em `package.json`, instalado em cache temporário do npx; `jsdom` ligado por symlink temporário para o teste de integração — ambos fora do repositório, removidos após a medição; nenhum artefato persistido no repo: `coverage/` removido, `git status` limpo exceto `pipeline-state.md` pré-existente e não rastreado).
**Resultado:** 27 arquivos, 211 testes, todos passando. Global: **93,01% statements · 74,7% branches · 77,58% funcs · 94,43% lines.**

Arquivos abaixo da meta de 80% **branch** (lógica crítica primeiro):

| Arquivo | Stmts | Branch | Funcs | Linhas/ramos descobertos (V8) |
|---|---|---|---|---|
| `src/ui/screens/game-over.js` | 0 | 0 | 0 | arquivo inteiro (`5-13`) |
| `src/ui/screens/lesson-picker.js` | 0 | 0 | 0 | arquivo inteiro (`8-28`) |
| `src/ui/screens/character-picker.js` | 0 | 0 | 0 | arquivo inteiro (`6-41`) |
| `src/scenes/menu-scene.js` | 29,03 | 37,77 | 21,73 | `25-26, 32-33, 53-69, 75-130, 133, 136` |
| `src/ui/screens/pause.js` | 50 | 33,33 | 20 | `26-27, 34-35, 47` |
| `src/core/game-loop.js` | 53,19 | 52,63 | 20 | `20-22, 42-68` |
| `src/main.js` | 85,1 | 61,11 | 75 | `120-121, 125-126, 141-142` |
| `src/scenes/victory-scene.js` | 64 | 77,77 | 55,55 | `24-35, 53-54, 65-66` |
| `src/render/canvas-renderer.js` | 73,46 | 73,33 | 75 | `67-84, 110` |
| `src/render/sprites.js` | 82,46 | 76,27 | 94,11 | `resolveBackgroundKey` ramos `24-27, 32-34`; `_poseImage/_currentFrame` `260-274`; debug `301` |

**Priorização por branch (não só linha):** os ramos descobertos acima representam caminhos inteiros sem validação — vitória speedrun, ações destrutivas da pausa, telas de game-over/lesson/character picker, loop real com `requestAnimationFrame`, `flipX` de sprites e fallback de background. Detalhes por severidade em A5, A6, M11–M16.

**O que os testes de arquitetura/integração realmente garantem (verificado, não inferido):**
- `src/architecture.test.js:32-74` — 5 fitness functions: input sem imports de gameplay/physics/render/scenes; `keydown/keyup` só em `/input/`; `.code`/`event.repeat` só em `/input/`; `jumpVelocity` só em `config.js`/`player-controller.js`; `moveLeft':` só em `actions.js`. **Não** garantem SRP, DIP, cobertura ou ausência de duplicação.
- `src/integration.test.js:1-285` — smoke jsdom fim-a-fim (boot→menu→lição, andar/pular via `KeyboardEvent` real, coleta e game-over). Usa contexto Canvas falso (Proxy noop) — **não valida desenho real**.

---

## 8. Notas de escopo e não verificáveis

1. **Volume de dados:** `src/content/levels/*.json` (~152 arquivos, 608K) tratado como amostra representativa por serem gerados (`tools/generate-levels.mjs`); validados indiretamente via `loadLevel` no teste do gerador e no registry.
2. **Histórico de branches mergeados:** só existe `main` (+ `origin/main`); sem branches de feature para avaliar resíduo de merge.
3. **Comentários obsoletos:** nenhum encontrado com evidência (grep por TODO/FIXME/XXX vazio; comentários lidos conferem com o código atual).
4. **Não verificável no repositório:** comportamento runtime da CSP vs. Google Fonts (S8); cobertura de plataforma dos binários nativos transitivos (seção 6); performance real do bundle de 500 kB em dispositivo-alvo (S9).
5. **Fora de escopo por instrução do prompt:** nenhuma recomendação de migração de framework ou reescrita arquitetural foi feita; nenhuma edição/commit/push executado.
