# 06 — Estratégia de testes

**735 testes** em **81 arquivos** no motor/cliente, rodando em cerca de 3 segundos, mais **22 testes** em **2 arquivos** no servidor de sinalização WebSocket (`signaling/`).

A estratégia é simples e deliberada: **testar lógica pura sem DOM** e ter **um** teste de
integração que prova que as peças se conectam. O DOM aparece só onde o DOM *é* o
comportamento sob teste (ver seção 4).

```bash
npm test                     # roda todos os 735 testes do cliente
npm run test:watch           # modo observador durante o desenvolvimento
npm --prefix signaling test  # roda os 22 testes do servidor de sinalização
```

---

## 1. Filosofia

| Princípio                                     | Como aparece no projeto                                        |
| --------------------------------------------- | -------------------------------------------------------------- |
| Teste o que decide, não o que desenha         | Física, validação, input e migração são testados; desenho não  |
| Injeção de dependência em vez de mock de DOM  | `FakeAdapter`, `MemoryStorageAdapter`, `NullRenderer`          |
| Regras de arquitetura como testes             | `src/architecture.test.js`                                     |
| Um teste de integração, não vinte             | `src/integration.test.js` (jsdom) cobre o caminho completo     |
| Testes são documentação                       | Os nomes dos testes descrevem o comportamento esperado         |
| Teste afirma **valor**, não existência        | Recorte de sprite é comparado por número, não por `expect.any` |

Por que não testar o desenho fino: um teste que só verifica "a função de desenhar foi
chamada" trava mudanças visuais sem pegar bug real. Preferimos concentrar a lógica em
módulos puros — que são a maioria — e deixar o desenho simples.

**Onde o desenho é testado, o valor é pinado.** `canvas-renderer.test.js` confere o
offset exato da câmera e o inset de meio pixel; `sprite-assets.test.js` confere os
retângulos de recorte por número. Esses testes pegam erro de transcrição — os que só
contam chamadas, não pegariam.

---

## 2. Mapa de testes

### 2.1 Núcleo e entrada

| Arquivo                                 | Testes | O que garante                                                              |
| --------------------------------------- | -----: | -------------------------------------------------------------------------- |
| `core/event-bus.test.js`                |      5 | Assinatura, cancelamento, `once`, remoção durante o despacho               |
| `core/game-loop.test.js`                |      6 | Timestep fixo: 0,5 s → 30 passos; 10 s → limitado a 5 e descarta o resto   |
| `core/scene-manager.test.js`            |      5 | `enter`/`exit` na ordem certa, evento de troca, cena inexistente           |
| `core/lifecycle.test.js`                |      3 | `blur` limpa input e avisa; aba visível avisa; o áudio destrava só no primeiro toque (jsdom) |
| `core/asset-manager.test.js`            |      4 | Cache por nome, não recarrega o que já tem, requisições simultâneas compartilhadas, retenta após falha |
| `app-lifecycle.test.js`                 |      3 | `blur`/`visibilitychange` limpam o input e pausam; grafo montado (jsdom)   |
| `input/keyboard-keymap.test.js`         |      8 | Mapeamento por `code`, teclas não mapeadas, teclado remapeado              |
| `input/keyboard-adapter.dom.test.js`    |      5 | DOM keydown/keyup, prevenção de rolagem padrão, disparo de ações           |
| `input/input-manager.test.js`           |     11 | "Segurado" vs "apertado uma vez", auto-repeat ignorado, troca de adaptador |
| `input/touch-adapter.test.js`           |      5 | Pointer down/up, cancel/leave soltam a ação, cada botão na sua ação        |
| `input/composite-adapter.test.js`       |      4 | Anexa/destaca todos os filhos, qualquer fonte filha comanda o mesmo `InputManager` |
| `input/phone-adapter.test.js`           |      5 | Ações do celular via transporte, despacho semântico e desconexão           |
| `input/auto-run-adapter.test.js`        |      4 | Corrida contínua sem intervenção motora durante modo celular               |
| `input/haptics.test.js`                 |      8 | Vibração tátil segura com fallback sem falhar em navegadores sem suporte   |
| `ui/touch-controls.test.js`             |      3 | Botões esquerda/direita/pulo mapeados às ações certas, `show()`/`hide()` preservam elementos |

### 2.2 Física e regras de jogo

| Arquivo                                     | Testes | O que garante                                                                 |
| ------------------------------------------- | -----: | ----------------------------------------------------------------------------- |
| `physics/aabb.test.js`                      |      6 | Sobreposição de caixas, encostar ≠ sobrepor, caixa envolvente                 |
| `physics/physics-engine.test.js`            |     12 | Gravidade, velocidade terminal, colisão nos 4 lados, plataforma de mão única, broad-phase |
| `gameplay/player/player-controller.test.js` |     12 | Pulo só no chão, tempo de coiote, buffer de pulo, pulo curto, transições      |
| `gameplay/lives-manager.test.js`            |      4 | Perda de coração, esgotamento anunciado uma vez, nunca negativo               |
| `gameplay/level-manager.test.js`            |     16 | Coleta única, perigo ao entrar, queda anunciada uma vez, checkpoints          |
| `gameplay/world-stream.test.ts`             |     15 | Mundo contínuo, alvo que reaparece à frente, janela de retenção, chegada ao portal |
| `gameplay/stream-courses.test.ts`           |      7 | Fábricas de percurso por modo (Aprender, Explorar, Corrida do Alfabeto)       |
| `gameplay/explore-run.test.ts`              |      3 | Jornada de exploração de até 3 palavras, avanço de letras e persistência      |
| `gameplay/support-policy.test.ts`           |      4 | Níveis de apoio pedagógico (assistido, padrão, desafio) e suas regras         |
| `gameplay/speedrun-course.test.js`          |      1 | Regra de distância segura entre letra e perigo                                |
| `gameplay/speedrun-run.test.js`             |      4 | Letra atual, avanço sequencial A–Z, cronômetro pausável e dica de ritmo       |

### 2.3 Conteúdo

| Arquivo                               | Testes | O que garante                                                            |
| ------------------------------------- | -----: | ------------------------------------------------------------------------ |
| `content/text-utils.test.js`          |      8 | Acentos, cedilha, caixa, espaços, entrada inválida                       |
| `content/answer-validator.test.js`    |      7 | Acerto, acento, variantes, rejeição de distratores                       |
| `content/characters.test.js`          |      3 | Identificadores, nomes e paletas dos 4 personagens jogáveis              |
| `content/level-loader.test.js`        |     12 | Defaults, conversão do mapa em retângulos, rejeição de fases malformadas |
| `content/curriculum.test.js`          |     14 | 152 fases existem, 1 alvo por fase, distratores rejeitados, ids únicos   |
| `content/letter-reference.test.js`    |     14 | Mapeamento das 26 letras para palavras de referência (“A de amigo”)      |
| `content/word-phases.test.ts`         |      4 | Fases de palavras, progressão fonética e integridade do banco            |
| `content/discoveries.test.ts`         |      3 | Caderno de descobertas, ilustrações SVG locais para todas as palavras    |
| `content/embedding-select.test.ts`    |      9 | Busca e seleção semântica de lições com base em similaridade de embeddings |

### 2.4 Persistência

| Arquivo                                   | Testes | O que garante                                                                 |
| ----------------------------------------- | -----: | ----------------------------------------------------------------------------- |
| `persistence/migration.test.js`           |      9 | Primeira execução, migração v0→v1, save corrompido, versão futura             |
| `persistence/persistence.test.js`         |     18 | Round-trip, melhores estrelas, isolamento entre perfis, liberação sequencial  |
| `persistence/active-profile.test.js`       |      5 | Perfil ativo, criação sob consentimento parental, adoção e renomeação         |
| `persistence/audio-settings-store.test.js`|      4 | Padrões, round-trip, recuperação de JSON corrompido, limites de volume        |
| `persistence/experience-settings-store.test.js` | 3 | Nível de apoio, alto contraste, texto ampliado e redução de movimento         |
| `persistence/learning.test.js`            |      5 | Registro de tentativas, acertos e dificuldades recentes por aluno             |

### 2.5 Render e HUD

| Arquivo                         | Testes | O que garante                                                                    |
| ------------------------------- | -----: | -------------------------------------------------------------------------------- |
| `render/camera.test.js`         |      7 | Conversão mundo→tela, limite de rolagem, suavização e clamp horizontal           |
| `render/canvas-renderer.test.js`|      9 | Offset da câmera, inset de meio pixel, espelhamento (`flipX`), espaço de tela    |
| `render/sprite-assets.test.js`  |     10 | Recortes por número, `resolveBackgroundKey` e seus ramos de fallback             |
| `render/sprites.test.js`        |      8 | Parallax, token da letra, checkpoint e portal do fim                             |
| `render/asset-plan.test.js`     |      4 | Todo asset planejado existe em `public/`, cobertura de fundos e personagens      |
| `render/effects.test.js`        |     10 | Partículas nascem, caem, morrem; confetes e feedback comemorativo sem tela real  |
| `render/hud-model.test.js`      |      7 | Corações, mensagem que aparece e desaparece, cronômetro do Speed Run             |
| `render/hud.test.js`            |      4 | Desenho acessível do HUD, suporte a texto ampliado e contraste                   |

### 2.6 Áudio

| Arquivo                            | Testes | O que garante                                                          |
| ---------------------------------- | -----: | ---------------------------------------------------------------------- |
| `audio/audio-manager.test.js`      |      7 | Estado inicial, volumes por categoria (música/efeitos/voz), destravamento mobile |
| `audio/speech-narrator.test.js`    |     13 | Narração das lições, fila com interrupt, palavras de referência A–Z   |

### 2.7 Controle por celular e sinalização

| Arquivo                                   | Testes | O que garante                                                                   |
| ----------------------------------------- | -----: | ------------------------------------------------------------------------------- |
| `controle/jump-detector.test.js`          |      7 | Detecção de pulo por limiar de aceleração e debounce temporal                   |
| `controle/session-recorder.test.js`       |      6 | Gravação de séries temporais de sensores com timestamps precisos                |
| `controle/session-replay.test.js`         |      9 | Replay determinístico de sessões gravadas para validação contínua de pulo      |
| `controle/threshold-storage.test.js`      |      5 | Armazenamento seguro de calibração do sensor no dispositivo                     |
| `controle/controle-params.test.js`        |      4 | Parsing de parâmetros de URL para pareamento por QR code                        |
| `controle/sensor-time.test.js`            |      2 | Marcação de tempo monotonicamente crescente para séries temporais               |
| `controle/status-message.test.js`         |     11 | Mensagens claras de estado (conectado, calibrando, pulando) na tela do celular   |
| `net/phone-control-coordinator.test.js`   |      7 | Pareamento, troca automática de adaptador e pausa do jogo se celular desconectar|
| `net/session-code.test.js`                |      3 | Geração de códigos amigáveis e seguros para salas de pareamento                 |
| `net/signaling-socket.test.js`            |      4 | Transporte de sinalização via Socket.io com reconexão resiliente                |
| `signaling/src/room-manager.test.js`      |     18 | Pareamento controller↔viewer, expiração, salas isoladas e rate limiting         |
| `signaling/src/session-id.test.js`        |      4 | Validação e sanitização rigorosa de códigos de sessão de pareamento             |

### 2.8 Cenas, telas e UI

| Arquivo                                   | Testes | O que garante                                                                   |
| ----------------------------------------- | -----: | ------------------------------------------------------------------------------- |
| `scenes/boot-scene.test.js`               |      4 | Pré-carrega só itens/objetos + personagem padrão, tolerância a falha de carga   |
| `scenes/menu-scene.test.js`               |     16 | Fluxo de consentimento parental, seleção de perfil, Speed Run e descobertas      |
| `scenes/game-scene.test.js`               |     14 | Acerto/erro, ordem do Speed Run, perigo, fim de maratona, pausa e game over      |
| `scenes/victory-scene.test.js`            |     11 | Vitória normal e do Speed Run, navegação sequencial e ações de botões           |
| `ui/screens/pause.test.js`                |     10 | Passos da pausa, aviso por modo, áudio e recuperação sem perder input (jsdom)   |
| `ui/screens/privacy-notice.test.js`       |      3 | Aviso parental e consentimento obrigatório na primeira execução (jsdom)         |
| `ui/screens/character-picker.test.js`     |      2 | Escolha interativa de personagens com foco acessível e preview                  |
| `ui/screens/discoveries.test.tsx`         |      3 | Renderização da grade do caderno de descobertas e filtros de progresso          |
| `ui/screens/celebration-canvas.test.js`   |      1 | Recorte seguro quando não existe `document` (SSR)                               |
| `ui/screens/celebration-canvas.dom.test.js` |    4 | Loop de animação de comemoração, stop e avanço da grade (jsdom)                 |
| `ui/pixel-logo.test.js`                   |      3 | SVG do logo com título, `aria-label` e acentuação correta                       |
| `ui/overlay-input.test.js`                |      4 | Navegação de overlays via teclado/controle (pulo confirma, duplo pulo volta)   |
| `ui/live-announcer.test.js`               |      2 | Anúncios de acessibilidade para leitores de tela sem repetições redundantes     |
| `ui/mobile-presentation.test.js`          |      1 | Regras de apresentação para telas mobile e orientação em paisagem               |
| `ui/fullscreen.test.js`                   |      6 | Solicitação e encerramento de tela cheia com tratamento de permissões           |
| `ui/pwa-install.test.js`                  |      3 | Convite de instalação do PWA e instruções customizadas para iOS                 |
| `ui/pwa-update.test.js`                   |      8 | Atualização segura do service worker sem interrupção de gameplay                |

### 2.9 Transversais

| Arquivo                | Testes | O que garante                              |
| ---------------------- | -----: | ------------------------------------------ |
| `architecture.test.js` |      5 | **As regras de arquitetura** (ver seção 3) |
| `public-assets.test.js` |      1 | Todo caminho `/assets`, `/icons` ou `/fonts` usado em CSS, HTML e código existe em `public/` |
| `integration.test.js`  |     12 | **O jogo inteiro**, em jsdom (ver seção 4) |

---

## 3. Testes de arquitetura (funcões de aptidão)

Estes cinco testes transformam decisões de design em algo que a suíte verifica sozinha.
Se alguém violar a regra no futuro, o teste falha e explica o porquê.

| Teste                                                                  | Regra que protege                                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `the input layer never depends on gameplay, physics, render or scenes` | Adaptadores de entrada não podem conhecer regras de jogo          |
| `keyboard listeners exist only inside the input layer`                 | Ninguém registra `keydown`/`keyup` fora de `src/input/`           |
| `physical key codes are handled only inside the input layer`           | `event.code` só existe no mapa de teclas                          |
| `the jump impulse is applied only by the player controller`            | `jumpVelocity` só aparece em `config.ts` e `player-controller.ts` |
| `semantic actions are never redefined outside actions.js`              | As ações têm uma única definição                                  |
| `React components never import from the engine layers`                 | Telas `.tsx` só vivem em `src/ui/` e não importam `core/physics/gameplay/render/scenes` |
| `engine layers never import React`                                     | Nenhum arquivo do motor importa `react`/`react-dom`                |

**Na prática, foi isso que pegou um bug real durante o desenvolvimento:** um formulário de
menu tinha um `addEventListener('keydown')` cru para o Enter. O teste apontou o arquivo, e
a solução foi usar `<form onSubmit>`, que é o idioma correto do HTML — mantendo a regra.

---

## 4. Teste de integração (o único com DOM)

`src/integration.test.js` roda em **jsdom** e monta o jogo de verdade, com um contexto de
Canvas falso. Ele percorre o caminho completo:

```
KeyboardEvent real → KeyboardAdapter → InputManager → GameScene
       → PlayerController → PhysicsEngine → LevelManager
       → EventBus → AnswerValidator / LivesManager / ProgressStore
       → VictoryScene
```

O que ele cobre:

1. Boot → menu principal com o título em português.
2. Entrar em uma lição e carregar o arquivo de fase correto.
3. **Andar e pular a partir de eventos de teclado reais** (não de chamadas internas).
4. Coletar o item errado → perde um coração e continua jogando.
5. Coletar o item certo → ganha, comemora e vai para a tela de vitória com 3 estrelas.
6. Cair em um buraco → volta ao checkpoint **sem** perder coração.
7. Pausar e continuar pelo `Esc`.
8. Ligar/desligar as hitboxes pelo `F2`.
9. "Próxima fase" realmente inicia a lição seguinte.
10. Nenhum pulo duplo acontece mesmo martelando o pulo no ar.

O item 3 é o mais importante: ele prova que **a abstração funciona**, e não só que as
unidades funcionam isoladamente.

### Por que só um arquivo com jsdom

Porque DOM é lento e frágil. Concentrar a verificação de integração em um arquivo mantém a
suíte rápida (<1 s) e evita que testes de UI se tornem um peso para manter. Toda regra de
jogo continua testada de forma pura.

---

## 5. Verificar a documentação contra o código

Alguns testes fazem o papel de "documentação executável" e precisam ser atualizados junto
com os textos:

| Se você mudar...                 | Atualize também                                  |
| -------------------------------- | ------------------------------------------------ |
| Quantidade de lições/unidades    | `docs/02` (tabela de conteúdo) e este documento  |
| Uma regra de arquitetura         | `src/architecture.test.js` e `docs/01`/`docs/05` |
| Regras do jogo (vidas, estrelas) | `docs/02` e `src/gameplay/*`                     |
| Formato de fase/currículo        | `docs/04` e os testes de conteúdo                |

---

## 6. Checklist de QA manual

O que os testes automáticos **não** cobrem e precisa de olho humano. Rode `npm run dev` e
confira:

**Menu**

- [ ] O título "Aventura do Nicolas&Eloá" aparece e os botões respondem ao clique.
- [ ] Dá para criar um jogador e ele passa a aparecer na lista.
- [ ] Trocar de personagem muda a cor do personagem no jogo.
- [ ] "Escolher fase" lista apenas as fases liberadas.

**Durante o jogo**

- [ ] Andar com `←`/`→` e com `A`/`D` funciona igual.
- [ ] `Espaço` pula; segurar pula mais alto; soltar cedo encurta o pulo.
- [ ] É possível pular logo depois de sair da borda de uma plataforma (tempo de coiote).
- [ ] Apertar o pulo pouco antes de aterrissar executa o pulo (buffer).
- [ ] Segurar `Espaço` **não** faz o personagem pular repetidamente.
- [ ] A página **não** rola ao apertar Espaço ou as setas.
- [ ] Nenhum caractere aparece na tela ao digitar durante o jogo.

**Regras**

- [ ] Item errado: perde um coração e aparece a mensagem com a dica.
- [ ] Item certo: confete, mensagem de acerto e a tela de vitória.
- [ ] Cair no buraco (fase "Rio"): volta ao início **sem** perder coração.
- [ ] Com 0 corações: aparece "Acabaram os corações" e "Tentar de novo" funciona.

**Robustez**

- [ ] `Esc` pausa; continuar não faz o personagem continuar andando sozinho.
- [ ] Trocar de aba durante o jogo pausa automaticamente; ao voltar, nenhuma tecla fica presa.
- [ ] Recarregar a página (F5) mantém o progresso e as estrelas.
- [ ] O progresso de um jogador não aparece no outro.
- [ ] No console do navegador não há erros nem avisos.

**Conteúdo**

- [ ] O objetivo no topo ("Colete a letra A") muda conforme a lição.
- [ ] As opções erradas na tela não incluem a resposta certa.
- [ ] A fase de palavras mostra palavras; a de sílabas, sílabas.

---

## 7. Depuração

| Ferramenta            | Como usar                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Hitboxes              | `F2` durante o jogo: contornos de terreno, plataformas, itens, perigos e do jogador      |
| Grade da sprite sheet | As medidas da sprite sheet de produção ficam em `content/atlas-meta.ts`; use-as para conferir os recortes |
| Save inspecionável    | DevTools → Application → Local Storage → `joguinho.sobrinhos.v1`                         |
| Save corrompido       | Comparar com `joguinho.sobrinhos.v1.degraded`                                            |
| Reset de progresso    | Botão "Zerar progresso" no menu (ou apagar a chave no DevTools)                          |
