# Relatório Final do Pipeline — Aventura do Nicolas&Eloá

**Data:** 2026-09-16
**Prompt orquestrador:** `pipeline` (`npx @unificando/prompts get pipeline`)
**Commit base da sessão:** `c628f02` → **HEAD atual:** `9d9ddca` (Fase 2, commitada pelo usuário)
**Gate final:** `npm test` → **37 arquivos / 283 testes, todos verdes** · `npm run build` → **EXIT 0** (220 módulos)

---

## 1. Resumo executivo

O pipeline rodou as fases 1, gate de triagem, 2, 3 e 5. A auditoria inicial encontrou **0 Críticos** e **10 Altos**; o escopo aprovado no gate foi "tudo aplicável" (itens 1–3 de segurança/LGPD + 5–10 de engenharia). Ao final:

- **8 dos 10 Altos resolvidos** com evidência.
- **2 Altos conscientemente adiados** (item 4 TLS/HSTS — fora do repositório; item 7 `clamp01` — abaixo do limiar de consolidação do contrato).
- **1 achado extra resolvido** fora do escopo original (B05: sourcemap de produção vazando código-fonte e caminhos locais).
- **1 bug de texto corrigido** fora do escopo original (rótulo "Sua próxima descoberta" errado nas 16 unidades).
- Testes: **211 → 283** (+72), arquivos de teste **27 → 37** (+10). Build segue verde.

Nenhum comportamento de jogo foi alterado: as refatorações foram verificadas por **equivalência diferencial** (estado idêntico em 10 cenários de `game-scene.js`; 570 chamadas de render idênticas em `sprites.js`).

---

## 2. Status por fase

| Fase | Prompt | Resultado |
|---|---|---|
| 0 — Contexto | — | Etapa 0 executada; stack detectada (Vite + JS puro, sem backend) |
| 1 — Diagnóstico | `auditoria-engenharia`, `auditoria-seguranca` | 2 relatórios; 28 + 12 achados; 0 Crítico |
| — — Gate de triagem | — | Escopo aprovado: 1–3, 5–10 |
| 2 — Refatoração | `refatoracao-faseada` | F1/F3/F9/F10 aplicadas; F2/F5 report-only; verificada **PASS** após correção |
| Itens 1–3 | (execução direta) | Fontes self-hosted; consentimento parental; política de privacidade |
| 3 — Testes | `testes` | +10 arquivos / +72 testes; 2 defeitos achados → corrigidos |
| 4 — E2E / CI | — | **Não aplicável** (decisão do usuário: projeto fica unit-test-only) |
| 5 — Copy | `revisao-copy` | 3 strings corrigidas + 1 bug de rótulo corrigido |
| 6 — Fechamento | — | Este relatório |

---

## 3. Status dos achados Altos

| # | Achado | Status | Evidência |
|---|---|---|---|
| 1 | CSP do nginx bloqueia Google Fonts em produção | **Resolvido** | Silkscreen self-hosted (`public/fonts/`, OFL 1.1), `@font-face` em `main.css`, 3 links de CDN removidos de `index.html`. `nginx.conf` não precisou mudar: sem `font-src`, a CSP cai em `default-src 'self'` |
| 2 | Perfil de criança sem consentimento parental | **Resolvido** | `privacy-notice.js` + fluxo em `menu-scene.js`; flag `parentalConsent` de aparelho (sobrevive à exclusão de perfis); normalização em `migration.js` |
| 3 | Política de privacidade ausente | **Resolvido** | `docs/10-privacidade-e-lgpd.md` + entrada em `docs/README.md` |
| 4 | Sem TLS/HSTS | **Adiado (D1)** | Depende do ambiente de deploy, fora do repositório |
| 5 | `GameScene` god-class | **Resolvido** | `onItemCollected` dividido em `_handleCorrectAnswer`/`_advanceSpeedrun`/`_handleWrongAnswer`; equivalência diferencial confirmou 10 cenários idênticos |
| 6 | `SpriteRenderer` conhece assets/crops | **Resolvido** | Novo `src/render/sprite-assets.js` (BOUNDS + `resolveBackgroundKey`), movimento byte-idêntico |
| 7 | `clamp01` duplicada | **Adiado (B11)** | São 2 definições idênticas + 1 `clamp` genérico de outro domínio; abaixo do limiar F2.2 (≥3). Consolidar acoplaria áudio↔câmera |
| 8 | `buildMainMenuScreen` ~221 linhas | **Resolvido** | `createCelebrationCanvas` extraído para `celebration-canvas.js` (arquivo encolheu 54 linhas; o módulo extraído tem 55) |
| 9–10 | Cobertura de branches em `main.js` / `canvas-renderer.js` | **Resolvido** | `app-lifecycle.test.js`, `canvas-renderer.test.js` e mais 8 arquivos; ramos `blur`, `visibilitychange`, `flipX`, `screenImage` cobertos |

**Extras resolvidos fora do escopo original:**
- **B05 — sourcemap de produção:** `vite.config.js` tinha `sourcemap: true`; o bundle embutia os 216 arquivos-fonte completos e vazava caminhos absolutos locais (`../../../Users/renatobezerra/...`). Trocado para `false`; verificado que o bundle não emite mais `.map`.
- **Bug de rótulo "Sua próxima descoberta":** `menu-scene.js` montava o card sempre como `Família ${target}`, o que lia "Família A" (unidade Alfabeto) e "Família SOL" (unidades de palavra). Corrigido com `describeLesson()` derivando o substantivo do `type` da lição ("Letra A", "Palavra SOL", "Família do B", "Dígrafos") — 5 testes novos.

---

## 4. Correções da Fase 5 (copy)

| Arquivo | Antes | Depois | Motivo |
|---|---|---|---|
| `src/ui/screens/main-menu.js:188` | `Aventura contínua · …` | `A aventura continua · …` | tradução literal / naturalidade |
| `src/ui/screens/victory.js:57` | `🏁 Maratona Concluída!` | `🏁 Maratona concluída!` | maiúsculas |
| `src/ui/screens/victory.js:59` | `Tempo da Corrida: ⏱️` | `Tempo da corrida: ⏱️` | maiúsculas |

A revisão confirmou ainda: os 152 nomes de fase gerados por `tools/generate-levels.mjs` estão corretos (gerador não precisou mudar); o placeholder `{target}` do currículo nunca foi tocado; nenhum teste precisou ser ajustado por causa das correções.

---

## 5. Débitos e itens abertos

| # | Item | Onde |
|---|---|---|
| D1 | Sem TLS/HSTS em nenhuma camada | `docker/nginx.conf:1-2` — depende do ambiente |
| D2 | NV1–NV6: itens não verificáveis no repositório (TLS efetivo, WAF/CDN, monitoramento, scanner de segredos, `npm audit` online, headers reais) | `relatorio-seguranca-lgpd-deploy.md` |
| D3 | `README.md:28` diz "171 testes" (real: 283) | `README.md` |
| D4 | Sem provider de cobertura instalado — ganhos de branch coverage não auditáveis por ferramenta | `package.json` |
| D5 | `createGame` registra listeners de `window`/`document` sem `dispose` | `src/main.js` |
| D6 | Relatórios de fase com deriva documental (contagens obsoletas) | `.refactor/fase-*-relatorio.md` |
| D7 | Gate de consentimento só dispara quando não existe perfil algum — save legado (perfis sem a flag) pula o aviso | `menu-scene.js:22-39` |
| D8 | Segundo `createProfile` fora do gate de consentimento (inalcançável hoje, acoplamento latente) | `menu-scene.js:106` (`playNext`) |
| D9 | Default órfão `currentLessonTitle = 'Família B'` (resquício do esquema antigo) | `main-menu.js:18` |
| B11 | `clamp01` duplicada (2×) + `clamp` genérico | `audio-manager.js`, `audio-settings-store.js`, `camera.js` |
| B06 | "Zerar progresso" é destrutivo sem confirmação | `main-menu.js` |
| B07 | Botões com `tabindex="-1"` — inalcançáveis por Tab | `dom.js:58` e telas |
| B08 | `prefers-reduced-motion` não cobre animações de canvas | `sprites.js`, `effects.js`, `celebration-canvas.js` |
| B09–B10 | Fronteiras de módulo não extraídas (F3.3 reprovou) | `game-scene.js`, `sprites.js` |
| B19 | Bundle de 501 kB (aviso de chunk) | build |

**Recomendação prioritária de conformidade:** o jogo não expõe exclusão de perfil na interface. `ProfileStore.deleteProfile()` existe e tem teste, mas **nenhuma tela o chama** — então o direito de eliminação (LGPD art. 18, VI) só é exercível pelo navegador. Expor um botão "Apagar perfil" (o backlog B03 já sugeria isso) é a evolução que fecha esse item dentro do próprio jogo. A limitação está documentada com honestidade em `docs/10-privacidade-e-lgpd.md`.

---

## 6. Verificação independente

Cada fase passou por verificação adversarial (subagente separado, com evidência `arquivo:linha` e comandos reais):

- **Fase 2 — PASS** após uma rodada de FAIL: o bloco `prefers-reduced-motion` era **inerte** (seletor universal de especificidade (0,0,0) perdia para as declarações de classe), então `bounceCursor` continuava rodando infinito. Corrigido com `!important` nas 4 longhands; provado em Chrome headless real (CDP com `prefers-reduced-motion` emulado, controle negativo, confirmação de que o minificador preserva os `!important`).
- **Fase 3 — FAIL → corrigido.** Dois defeitos reais: (a) o teste do boot prometia verificar o merge do manifest mas só assertava ausência de chaves — removendo o merge, os testes seguiam verdes; (b) um teste do celebration-canvas sobrescrevia `HTMLCanvasElement.prototype.getContext` sem restaurar, criando dependência de ordem (falhava nas seeds 3/11/17). Ambos corrigidos; a sensibilidade do teste de boot foi provada quebrando o merge de propósito.
- **Itens 1–3 (Seg) — evidências confirmadas por probes independentes:** latch de consentimento sobrevive a double-record e exclusão de perfil; `SaveStore.clear()` reseta o consentimento; save corrompido volta para documento vazio (fail-closed: o aviso reaparece) preservando o payload na chave de degradação; nome com markup renderiza como texto (sem XSS).

**Ressalva de honestidade:** dois verificadores intermediários (itens 1–3 e re-verificação da Fase 3) executaram sondagens adversariais reais (shuffle por seed, probes de independência global, probe de XSS, latch de consentimento) mas **encerraram sem emitir veredito formal**. O orquestrador extraiu as evidências dos logs e completou as checagens pendentes (shuffle global em duas seeds, inventário de arquivos, comportamento com save corrompido, build) — todas passam.

- **Verificação final (agregado) — PASS.** Cobriu Fase 5, a correção do rótulo, B05 e a veracidade deste relatório. Destaques das evidências: as 3 strings novas (e nenhuma das antigas) chegam ao bundle de produção; `describeLesson` foi provado correto contra o currículo real (16 unidades / 152 lições, com controle negativo em que as 5 asserções falham contra a lógica antiga); o build sem sourcemap foi contrastado com um contrafactual (216 `sourcesContent` e caminhos `Users/renatobezerra` no `.map` antigo); o build servido entrega todos os subrecursos, incluindo `/fonts/*.woff2` com MIME correto; shuffle verde em 5 seeds.
- **Limitações do próprio processo de verificação:** a prova em Chrome headless (CDP) da correção de `prefers-reduced-motion` **não pôde ser re-executada** na verificação final (sem ferramenta de automação de browser na sessão); o que é re-verificável foi confirmado (4 declarações `!important` presentes, seletor universal, minificador as preserva). E os logs de verificação não são artefatos versionados, então essa rastreabilidade não é auditável a posteriori pelo repositório.

---

## 7. Estado da árvore de trabalho

- **Commitado:** Fase 2 em `9d9ddca` (pelo usuário, já incluindo a correção de `!important`).
- **Não commitado:** 19 arquivos modificados + 14 arquivos novos (itens 1–3, Fase 3, Fase 5, B05, bug de rótulo, relatórios). Diff: 351 inserções / 47 remoções.
- Índice de staging limpo (uma população acidental do índice foi desfeita com `git reset`, preservando todo o trabalho no worktree).
- `.refactor/` está no `.gitignore`; artefatos das fases vivem lá fora do versionamento.

---

*Gerado na Fase 6 do pipeline. Não substitui os relatórios de auditoria (`relatorio-auditoria-engenharia.md`, `relatorio-seguranca-lgpd-deploy.md`) nem o `pipeline-state.md`, que registra a cronologia e as decisões.*
