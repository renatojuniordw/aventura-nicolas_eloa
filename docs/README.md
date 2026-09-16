# Documentação — Aventura do Nicolas&Eloá (JS)

Jogo de plataforma 2D educativo, em português, feito em **JavaScript puro com Canvas 2D**.
O jogador corre e pula para coletar a letra, sílaba ou palavra pedida.

Esta pasta reúne toda a documentação necessária para entender, manter e evoluir o
projeto. O **código é escrito em inglês** (identificadores e comentários), a
**documentação e o texto do jogo são em português**.

---

## Como ler esta documentação

Se é a primeira vez no projeto, leia nesta ordem:

| #   | Documento                                                                  | Para quê serve                                                                        |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 01  | [Arquitetura](01-arquitetura.md)                                           | Camadas, fluxo de dados, laço de jogo, cenas e regras de dependência                  |
| 02  | [Gameplay e controles](02-gameplay-e-controles.md)                         | Regras do jogo: como se joga, vidas, acertos, erros, quedas                           |
| 03  | [Abstração de input](03-abstracao-de-input.md)                             | **Documento central**: teclado nunca contém lógica de jogo; como o ESP32 entra depois |
| 04  | [Modelo de conteúdo](04-modelo-de-conteudo.md)                             | Schemas JSON de fase e currículo, exemplos completos                                  |
| 05  | [SOLID e padrões de projeto](05-solid-e-padroes-de-projeto.md)             | Onde cada princípio vive no código e por quê                                          |
| 06  | [Estratégia de testes](06-estrategia-de-testes.md)                         | O que é testado, como e por quê; checklist de QA manual                               |
| 07  | [Plano de desenvolvimento por fases](07-plano-de-desenvolvimento-fases.md) | Roadmap com entregáveis e critérios de aceite                                         |
| 08  | [Evolução futura](08-evolucao-futura.md)                                   | Duplo pulo, poderes, som, toque e **adaptador ESP32**: onde cada um encaixa           |
| 09  | [Glossário e convenções](09-glossario-e-convencoes.md)                     | Termos pedagógicos, convenções de nomes e de código                                   |

## Mapa rápido: onde está cada coisa

| Quero mexer em...                               | Vá para                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Números do jogo (gravidade, velocidade, vidas)  | `src/core/config.js`                                                            |
| Quais teclas fazem o quê                        | `src/input/keyboard-keymap.js`                                                  |
| O que significa "pular"                         | `src/gameplay/player/player-controller.js`                                      |
| Regras de colisão e movimento                   | `src/physics/`                                                                  |
| O que o jogador vê                              | `src/render/`                                                                   |
| Textos e telas de menu                          | `src/ui/menu.js`                                                                |
| Conteúdo pedagógico (letras, sílabas, palavras) | `src/content/curriculum.json`                                                   |
| Fases (terreno e itens)                         | `src/content/levels/*.json` (gerados)                                           |
| Salvar/carregar progresso                       | `src/persistence/`                                                              |
| Plugar o ESP32                                  | `src/input/` — ver [03](03-abstracao-de-input.md) e [08](08-evolucao-futura.md) |

## Comandos do projeto

```bash
npm install            # instala as dependências de desenvolvimento
npm run dev            # servidor de desenvolvimento com recarga automática
npm test               # roda todos os testes (Vitest)
npm run test:watch     # testes em modo observador
npm run build          # gera a versão de produção em dist/
npm run preview        # serve a versão de produção
npm run generate:levels  # regenera as fases a partir do currículo
```

## Princípios que o projeto segue

1. **Código em inglês, documentação e jogo em português.**
2. **SOLID**, em especial Aberto/Fechado: conteúdo e balanceamento são dados, não código.
3. **Input abstraído desde o primeiro commit**: o listener de teclado só traduz tecla
   em ação semântica; a lógica de pulo vive exclusivamente no controlador do jogador.
   Isso é garantido por testes automáticos (ver [06](06-estrategia-de-testes.md)).
4. **Nada de frameworks de jogo**: só Canvas 2D e ES Modules, para manter a arquitetura
   visível e didática.
