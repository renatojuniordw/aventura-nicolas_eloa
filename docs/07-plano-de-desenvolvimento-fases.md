# 07 — Plano de desenvolvimento por fases

Roadmap do projeto, com entregáveis e critérios de aceite. As fases 0 a 11 estão
**concluídas** nesta versão; o app nativo via Capacitor (`docs/14`) e o hardware (ESP32)
são os próximos passos planejados.

Marcação: ✅ concluído · 🔜 próximo · 💡 planejado (fora do escopo atual)

---

## Fase 0 — Estrutura e ferramentas ✅

**Objetivo:** um esqueleto que roda, testa e compila.

**Entregáveis**

- `package.json` com scripts `dev`, `build`, `preview`, `test`, `test:watch`, `generate:levels`.
- `vite.config.js`, `vitest.config.js`, `.gitignore`.
- `index.html` com `<canvas>` 960×540 e contêiner de sobreposições de menu.
- `src/styles/main.css` (tema, canvas centralizado, overlays).
- Estrutura de pastas de `src/`.

**Critérios de aceite**

- ✅ `npm run dev` mostra o canvas no navegador.
- ✅ `npm test` executa a suíte.
- ✅ `npm run build` gera `dist/` sem erros.
- ✅ Nenhuma vulnerabilidade (`npm audit`).

---

## Fase 1 — Documentação ✅

**Objetivo:** explicar a arquitetura antes de ela crescer.

**Entregáveis:** os 11 documentos em `docs/`, em português.

**Critérios de aceite**

- ✅ Toda restrição do projeto está coberta por um documento.
- ✅ `docs/03` explica o caminho completo para plugar o ESP32.
- ✅ `docs/04` traz os schemas com exemplos reais.

---

## Fase 2 — Laço principal jogável ✅

**Objetivo:** andar, pular, coletar, acertar, errar, vencer.

**Entregáveis**

- `core/`: `config`, `event-bus`, `game-loop` (timestep fixo), `scene`, `scene-manager`, `asset-manager`.
- `input/`: `actions`, `input-adapter`, `keyboard-keymap`, `keyboard-adapter`, `input-manager`.
- `physics/`: `aabb`, `physics-engine` (gravidade, colisão eixo a eixo, plataforma de mão única).
- `gameplay/`: `player-controller` + 4 estados; `lives-manager`; `level-manager`; `answer-validator`.
- `content/`: `text-utils`, `level-loader`, uma fase de exemplo.
- `render/`: `canvas-renderer`, `camera`, `sprites`, `hud`, `hud-model`, `effects`.
- `scenes/`: `boot`, `menu`, `game`, `victory`; `ui/`: `dom`, `menu`.
- `main.ts` como composition root.
- Pausa com `Esc`, altura variável de pulo, tempo de coiote, buffer de pulo, pausa automática.

**Critérios de aceite**

- ✅ Andar e pular funcionam pelo teclado.
- ✅ **A lógica de pulo está fora do listener de tecla**, provado por teste de arquitetura.
- ✅ Item errado custa um coração; item certo comemora e avança.
- ✅ Queda não custa coração.
- ✅ A documentação (`docs/03`) descreve exatamente o modelo implementado.

---

## Fase 3 — Currículo e conteúdo ✅

**Objetivo:** conteúdo didático de verdade, dirigido por dados.

**Entregáveis**

- `curriculum.json` com 16 unidades e 152 lições (alfabeto, famílias silábicas, dígrafos,
  encontros consonantais, palavras monossílabas e dissílabas).
- `curriculum-model.ts` expandindo pools em lições (compartilhado com o gerador).
- `tools/generate-levels.mts` com 4 templates de terreno.
- 152 arquivos de fase gerados e versionados.
- Testes de coerência currículo ↔ fases.

**Critérios de aceite**

- ✅ `npm run generate:levels` gera todas as fases e valida cada uma na saída.
- ✅ Exatamente 1 alvo por fase; distratores sempre rejeitados.
- ✅ **Acrescentar uma lição não exige mudar código** — só o JSON e o gerador.

---

## Fase 4 — Persistência e perfis ✅

**Objetivo:** o progresso sobrevive ao recarregar e cada criança tem o seu.

**Entregáveis**

- `storage-adapter` (+ implementação em memória), `local-storage-adapter`, `storage-keys`.
- `migration` com escada de versões e cópia degradada.
- `save-store`, `profile-store`, `progress-store`.
- Seleção de jogador e de personagem no menu; autosave ao concluir a fase; estrelas por
  precisão; liberação sequencial.

**Critérios de aceite**

- ✅ Recarregar a página mantém progresso e estrelas.
- ✅ Perfis isolados entre si.
- ✅ Save corrompido se recupera sozinho, preservando o original para diagnóstico.
- ✅ Save antigo (v0) é migrado.

---

## Fase 5 — Polimento e arte ✅

**Objetivo:** transformar o esqueleto funcional em um jogo bonito e agradável.

**Entregáveis**

1. **Arte de produção.** As formas geométricas provisórias foram substituídas por pixel
   art gerada por IA a partir de referências privadas da família (personagens, cenários,
   itens, objetos), em `public/assets/`. Os pontos de leitura são `render/sprites.ts` e
   `content/atlas-meta.ts`. A sprite sheet em `imgs_referencia/` continua **apenas** como
   referência histórica de proporções — é arte estilo Mario e não é distribuída (nunca
   entra no build). Procedência e restrições de uso da arte de produção: ver
   [09 — Glossário e convenções §7](09-glossario-e-convencoes.md#7-licenças-e-procedência-de-arte).
2. **Animações.** `idle`, `walk`, `run`, `jump`, `celebrate` por personagem, ligadas aos
   estados do jogador via `atlas-meta.ts`.
3. **Infraestrutura de som.** `AudioManager` (`src/audio/audio-manager.ts`) já existe,
   com mute/volume persistidos e uma API `register`/`playMusic`/`playSfx` pronta para
   receber arquivos. **Nenhum efeito sonoro ou trilha foi registrado ainda** — é
   um item em aberto (ver [08 — Evolução futura §3](08-evolucao-futura.md#3-som)).
4. **Sensação de jogo.** Números de física em `config.ts` (gravidade, pulo, velocidade)
   ajustados e cobertos por teste; refinamento contínuo conforme feedback de uso real.

**Critérios de aceite**

- ✅ Cada estado do jogador tem uma animação correspondente com arte de produção.
- ✅ Arte com procedência documentada em `docs/09`.
- 🔜 Existe som para acerto, erro, pulo e vitória, com opção de silenciar — infraestrutura
  pronta, faltam os arquivos de áudio.

---

## Fase 6 — TypeScript e UI em React ✅

**Objetivo:** tipagem estática em todo o motor e uma camada de UI mais sustentável, sem
abrir mão da arquitetura (motor sem framework, UI sem lógica de jogo).

**Entregáveis**

- Migração completa de `core/`, `physics/`, `gameplay/`, `render/`, `input/`, `audio/`,
  `scenes/`, `persistence/`, `content/` e `main.ts` para TypeScript com `strict: true`
  (`tsconfig.json`).
- Telas de menu (`ui/screens/*.tsx`) reescritas em React, montadas por
  `ui/screens/mount-screen.ts`; `ui/menu.ts` continua orquestrando qual tela está visível,
  sem depender do React para isso.
- Dois novos testes de arquitetura (`architecture: React stays out of the engine`)
  garantindo que nenhum arquivo `.tsx` sai de `src/ui/` nem importa o motor, e que o
  motor nunca importa React.
- Script `npm run typecheck` (`tsc --noEmit`).

**Critérios de aceite**

- ✅ `npm run typecheck` passa sem erros.
- ✅ `npm test` continua passando (298 testes).
- ✅ A fronteira motor/React é verificada automaticamente, não só por convenção.

---

## Fase 7 — Mobile: toque e PWA ✅

**Objetivo:** tornar o jogo jogável por toque e instalável como app, sem portar nada —
adicionando uma camada sobre a arquitetura existente. Roteiro completo em
[`MOBILE_PLAN.md`](../MOBILE_PLAN.md); detalhes de uso em
[11 — Mobile, PWA e deploy](11-mobile-pwa-e-deploy.md).

**Entregáveis**

- `src/input/touch-adapter.ts` implementando `InputAdapter` via Pointer Events.
- `src/input/composite-adapter.ts` combinando teclado e toque simultaneamente.
- `src/ui/touch-controls.ts`: D-pad + botão de pulo em tela, detectados por
  `matchMedia('(pointer: coarse)')`.
- `vite-plugin-pwa` configurado em `vite.config.js`: manifest instalável, ícones
  (`tools/generate-pwa-icons.mjs`), cache offline do app shell e cache sob demanda da
  arte pesada (~22 MB) via Workbox.
- CSS responsivo com `clamp()`/viewport units e aviso de "gire o celular" em telas
  retrato.

**Critérios de aceite**

- ✅ Nenhum arquivo de gameplay, física ou render foi tocado para o toque existir.
- ✅ Teclado e toque funcionam simultaneamente quando ambos estão disponíveis.
- ✅ O jogo funciona offline após uma sessão normal de jogo.
- ✅ `npm test` continua passando sem alterar testes de gameplay existentes.

---

## Fase 8 — Deploy: Docker e Nginx ✅

**Objetivo:** um caminho de produção reproduzível e hardened para publicar o jogo numa
VPS. Detalhes completos em [11 — Mobile, PWA e deploy](11-mobile-pwa-e-deploy.md).

**Entregáveis**

- `Dockerfile` multi-stage: build com `node:22-alpine`, runtime com
  `nginxinc/nginx-unprivileged:1.27-alpine` (não-root, porta 8080, `HEALTHCHECK`).
- `docker/nginx.conf`: cabeçalhos de segurança, CSP estrita, gzip, cache imutável para
  assets com hash, fallback de SPA.
- `docker-compose.yml`: publicação só em loopback, `read_only`, `cap_drop: ALL`,
  `no-new-privileges`, limites de CPU/memória/PIDs.
- `docker/nginx-vps.conf`: proxy reverso na VPS com rate limiting, pronto para HTTPS via
  `certbot`.

**Critérios de aceite**

- ✅ `docker compose up` sobe o jogo servido por Nginx não-root.
- ✅ Nenhuma porta é exposta além de `127.0.0.1`; a VPS decide o que é público.
- ✅ Cabeçalhos de segurança presentes (`CSP`, `X-Frame-Options`, etc.).

---

## Fase 9 — Controle por celular (WebSocket + Acelerômetro) ✅

**Objetivo:** transformar um celular Android preso ao corpo da criança em controle de pulo. Detalhes completos em [12 — Controle por celular](12-controle-por-celular.md).

**Entregáveis**

- `signaling/`: servidor WebSocket com Socket.io isolado, gerenciador de salas (`RoomManager`), validação de códigos de sessão e rate-limiting.
- `src/input/phone-adapter.ts`: adaptador de entrada plugado via `CompositeAdapter`, disparando `Actions.JUMP`.
- `src/input/auto-run-adapter.ts`: corrida contínua (`Actions.MOVE_RIGHT`) durante o modo celular.
- `src/controle/`: aplicação web do celular com calibração e detecção de pico por acelerômetro (`jump-detector.ts`), gravação de séries temporais (`session-recorder.ts`) e replay determinístico (`session-replay.ts`).
- `src/net/phone-control-coordinator.ts`: orquestração do pareamento por QR Code e pausa automática da partida caso o celular caia.

**Critérios de aceite**

- ✅ Nenhuma regra de colisão, física ou lógica de fase foi alterada.
- ✅ Celular e TV sincronizam via WebSocket sem expor stream contínuo de sensores fora da rede local.
- ✅ Pausa automática protege a criança caso o aparelho se desconecte.
- ✅ Cobertura completa de testes automatizados no cliente e no servidor de sinalização.

---

## Fase 10 — Mundo contínuo, Explorar e Corrida do Alfabeto ✅

**Objetivo:** experiência fluida sem cortes abruptos de tela, introdução do modo Explorar (palavras) e da Corrida do Alfabeto (A–Z contínuo). Detalhes em [02 — Gameplay](02-gameplay-e-controles.md) e [15 — Melhorias pós-streaming](15-plano-melhorias-pos-streaming.md).

**Entregáveis**

- `src/gameplay/world-stream.ts`: geração incremental de trechos sob demanda à frente do jogador, com descarte de segmentos distantes para limitar memória.
- Reposicionamento inteligente de alvos: se o jogador ultrapassa a letra sem coletar, ela reaparece adiante.
- Portal de vitória: corte plano do terreno e transição suave ao final de cada objetivo pedagógico.
- Trilha de palavras no modo Explorar (`src/gameplay/explore-run.ts`) com jornadas curtas de até 3 palavras e resumo ilustrado.
- Caderno de descobertas (`src/content/discoveries.ts`, `src/ui/screens/discoveries-book.tsx`) com 30 ilustrações SVG locais integradas ao PWA offline.

**Critérios de aceite**

- ✅ O mundo mantém contagem de objetos estável em sessões longas.
- ✅ Distratores se mantêm coerentes com a resposta ativa.
- ✅ Chegada ao portal é segura e fecha estados de gameplay sem duplicar vitórias ou derrotas.

---

## Fase 11 — Acessibilidade, Níveis de Apoio e Narração de Letras ✅

**Objetivo:** apoio pedagógico adaptado à autonomia de cada criança e acessibilidade integral. Detalhes em [16 — Letras com palavras de referência](16-plano-letras-com-palavras-de-referencia.md).

**Entregáveis**

- `src/gameplay/support-policy.ts`: três níveis de apoio selecionáveis nas configurações (*assistido*, *padrão*, *desafio*).
  - *Assistido*: seta sobre o alvo, repetição automática da instrução e erros de leitura não retiram corações.
  - *Desafio*: mais distratores na tela e letras vizinhas no alfabeto.
- `src/content/letter-reference-words.json` e `letter-reference.ts`: vocabulário A–Z associando cada letra a uma palavra fixa (“A de amigo”).
- `src/audio/speech-narrator.ts`: sintetizador de voz integrado com narração pedagógica, palavras de referência, fila de áudio com prioridades e repetição.
- Acessibilidade visual e motora: alto contraste, texto ampliado no Canvas e HUD, redução de movimento (sem tremor de tela nem flashes) e suporte a leitores de tela via `live-announcer.ts`.

**Critérios de aceite**

- ✅ A narração por voz funciona em todos os níveis de apoio sem bloquear a partida.
- ✅ Dificuldade motora permanece estável e independente do apoio pedagógico.
- ✅ O HUD e menus respondem imediatamente às preferências persistidas em `experience-settings-store.ts`.

---

## Fase 12 — App nativo Android/iOS via Capacitor 💡

**Objetivo:** publicação nas lojas Google Play e Apple App Store a partir de projeto empacotado com Capacitor. Planejamento completo em [14 — Plano app Android Capacitor](14-plano-app-android-capacitor.md).

**Tarefas**

1. Criar repositório separado derivado da base web estável.
2. Configurar Capacitor com `@capacitor/android` e plugins de orientação de tela, haptics e ciclo de vida.
3. Migrar persistência de preferências para armazenamento nativo seguro.
4. Gravar áudios profissionais de voz para substituir `speechSynthesis` nas lojas.
5. Iniciar teste fechado no Google Play Console conforme requisitos da Families Policy.

---

## Fase 13 — Hardware: ESP32 💡

**Objetivo:** controlar o jogo com sensores e botões físicos plugados via Web Serial ou Bluetooth Low Energy (BLE).

Seguir o roteiro de [03 — Abstração de input](03-abstracao-de-input.md#7-como-plugar-o-esp32-no-futuro-o-caminho-exato).

**Tarefas**

1. Definir o protocolo de mensagens (`{ "button": "jump", "pressed": true }`).
2. Firmware no ESP32 enviando por BLE ou Web Serial.
3. `src/input/esp32-adapter.ts` implementando `InputAdapter`.
4. Plugar no `CompositeAdapter` já existente em `main.ts`.
5. Tela de status e pareamento do dispositivo.

---

## Fase 14 — Ideias de longo prazo 💡

- **Pulo duplo** como novo `PlayerState` (ver [08](08-evolucao-futura.md)).
- **Poderes `E`/`Q`**: as ações já estão reservadas no vocabulário de entrada.
- **Pacotes de som e vozes gravadas**: estúdio profissional com vozes infantis e efeitos sonoros ricos.
- **Modo cooperativo dois jogadores** na mesma tela.
- **Relatório para pais/professores**: estatísticas agregadas de progresso e dificuldades por família silábica.
- **Editor visual de fases** reaproveitando `level-loader` como validador de geometria.

---

## Convenções de trabalho

| Prática | Regra |
|---|---|
| Antes de commitar | `npm test`, `npm run typecheck` e `npm run build` passando |
| Mudou conteúdo | Rodar `npm run generate:levels` e commitar as fases |
| Mudou regra de jogo | Atualizar `docs/02` e o teste correspondente |
| Mudou arquitetura | Atualizar `docs/01`/`docs/05`, e o teste de arquitetura se aplicável |
| Mudou input/toque/PWA/deploy | Atualizar `docs/03`/`docs/11` conforme o caso |
| Novo número de balanceamento | Vai para `config.ts`, nunca solto no código |
| Novo conteúdo pedagógico | Vai para `curriculum.json`, nunca em código |
