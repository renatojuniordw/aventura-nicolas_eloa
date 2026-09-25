# Aventura do Nicolas&Eloá

Jogo de plataforma 2D educativo, em português, para crianças em alfabetização.
O jogador corre e pula para coletar **a letra, sílaba ou palavra pedida**.

O motor do jogo (laço de jogo, física, cenas, gameplay) é **TypeScript puro com Canvas
2D** — sem framework de jogo, com `strict: true`. A camada de UI em DOM (menus, overlays,
HUD, controles de toque) é **React + TSX**; uma regra de arquitetura executável garante
que o React nunca importe do motor, e que o motor nunca importe React
(`src/architecture.test.js`). Toda a arquitetura é visível, e a **entrada é abstraída
desde o início**: teclado e toque já convivem hoje através da mesma abstração de entrada
(`InputAdapter`), o que também deixa o caminho pronto para um **ESP32** no futuro, sem
alterar a lógica do jogo.

O jogo é **instalável como PWA** (funciona offline após a primeira sessão) e roda em
produção atrás de um **Nginx** hardened, dentro de um contêiner **Docker**.

---

## Como rodar

Requisitos: **Node.js 20 ou superior**.

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (por padrão `http://localhost:65000`).

### Outros comandos

| Comando                     | O que faz                                              |
| ---------------------------- | ------------------------------------------------------- |
| `npm run dev`                 | Servidor de desenvolvimento com recarga automática       |
| `npm test`                    | Roda os 735 testes em 81 arquivos                       |
| `npm run test:watch`          | Testes em modo observador                                 |
| `npm run typecheck`           | Checa os tipos TypeScript (`tsc --noEmit`)               |
| `npm run build`                | Gera a versão de produção em `dist/` (inclui o PWA)      |
| `npm run preview`              | Serve a versão de produção localmente                     |
| `npm run generate:levels`     | Regenera as fases a partir do currículo                   |
| `npm run generate:embeddings` | Gera embeddings semânticos do currículo                  |
| `npm run generate:pwa-icons`  | Regenera os ícones do PWA (`public/icons/`)               |
| `npm run replay:session`      | Executa replay de sessão gravada de sensores do celular   |
| `npm run export:obsidian`     | Exporta notas e documentações para o vault do Obsidian    |
| `npm --prefix signaling test` | Roda os 22 testes do servidor de sinalização WebSocket    |
| `npm --prefix signaling start`| Inicia o servidor de sinalização WebSocket na porta 3001  |

---

## Como jogar

| Ação              | Teclado                   | Toque                        | Celular (controle) |
| ------------------ | -------------------------- | ------------------------------ | -------------------- |
| Andar               | `←` `→` ou `A` `D`          | Botões ◀ ▶ fixos na tela      | Automático (auto-run) |
| Pular               | `Espaço`, `↑`, `W` ou `Z`    | Botão de pulo fixo na tela    | Pular de verdade (acelerômetro) |
| Pausar              | `Esc` ou `P`                 | Botão de pausa no HUD          | Automático se o celular desconectar |
| Confirmar (menus)  | `Enter` ou `J`               | Toque no botão                 | —                     |
| Voltar (menus)     | `Backspace` ou `Y`           | Toque no botão                 | —                     |
| Mostrar hitboxes    | `F2`                         | —                               | —                     |

- Colete o item indicado **no topo da tela**.
- **Acertar** comemora e conclui a fase. **Errar** custa um coração (são 3).
- **Cair em um buraco não custa coração** — o personagem volta para o mesmo lugar.
- Segurar o pulo faz o personagem subir mais; soltar cedo encurta o pulo.
- **Três modos** no menu:
  - **Começar/Continuar aventura** (Aprender): as lições do currículo em ordem — letra,
    sílaba ou palavra por fase.
  - **Corrida do alfabeto** (Speed Run): encadeia o alfabeto de A a Z sem parar e cronometra
    o melhor tempo por jogador. O relógio para ao entrar no portal e não conta a pausa.
  - **Explorar**: uma trilha de fases de palavra, da mais curta para a mais longa. Cada fase
    mostra a palavra no topo e a narra ("Vamos montar a palavra Gato"); a criança coleta as
    letras em ordem e um quadro de letras vai sendo preenchido. O progresso de cada palavra
    é salvo junto com o das fases (ids `palavra-<id>`, ver `src/content/word-phases.ts`).
- No **Explorar**, cada palavra tem uma ilustração e as partidas formam jornadas de até
  três palavras. Ao terminar, um resumo ilustrado e narrado permite parar ou continuar.
- O **Caderno de descobertas**, no menu, reúne as palavras de cada jogador, com imagem,
  pronúncia e opção de jogar novamente. O histórico existente é aproveitado.
- Em todos os modos o mundo é contínuo e, ao cumprir o objetivo, **surge um portal** à
  frente: a fase só termina ao entrar nele. Depois do objetivo nenhuma letra ou espinho
  tira coração no caminho até o portal.
- Em **Configurações**, o **nível de apoio** muda a partida seguinte: *assistido* (seta
  sobre a letra, instrução repetida, erro de leitura não tira coração), *padrão* (como
  sempre) ou *desafio* (mais letras, inclusive vizinhas no alfabeto). Também é possível
  ajustar voz/música/efeitos e ativar alto contraste, texto ampliado (também no HUD do
  jogo), redução de movimento (sem tremor, sucção ou flash no portal) ou cores adaptadas.
  O botão ♫ do HUD repete a instrução falada.
- Em celular/tablet os controles de toque aparecem automaticamente (detecção por
  `matchMedia('(pointer: coarse)')`); teclado e toque podem ficar ativos ao mesmo tempo
  (útil em notebooks conversíveis). Menus funcionam em retrato e paisagem; as atividades
  de movimento pausam em retrato e explicam como girar ou voltar ao menu.
- Ao abrir no navegador, o jogo oferece **tela cheia** e explica como sair. A escolha é
  opcional e volta a ser oferecida em uma nova abertura.
- Na primeira execução o jogo mostra um **aviso aos responsáveis** explicando que nome e
  progresso ficam só no aparelho (ver [10 — Privacidade](docs/10-privacidade-e-lgpd.md)).
- O som pode ser ligado/desligado no menu e na pausa (ver
  [02 — Gameplay](docs/02-gameplay-e-controles.md)).
- **Controle por celular**: no menu, "📱 Controle por celular" gera um QR code para parear
  um Android preso ao corpo da criança — ele detecta o gesto de pulo pelo acelerômetro,
  o personagem anda sozinho (auto-run) e o jogo pausa automaticamente se o celular
  desconectar (ver [12 — Controle por celular](docs/12-controle-por-celular.md)).

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

| Documento                                                                           | Assunto                                                                    |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [01 — Arquitetura](docs/01-arquitetura.md)                                          | Camadas, fluxo de dados, laço de jogo, cenas e estrutura                     |
| [02 — Gameplay e controles](docs/02-gameplay-e-controles.md)                        | Regras, vidas, movimento, progressão, modos e acessibilidade                |
| [03 — Abstração de input](docs/03-abstracao-de-input.md)                            | Teclado, toque, celular e caminho para ESP32 sem lógica de jogo no hardware |
| [04 — Modelo de conteúdo](docs/04-modelo-de-conteudo.md)                            | Schemas de currículo, fases, saves e palavras de referência                  |
| [05 — SOLID e padrões](docs/05-solid-e-padroes-de-projeto.md)                       | Onde cada princípio e padrão vive no código                                 |
| [06 — Estratégia de testes](docs/06-estrategia-de-testes.md)                        | O que é testado, como, testes de arquitetura e checklist de QA               |
| [07 — Plano por fases](docs/07-plano-de-desenvolvimento-fases.md)                   | Roadmap, fases implementadas (0–11) e próximas fases planejadas              |
| [08 — Evolução futura](docs/08-evolucao-futura.md)                                  | Pulo duplo, poderes, pacotes de voz e hardware ESP32                         |
| [09 — Glossário e convenções](docs/09-glossario-e-convencoes.md)                    | Termos pedagógicos, convenções de nomes e de código                          |
| [10 — Privacidade e LGPD](docs/10-privacidade-e-lgpd.md)                            | Quais dados o jogo guarda, consentimento parental e direitos                 |
| [11 — Mobile, PWA e deploy](docs/11-mobile-pwa-e-deploy.md)                         | Controles de toque, PWA/offline, build Docker e Nginx em produção            |
| [12 — Controle por celular](docs/12-controle-por-celular.md)                        | Sensor de pulo via acelerômetro, pareamento QR code e WebSocket              |
| [13 — Revisão UX e arquitetura](docs/13-revisao-ux-arquitetura.md)                  | Acessibilidade, histórico de UX e evolução de componentes                    |
| [14 — Plano app Android (Capacitor)](docs/14-plano-app-android-capacitor.md)        | Empacotamento híbrido com Capacitor para lojas Google Play e iOS             |
| [15 — Plano melhorias pós-streaming](docs/15-plano-melhorias-pos-streaming.md)      | Invariantes do mundo infinito, estabilidade e refinamentos pedagógicos       |
| [16 — Letras com palavras de referência](docs/16-plano-letras-com-palavras-de-referencia.md) | Narração pedagógica A–Z associando cada letra a uma palavra fixa      |

---

## Princípios do projeto

1. **Código em inglês, documentação e jogo em português.**
2. **SOLID**, com ênfase em Aberto/Fechado: conteúdo, balanceamento e fases são **dados**.
3. **Input abstraído desde o primeiro commit:** os adaptadores só traduzem
   eventos de hardware em ações semânticas. A regra do pulo vive **exclusivamente** em
   `src/gameplay/player/player-controller.ts` — nunca dentro de um evento de tecla ou
   toque. Isso é garantido por testes automáticos que falham se alguém violar a regra.
4. **Sem frameworks de jogo no motor:** apenas Canvas 2D, TypeScript e ES Modules, para
   manter a arquitetura clara e didática. React entra só na camada de UI em DOM
   (`src/ui/`) — outra regra automática garante que o motor nunca importe React.

```ts
// src/scenes/game-scene.ts — a única ponte entre entrada e gameplay
if (this.game.input.consumePressed(Actions.JUMP)) this.player.jump();

// src/gameplay/player/player-controller.ts — onde a decisão realmente acontece
private _tryBufferedJump(): void {
  const canJump = this.body.grounded || this._coyoteTimer > 0;
  if (this._jumpBufferTimer > 0 && canJump) this._performJump();
}
```

---

## Estrutura

```
src/
├── core/         laço de jogo, eventos, cenas, configuração
├── input/        ações semânticas, adaptadores (teclado, toque, composto), gerenciador
├── physics/      colisão AABB e motor de movimento
├── gameplay/     controlador do jogador, estados, vidas, fase, speed run
├── render/       canvas, câmera, sprites, HUD, efeitos
├── content/      currículo, fases, validação de resposta
├── persistence/  perfis, progresso e preferências no localStorage
├── audio/        gerenciador de música e efeitos
├── ui/           overlays de menu (ui/screens/*.tsx é React; menu.ts orquestra sem React)
├── styles/       CSS do tema, overlays e controles de toque
└── scenes/       boot, menu, game, victory

docs/             documentação completa em português
public/assets/    arte de produção (pixel art, WebP) — personagens, cenários, itens
public/fonts/     fonte pixel art self-hosted (OFL 1.1) + licença
public/icons/     ícones do PWA (gerados por tools/generate-pwa-icons.mjs)
tools/            gerador de fases e de ícones do PWA
docker/           configuração do Nginx (contêiner e proxy reverso da VPS)
imgs_referencia/  sprite sheet apenas para referência de medidas (não distribuída)
```

---

## Deploy

`npm run build` gera `dist/` com o app e o service worker do PWA. Em produção, o
`Dockerfile` empacota isso num contêiner Nginx **não-root**, com cabeçalhos de segurança e
hardening no `docker-compose.yml` (somente loopback, `read_only`, `cap_drop: ALL`). Um
Nginx na VPS (`docker/nginx-vps.conf`) faz proxy reverso com rate limiting e TLS via
`certbot`. Detalhes completos em [11 — Mobile, PWA e deploy](docs/11-mobile-pwa-e-deploy.md).

---

## Créditos e licenças

Este projeto foi inspirado em
[Aventura das Letras](https://github.com/samarameneses/aventura-das-letras), de Samara
Meneses (licença MIT). Daí em diante seguiu um caminho próprio, com outra proposta e
outras mecânicas. Os cenários, itens e objetos em `public/assets/` vêm
desse projeto e estão sob a licença MIT dela — ver
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Código do projeto. A imagem em `imgs_referencia/` é **apenas referência de proporções** e
**não deve ser distribuída** (arte de terceiros). A arte dos personagens e retratos em
`public/assets/` foi gerada por IA a partir de referências privadas da família — **não é
CC0 nem de terceiros licenciados**, é proprietária do projeto e não deve ser
redistribuída fora dele — ver
[09 — Glossário e convenções](docs/09-glossario-e-convencoes.md#7-licenças-e-procedência-de-arte).

A fonte **Silkscreen** (pixel art) é distribuída junto do jogo em `public/fonts/`, sob a
**SIL Open Font License 1.1** — o texto da licença acompanha os arquivos em
`public/fonts/OFL.txt`. Ela é *self-hosted* de propósito: o jogo não faz nenhuma
requisição a terceiros, o que mantém a política de privacidade simples (ver
[10](docs/10-privacidade-e-lgpd.md)).
