# Documentação — Aventura do Nicolas&Eloá

Jogo de plataforma 2D educativo, em português. O motor (laço de jogo, física, cenas,
gameplay) é **TypeScript puro com Canvas 2D**; a UI em DOM (menus, overlays, controles de
toque) é **React + TSX**. O jogador corre e pula para coletar a letra, sílaba ou palavra
pedida.

Esta pasta reúne toda a documentação necessária para entender, manter e evoluir o
projeto. O **código é escrito em inglês** (identificadores e comentários), a
**documentação e o texto do jogo são em português**.

---

## Como ler esta documentação

Se é a primeira vez no projeto, leia nesta ordem:

| #   | Documento                                                                  | Para quê serve                                                                        |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 01  | [Arquitetura](01-arquitetura.md)                                           | Camadas, fluxo de dados, laço de jogo, cenas e regras de dependência                  |
| 02  | [Gameplay e controles](02-gameplay-e-controles.md)                         | Regras do jogo: como se joga, vidas, acertos, erros, quedas, controles de toque       |
| 03  | [Abstração de input](03-abstracao-de-input.md)                             | **Documento central**: teclado e toque nunca contêm lógica de jogo; como o ESP32 entra depois |
| 04  | [Modelo de conteúdo](04-modelo-de-conteudo.md)                             | Schemas JSON de fase e currículo, exemplos completos                                  |
| 05  | [SOLID e padrões de projeto](05-solid-e-padroes-de-projeto.md)             | Onde cada princípio vive no código e por quê                                          |
| 06  | [Estratégia de testes](06-estrategia-de-testes.md)                         | O que é testado, como e por quê; checklist de QA manual                               |
| 07  | [Plano de desenvolvimento por fases](07-plano-de-desenvolvimento-fases.md) | Roadmap com entregáveis e critérios de aceite                                         |
| 08  | [Evolução futura](08-evolucao-futura.md)                                   | Duplo pulo, poderes, som e **adaptador ESP32**: onde cada um encaixa                   |
| 09  | [Glossário e convenções](09-glossario-e-convencoes.md)                     | Termos pedagógicos, convenções de nomes e de código                                   |
| 10  | [Privacidade e LGPD](10-privacidade-e-lgpd.md)                             | Quais dados o jogo guarda, onde ficam, consentimento parental e direitos              |
| 11  | [Mobile, PWA e deploy](11-mobile-pwa-e-deploy.md)                          | Controles de toque, instalação como PWA/offline, build Docker e Nginx em produção     |

## Planos específicos

- [16 — Letras com palavras de referência na narração](16-plano-letras-com-palavras-de-referencia.md): plano para falas como “Encontre a letra A de amigo”.

## Mapa rápido: onde está cada coisa

| Quero mexer em...                               | Vá para                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Números do jogo (gravidade, velocidade, vidas)  | `src/core/config.ts`                                                            |
| Quais teclas fazem o quê                        | `src/input/keyboard-keymap.ts`                                                  |
| Controles de toque (botões em tela)             | `src/input/touch-adapter.ts` + `src/ui/touch-controls.ts`                       |
| O que significa "pular"                         | `src/gameplay/player/player-controller.ts`                                      |
| Regras de colisão e movimento                   | `src/physics/`                                                                  |
| O que o jogador vê                              | `src/render/`                                                                   |
| Telas de menu (React)                           | `src/ui/screens/*.tsx`                                                          |
| Conteúdo pedagógico (letras, sílabas, palavras) | `src/content/curriculum.json`                                                   |
| Fases (terreno e itens)                         | `src/content/levels/*.json` (gerados)                                           |
| Salvar/carregar progresso                       | `src/persistence/`                                                              |
| Configuração do PWA (manifest, cache offline)   | `vite.config.js` (`VitePWA`) — ver [11](11-mobile-pwa-e-deploy.md)              |
| Build/deploy em produção (Docker, Nginx)        | `Dockerfile`, `docker-compose.yml`, `docker/` — ver [11](11-mobile-pwa-e-deploy.md) |
| Plugar o ESP32                                  | `src/input/` — ver [03](03-abstracao-de-input.md) e [08](08-evolucao-futura.md) |

## Comandos do projeto

```bash
npm install               # instala as dependências de desenvolvimento
npm run dev                # servidor de desenvolvimento com recarga automática
npm test                   # roda todos os testes (Vitest)
npm run test:watch         # testes em modo observador
npm run typecheck          # checa os tipos TypeScript (tsc --noEmit)
npm run build               # gera a versão de produção em dist/ (inclui o PWA)
npm run preview             # serve a versão de produção
npm run generate:levels     # regenera as fases a partir do currículo
npm run generate:pwa-icons  # regenera os ícones do PWA
```

## Princípios que o projeto segue

1. **Código em inglês, documentação e jogo em português.**
2. **SOLID**, em especial Aberto/Fechado: conteúdo e balanceamento são dados, não código.
3. **Input abstraído desde o primeiro commit**: cada adaptador só traduz um evento de
   hardware (tecla ou toque) em ação semântica; a lógica de pulo vive exclusivamente no
   controlador do jogador. Isso é garantido por testes automáticos (ver
   [06](06-estrategia-de-testes.md)).
4. **Nada de frameworks de jogo no motor**: só Canvas 2D, TypeScript e ES Modules, para
   manter a arquitetura visível e didática. React entra só na camada de UI
   (`src/ui/`), atrás da mesma fronteira testada automaticamente.
