# Pipeline State — Aventura do Nicolas&Eloá

**Criado em:** 2026-09-16
**Última atualização:** 2026-09-16 — **pipeline concluído** (fases 1, gate, 2, 3, 5, 6)
**Prompt orquestrador:** `pipeline` (v10/10) — `npx @unificando/prompts get pipeline`
**Commit base da sessão:** `c628f02` → **HEAD:** `9d9ddca` (Fase 2, commitada pelo usuário)

> **Estado final:** 0 Críticos · 8 de 10 Altos resolvidos · 2 adiados com justificativa · 283 testes verdes · build OK.
> Relatório consolidado: `relatorio-pipeline-final.md`.

---

## Contexto detectado (ETAPA 0)

| Item | Detecção |
|---|---|
| Stack | JS ES modules + Vite 8; render em Canvas 2D com overlays DOM para menus. Sem framework, sem backend (bundle estático) |
| Testes | Vitest 5 + jsdom — 27 arquivos `.test.js` (`npm test`) |
| CI | **Ausente** — não há `.github/workflows` |
| Deploy | `Dockerfile` multi-stage + `docker-compose.yml` (nginx-unprivileged, `read_only`, porta 65000) |
| Stack E2E | **Ausente** — sem `playwright.config`, `e2e/`, `cypress/` |
| Copy | Sem landing/marketing; texto de UI/jogo em pt-BR (menus, HUD, mensagens) + `meta description` |
| Dados pessoais | Nome das crianças + progresso em `localStorage` (perfis); sem transmissão para servidor |
| Relatórios anteriores | Nenhum `relatorio-*.md` |

---

## Plano aprovado (2026-09-16)

| Fase | Prompt (id) | Aplicável? | Tipo | Justificativa |
|---|---|---|---|---|
| 1 | `auditoria-engenharia` | Sim | read-only | Diagnóstico de engenharia em stack Vite + JS puro |
| 1 | `auditoria-seguranca` (PROMPT 1 + 2) | Sim | read-only | Deploy Docker/nginx exposto + dados de menores em `localStorage` (LGPD) |
| — | **GATE DE TRIAGEM** | Obrigatório | gate | Pausa dura antes de qualquer correção |
| 2 | `refatoracao-faseada` | Sim | edita | **Escolha do usuário** — substitui `frontend`: pipeline autônomo de 10 fases, gates de build/lint/test e patch reversível por fase |
| 3 | `testes` | Sim | edita | 26 specs existentes; cobertura parcial em render/UI |
| 4 | `setup-e2e` → `auditoria-testid` → `testes-e2e` | **Não aplicável** | — | **Decisão do usuário:** não incluir stack E2E (evita dependência Playwright e flakiness sobre canvas) |
| 4 | `ci-e2e` | **Não aplicável** | — | Não existe CI; deploy é Docker manual |
| 5 | `revisao-copy` | Sim (parcial) | só texto | **Decisão do usuário:** revisar texto de UI/jogo em pt-BR (menus, HUD, mensagens, meta description); sem tocar em lógica |
| 6 | Fechamento | Sim | relatório | `relatorio-pipeline-final.md` + estado final |

**Fora da cadeia (não incluídos no escopo):** `frontend` (substituído por `refatoracao-faseada`), `fullstack`/`backend` (sem Next.js/NestJS), `seo` (projeto sem presença orgânica publicada).

---

## Checklist de fases

- [x] **Fase 1 — Diagnóstico (read-only)** — `auditoria-engenharia` + `auditoria-seguranca` (concluída em 2026-09-16; relatórios: `relatorio-auditoria-engenharia.md`, `relatorio-seguranca-lgpd-deploy.md`; baseline: 211/211 testes passando, build OK)
- [x] **GATE DE TRIAGEM** — escopo aprovado pelo usuário em 2026-09-16: "Tudo aplicável (1–3, 5–10)"; item 4 registrado como débito
- [x] **Fase 2 — Refatoração** — `refatoracao-faseada` (concluída e verificada em 2026-09-16) — ver seção "Fase 2" abaixo
- [x] **Fase 3 — Testes** — `testes` (concluída em 2026-09-16: 37 arquivos / **283 testes** verdes; 2 defeitos bloqueantes achados pela verificação → corrigidos → re-verificados)
- [ ] ~~**Fase 4 — E2E**~~ — Não aplicável (decisão do usuário em 2026-09-16)
- [x] **Fase 5 — Copy** — `revisao-copy` (texto de UI/jogo pt-BR) — concluída 2026-09-16; ver seção "Fase 5" abaixo
- [x] **Fase 6 — Fechamento** — `relatorio-pipeline-final.md` gerado em 2026-09-16

Legenda: `[x]` concluída · `[ ]` pendente · `[~]` em andamento · `[!]` bloqueada

---

## Itens 1–3 do escopo (executados pelo orquestrador em 2026-09-16)

O contrato `refatoracao-faseada` (R2) proibia tocar em deploy/infra, então Seg 1–3
ficaram REPORT-ONLY na Fase 2. O usuário decidiu executá-los diretamente:

- **Seg 1 — CSP × Google Fonts:** fonte Silkscreen self-hosted (`public/fonts/`,
  OFL 1.1 via Fontsource) com `@font-face` em `src/styles/main.css`; os 3 links
  do CDN foram removidos do `index.html`. `docker/nginx.conf` **não precisou de
  alteração**: sem `font-src`, a CSP cai em `default-src 'self'`, que já permite
  fonte local — e a regra de cache da linha 24 já cobre `woff2`. Efeito
  colateral positivo: o app fica offline-capable e elimina a única transferência
  a terceiro (IP/referrer ao Google).
- **Seg 2 — consentimento parental:** novo `src/ui/screens/privacy-notice.js`
  (tela "Um recado para os responsáveis", pt-BR), montada via
  `menu.showPrivacyNotice()`; `MenuScene.render()` mostra o aviso na primeira
  execução e só cria o perfil após confirmação. Flag `parentalConsent` no
  documento (nível de aparelho, sobrevive à exclusão de perfis), com
  `hasParentalConsent()` / `recordParentalConsent()` no `ProfileStore` e
  normalização em `migration.js` (sem bump de schema — campo com default).
- **Seg 3 — política de privacidade:** novo `docs/10-privacidade-e-lgpd.md`
  (tabela de dados, consentimento, direitos art. 18, segurança, regra de ouro
  para devs) + entrada no índice `docs/README.md`.
- **Teste atualizado:** `src/integration.test.js` ("boots from the boot scene…")
  agora cobre o fluxo aviso → confirmação → menu principal.
- **Gate:** 32 arquivos / 232 testes passando; build OK com `/fonts/*.woff2` no
  bundle; zero referências a `googleapis`/`gstatic` no código, HTML e Docker.

## Decisões de triagem

**Decisão (2026-09-16):** escopo "Tudo aplicável (1–3, 5–10)".

**No escopo:**
- Segurança 1: CSP do nginx × Google Fonts (`docker/nginx.conf:13` × `index.html:14`)
- Segurança 2: consentimento parental na criação de perfil (`src/scenes/menu-scene.js:28`)
- Segurança 3: política de privacidade / informações do art. 9º LGPD (ausente)
- Engenharia 5: `GameScene` god-class (`src/scenes/game-scene.js:32-396`)
- Engenharia 6: `SpriteRenderer` conhece assets/crops (`src/render/sprites.js`)
- Engenharia 7: `clamp01` duplicada (`audio-manager.js` × `audio-settings-store.js` + `camera.js:3`)
- Engenharia 8: `buildMainMenuScreen` longa (`src/ui/screens/main-menu.js:64-285`)
- Engenharia 9–10: cobertura de branches em `src/main.js` e `src/render/canvas-renderer.js`

**Fora do escopo:** Médios/Baixos dos relatórios (próximo ciclo).

---

## Fase 2 — Refatoração (concluída e verificada)

**Prompt:** `refatoracao-faseada`. Artefatos em `.refactor/` (não versionados — `.gitignore:21`).
**Gate final:** build OK (219 módulos, 501 kB) · testes **32 arquivos / 232 testes** · lint inexistente no projeto (sem script nem config; gate = build + test).

> **Nota de histórico:** a Fase 2 foi commitada pelo usuário como `9d9ddca`
> ("refactor: extract celebration canvas utility with tests, add reduced-motion
> CSS rules, and refactor game scene answer handlers"), já **incluindo** a
> correção de `!important` do bloco `prefers-reduced-motion`. O commit base
> `c628f02` citado nas verificações era o HEAD no início da sessão; as provas de
> equivalência compararam a árvore de trabalho contra `c628f02`, então seguem
> válidas.

**Fases do contrato:** executadas F1 (código morto), F3 (SRP), F9 (acessibilidade), F10 (testes). Suprimidas: F4 (sem backend), F6 parcial, F8 (não é Next.js). REPORT-ONLY: F2 (limiar F2.2 não atingido), F5 (R2 proíbe infra).

**Aplicado — dentro do escopo aprovado:**

| Item | Arquivos | Mudança |
|---|---|---|
| Eng 5 | `src/scenes/game-scene.js` | `onItemCollected` dividido em `_handleCorrectAnswer` / `_advanceSpeedrun` / `_handleWrongAnswer` (extração in-módulo) |
| Eng 6 | `src/render/sprites.js` → novo `src/render/sprite-assets.js` | BOUNDS + `resolveBackgroundKey` extraídos (movimento byte-idêntico) |
| Eng 8 | `src/ui/screens/main-menu.js` → novo `celebration-canvas.js` | `createCelebrationCanvas` extraído (−55 linhas, byte-idêntico) |
| Eng 9–10 | 5 arquivos de teste novos | `canvas-renderer.test.js`, `app-lifecycle.test.js`, `sprite-assets.test.js`, `celebration-canvas{,.dom}.test.js` |
| F1 | `characters.js`, `hud-model.js`, `input-manager.js`, `aabb.js` | 4 órfãos removidos (`getCharacterData`, `setLevelName`, `isPressed`, `right`/`bottom`) |
| F9.1 | `src/styles/main.css` | `@media (prefers-reduced-motion: reduce)` |

**Verificação adversarial (2 rodadas):**

- **Rodada 1 — FAIL.** O bloco `prefers-reduced-motion` era **inerte**: o seletor universal tem especificidade (0,0,0) e perdia para as declarações de classe (≥0,1,0), então `bounceCursor` seguia rodando infinito. A reconstrução mecânica do CSS pré-correção provou que **todas as 6** declarações concorrentes venciam (o relatório da fase subestimava o alcance).
- **Correção:** `!important` nas 4 longhands do bloco (`main.css:813-816`) + comentário traduzido para inglês (política de idioma do projeto).
- **Rodada 2 — PASS.** Provado em **Chrome headless real** (CDP, `Emulation.setEmulatedMedia` + `getComputedStyle`), com controle negativo (`no-preference` restaura `0.6s`/`infinite`) e confirmação de que o minificador preserva os `!important` no bundle de produção. Sem efeitos colaterais: `scroll-behavior` é inerte (não há scroll suave no projeto), `translateX(-50%)` da regra base evita salto de layout.
- **Equivalência diferencial:** harness temporário comparou HEAD × refatorado — estado idêntico em 10 cenários de `game-scene.js` e 570 chamadas de render idênticas em `sprites.js`. As extrações preservam comportamento.
- **R10 cumprido:** nenhum teste rastreado foi modificado (5 novos, todos untracked).
- **Higiene:** índice pristine durante a fase (`git diff --cached` vazio); a Fase 2 foi depois commitada pelo usuário como `9d9ddca`.

**Resíduos levados para a Fase 3** (apontados pela verificação): loop real de `celebration-canvas` sem teste commitado (e docstring afirmando garantia não asserida); bounds com `expect.any(Number)` em `sprite-assets.test.js`; vitória de maratona (ramo final de `_advanceSpeedrun`) sem cobertura.

---

## Fase 5 — Revisão de copy (concluída)

**Prompt:** `revisao-copy`. Relatório da fase em `/tmp/pipeline-prompts/fase-5-relatorio.md`.
**Volume:** ~70 strings de UI/meta + 16 títulos/`objectiveTemplate` + 152 rótulos gerados revisados.

**Correções aplicadas (3 linhas):**

| Arquivo:linha | Antes | Depois | Motivo |
|---|---|---|---|
| `src/ui/screens/main-menu.js:188` | `Aventura contínua · …` | `A aventura continua · …` | tradução literal / naturalidade |
| `src/ui/screens/victory.js:57` | `🏁 Maratona Concluída!` | `🏁 Maratona concluída!` | maiúsculas |
| `src/ui/screens/victory.js:59` | `Tempo da Corrida: ⏱️` | `Tempo da corrida: ⏱️` | maiúsculas |

**Bug de rótulo corrigido (decisão do usuário em 2026-09-16):** `menu-scene.js:42-43` (no estado pré-correção) montava o card "Sua próxima descoberta" sempre como `Família ${target}` — lia "Família A" (Alfabeto) e "Família SOL" (palavras), errado nas 16 unidades. Corrigido com `describeLesson()` (novo, exportado) derivando o substantivo do `type` da lição: `letter` → "Letra A"; `word` → "Palavra SOL"; `syllable` → `unitTitle` ("Família do B", "Dígrafos", "Encontros Consonantais"), com fallback `Sílabas X`. **+5 testes** em `menu-scene.test.js`.

**Não alterado (de propósito):** título/marca `Aventura do Nicolas&Eloá`; títulos de unidade (fixados no glossário `docs/09`); o trio "pule/descubra/brinque" (voz de marca); os 152 nomes de fase gerados (corretos — gerador não precisou mudar).

**Itens propostos que requerem aprovação** (Etapa 5 do prompt, não criados): texto explicando o Speed Run; dica de auto-save no rodapé.

**Gate:** 37 arquivos / 283 testes verdes; build EXIT 0.

---

## Fase 3 — Testes (concluída e verificada)

**Prompt:** `testes`. Artefatos da fase: `business-rules.md`, `test-plan.md`, `test-report.md` em `/tmp/testes-fase3/`.
**Resultado:** 32 arquivos / 232 testes → **37 arquivos / 283 testes** (+5 arquivos, +51 testes líquidos após as correções).

**Aplicado:** 8 arquivos de teste existentes reconciliados (acoplamentos a privados `_winTimer`/`_currentMusic` substituídos por transições observáveis; bounds pinados por valor; assert tautológico corrigido), 2 remoções/fusões seguras, 5 arquivos novos (`boot-scene`, `victory-scene`, `menu-scene`, `privacy-notice`, `pause`). Resíduos (a)(b)(c) da Fase 2 fechados.

**Verificação adversarial — FAIL → corrigido:**
- **Defeito 1 (teste oco):** `boot-scene.test.js` prometia verificar o merge do manifest de personagens mas só assertava que a constante base não tinha essas chaves — removendo o loop de merge em `boot-scene.js`, os 5 testes seguiam verdes. Corrigido: o teste agora lê `assets.load.mock.calls[0][0]` e asserta cada pose/retrato **por valor** + que o merge adiciona chaves. Sensibilidade provada quebrando o merge de propósito (teste falha).
- **Defeito 2 (vazamento de estado global):** `celebration-canvas.dom.test.js` sobrescrevia `HTMLCanvasElement.prototype.getContext` sem restaurar → dependência de ordem, falhava com `--sequence.shuffle` nas seeds 3/11/17. Corrigido com stub reafirmado no `beforeEach` e restauração no `afterAll`.
- **Extra:** teste novo cobrindo o avanço de frame da grade 2×2 (crops exatos), que o plano previa e não existia.

**Nenhum teste valida bug** (amostragem adversarial contra `business-rules.md`).

**Desvio de instrução (registrado por transparência):** o prompt `testes` autoriza reconciliar testes (inclusive editar), mas o orquestrador havia instruído o subagente a trabalhar **apenas em `/tmp/testes-fase3/`** nesta rodada, sem tocar no repositório. O subagente editou o repo diretamente. Como o conteúdo se mostrou correto e o gate verde, a decisão foi **verificar o conteúdo em vez de descartar o trabalho** — daí as duas rodadas de verificação adversarial acima. Sem impacto no produto, mas o processo não foi seguido como instruído.

**Gate:** 37 arquivos / 283 testes verdes · build EXIT 0 · shuffle em 5 seeds sem falha.

---

## Débitos

- **D1 — TLS/HSTS (achado 4):** sem TLS/HSTS em nenhuma camada do repositório; depende do ambiente de hospedagem, fora do código. Rebaixado a débito — reavaliar quando o deploy sair da LAN local.
- **D2 — NV1–NV6 do relatório de segurança:** itens não verificáveis no repositório (TLS/HSTS efetivo, WAF/CDN/DDoS, monitoramento, scanner dedicado de segredos, `npm audit` online, headers/CSP reais servidos).
- **D3 — `README.md:28` desatualizado:** diz "Roda os 171 testes" (real: 232; já estava desatualizado no baseline, 211). Drift pré-existente, não regressão.
- **D4 — Sem provider de cobertura:** `@vitest/coverage-v8` não está instalado, então os ganhos de *branch coverage* do Eng 9–10 não são auditáveis por ferramenta. Avaliação foi por inventário de ramos + probes.
- **D5 — `createGame` sem teardown:** registra listeners de `window`/`document` sem caminho de `dispose`; benigno no app (montagem única), mas vaza entre montagens nos testes.
- **D6 — Relatórios de fase com deriva documental:** `.refactor/fase-9-relatorio.md` cita "+14/−0" e gate "27/211" (obsoletos) e não documenta o uso de `!important` introduzido na correção.
- **D7 — Gate de consentimento não cobre save legado:** o aviso parental só dispara quando **não existe perfil algum** (`menu-scene.js:22-39`). Um save criado antes da feature (perfis presentes, `parentalConsent` ausente → `false` após normalização) pula o aviso e reusa o perfil existente. É o comportamento documentado no comentário ("before any child profile is created") e o impacto prático hoje é nulo (projeto não publicado, sem saves legados em campo), mas o gate é mais estreito que o nome sugere.
- **D8 — Segundo `createProfile` fora do gate:** `menu-scene.js:106` (`playNext`) tem um fallback que cria perfil sem passar pela verificação de consentimento. Hoje é inalcançável sem consentimento (o menu só é montado depois do gate em `render()`), mas é um acoplamento latente: qualquer mudança futura no caminho de render pode abrir o furo. Unificar a criação de perfil num único ponto gateado é a correção estrutural.
- **D9 — Default órfão `'Família B'`:** `main-menu.js:18` ainda tem `currentLessonTitle = 'Família B'` como default parameter — resquício do esquema antigo (inalcançável: o único call site sempre passa o valor). Remover junto de D8.
- **B05 resolvido (2026-09-16, decisão do usuário):** `vite.config.js:13` tinha `sourcemap: true` — o bundle de produção embutia o fonte original completo (216 arquivos em `sourcesContent`) e vazava caminhos absolutos locais (`../../../Users/renatobezerra/...`). Trocado para `sourcemap: false`; verificado que o bundle não emite mais `.map`. Gate: 37/278 testes verdes.
