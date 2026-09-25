# 02 — Gameplay e controles

Regras do jogo, controles e fluxo de uma partida. Tudo que está aqui é regra de
comportamento; os números exatos vivem em `src/core/config.ts` (ver
[01 — Arquitetura](01-arquitetura.md#8-configuração-central)).

---

## 1. A ideia do jogo

O jogador escolhe um personagem e atravessa uma fase de plataforma 2D. No topo da tela
aparece **o que ele precisa procurar** — uma letra, uma sílaba ou uma palavra. Espalhados
pela fase existem vários itens; **um deles é a resposta certa** e os outros são distratores.

- **Coletar o item certo** → comemoração (confete). Ao coletar o último item da fase, o **portal** surge à frente; a fase só termina quando o jogador **entra no portal** (efeito de sucção, explosão de confete e flash).
- **Coletar um item errado** → o jogador perde um coração e continua procurando.
- **Margem de coleta**: cada item aceita toque com `GAMEPLAY.itemPickupMargin` (12 px)
  ao redor, para que um pulo curto (toque rápido) ainda alcance o item.
- **Cair em um buraco** → o jogador volta ao *checkpoint* **sem perder coração**.

O mundo é **infinito** (`world-stream.ts`): trechos dos 4 cenários-modelo são gerados sob demanda,
sempre à frente do jogador. Só existe **um alvo vivo por vez**; se o jogador passa direto sem
pegar, o alvo é retirado e **reaparece adiante** (fora da tela), com outras letras no meio. O
alvo é sempre posicionado onde um toque rápido no pulo o alcança (`isTapReachable`, conferido
também com a física real nos testes), e os distratores excluem a letra atual e suas vizinhas no
alfabeto (corrida) ou as letras da palavra (explorar). O *checkpoint* acompanha o trecho em que o
jogador está.

Invariantes do mundo contínuo (cobertos por `world-stream.test.ts`):

- **Memória limitada**: só ficam em memória 2 trechos atrás do jogador, o trecho atual e 2 à
  frente. Trechos mais antigos são descartados e uma parede fecha o mundo ali; a câmera não
  mostra além dela (`camera.minX`). Os IDs coletados saem junto (`LevelManager.pruneCollected`).
- **Distratores coerentes**: quando o alvo muda (corrida), letras espalhadas para um alvo
  anterior que o novo alvo proíbe — inclusive a própria resposta — são retiradas, com um
  "puf" discreto quando visíveis. Nenhum rótulo de distrator vale como resposta.
- **Alvo sempre disponível**: se não há posição livre, o alvo toma a posição mais próxima
  adiante (retirando o distrator dela); se não houver posição alguma, é oferecido de novo no
  quadro seguinte. A extensão do mundo por tentativa é limitada.
- **Chegada ao portal**: ao cumprir o objetivo, todas as letras restantes somem, o mundo é
  cortado dentro da área visível da câmera e surge um chão plano com o portal. Depois disso
  coletas são ignoradas e espinhos só devolvem ao checkpoint (sem coração). O portal só aceita
  a entrada depois de crescer por completo, e abrir de novo não muda nada.

### Modos

| Modo (menu) | Objetivo | Fim |
|---|---|---|
| Começar/Continuar aventura (Aprender) | A letra, sílaba ou palavra da lição atual do currículo | Portal após o acerto |
| Corrida do alfabeto | A a Z em sequência, cronometrado | Portal após o Z; o tempo para ao entrar no portal |
| Explorar | Montar uma palavra, letra por letra (quadro de letras no topo) | Portal após a última letra |

### Nível de apoio (Configurações)

Lido ao entrar na fase (`src/gameplay/support-policy.ts`). Ajuda pedagógica fica separada da
dificuldade motora: espinhos e quedas se comportam igual em todos os níveis.

| | Assistido | Padrão | Desafio |
|---|---|---|---|
| Erro de leitura tira coração | Não | Sim | Sim |
| Seta sobre a letra e aviso na borda quando fora da tela | Sim | Não | Não |
| Instrução repetida sozinha após 10 s sem progresso | Sim | Não | Não |
| Voz diz a próxima letra (Explorar) | Sim | Sim | Não |
| Distratores por trecho | 2 | 3 | 4 |
| Vizinhas no alfabeto como distratores (corrida) | Não | Não | Sim |

O botão ♫ do HUD repete a instrução em qualquer nível.

Toda instrução falada “Encontre a letra…” (início da fase, botão ♫, repetição assistida e
avanço da Corrida) inclui uma palavra fixa que começa com a letra, em todos os níveis de apoio:
“Encontre a letra a de avião”. A palavra vem de `src/content/letter-reference-words.json`
(ver [04 — Modelo de conteúdo](04-modelo-de-conteudo.md)). Sílabas, palavras, o “Agora a
letra…” do Explorar e o feedback de erro não mudam.

O objetivo pedagógico é reconhecer letras, sílabas e palavras — então errar não deve ser
punitivo a ponto de travar a criança, e cair não deve ser punição nenhuma.

---

## 2. Controles

| Ação | Teclado | Toque | Ação semântica |
|---|---|---|---|
| Andar para a esquerda | `←` ou `A` | Botão ◀ | `moveLeft` |
| Andar para a direita | `→` ou `D` | Botão ▶ | `moveRight` |
| Pular | `Espaço`, `↑`, `W` ou `Z` | Botão de pulo | `jump` |
| Pausar / continuar | `Esc` ou `P` | Botão de pausa no HUD | `pause` |
| Confirmar (menus) | `Enter` ou `J` | Toque no botão | `confirm` |
| Voltar / cancelar | `Backspace` ou `Y` | Toque no botão | `back` |
| Mostrar hitboxes (depuração) | `F2` | — | `debug` |
| Poder 1 / Poder 2 | `E` / `Q` | — | `power1` / `power2` — **reservados**, sem efeito nesta versão |

O mapeamento do teclado vive em `src/input/keyboard-keymap.ts` e usa **posição física da
tecla** (`event.code`), não o caractere produzido. Assim funciona igual em teclado ABNT2
e US, e não quebra com acentos ou teclas mortas.

Os controles de toque são três botões fixos na tela (`src/ui/touch-controls.ts`),
traduzidos em ações pelo `TouchAdapter` (`src/input/touch-adapter.ts`) via Pointer Events
— por isso também funcionam com mouse/caneta, não só com o dedo. Eles aparecem
automaticamente em dispositivos com `matchMedia('(pointer: coarse)')` verdadeiro; em
notebook com tela de toque, teclado e toque ficam ativos **ao mesmo tempo** (ver
[03 — Abstração de input](03-abstracao-de-input.md#8-um-segundo-adaptador-já-em-produção-o-toque)).
Em telas de toque o jogo é **somente paisagem**: um aviso pede para girar o aparelho se
estiver em retrato (ver [11 — Mobile, PWA e deploy](11-mobile-pwa-e-deploy.md)).

> Estes controles são *intenção*, não *hardware*. Um adaptador de ESP32 pode emitir as
> mesmas ações sem alterar uma linha do jogo — ver [03 — Abstração de input](03-abstracao-de-input.md).

---

## 3. Vidas e feedback

- A criança começa com **3 corações**.
- **Acerto**: confete e mensagem "Muito bem! Você encontrou!"; no último acerto surge o portal, e a fase termina ao entrar nele.
- **Erro**: perde 1 coração, uma explosão de partículas vermelhas e a mensagem
  `Ops! Esse era "X". Procure "Y".` — a mensagem **ensina** em vez de só punir.
- **Queda em buraco**: **não** custa coração; volta ao checkpoint.
- **Espinhos**: custam 1 coração ("Ai! Cuidado!") e devolvem ao checkpoint — exceto depois de
  cumprido o objetivo, quando só devolvem.
- **Sem corações**: tela de "Acabaram os corações", com opções de tentar de novo ou ir ao menu.
- Depois de vitória ou derrota nenhuma colisão tem efeito (a cena fecha os estados terminais).

### Acessibilidade na partida

- **Movimento reduzido** (sistema ou jogo): sem tremor de câmera, sem sucção e sem flash branco
  no portal — o personagem apenas entra e a fase fecha.
- **Texto ampliado** e **alto contraste** também valem para o HUD desenhado no Canvas; textos
  longos encolhem para caber em vez de cortar.
- Objetivo e mensagens de acerto/erro são repetidos numa região ARIA *live* (`ui/live-announcer.ts`)
  para leitores de tela, sem repetir a mesma frase a cada quadro. A navegação espacial em si
  **não** foi validada com leitor de tela.
- O banner de feedback começa com ✔ ou ✖, para não depender só da cor.

O jogo é generoso de propósito: se errar apaga o progresso da fase, a criança desiste.
A dificuldade vem do reconhecimento, não da punição.

---

## 4. Movimento do personagem

O controle foi ajustado para ser **previsível e tolerante**:

- **Andar**: velocidade constante no chão; para imediatamente ao soltar a tecla.
- **No ar**: controle reduzido (75% da velocidade), e o momento horizontal é mantido se
  não houver entrada — assim um pulo para frente continua para frente.
- **Pulo com altura variável**: segurar a tecla mantém o pulo alto; soltar cedo encurta
  o arco. Isso dá controle fino sem exigir precisão.
- **Tempo de coiote** (0,1 s): pular logo depois de sair da borda ainda funciona. É o
  ajuste que faz a criança sentir que "o jogo entendeu".
- **Buffer de pulo** (0,1 s): apertar o pulo um pouco *antes* de aterrissar guarda a
  intenção e o pulo acontece ao tocar o chão.
- **Pulo duplo não existe nesta versão** — e há teste garantindo isso. A arquitetura,
  porém, já permite adicioná-lo como um novo estado (ver [08](08-evolucao-futura.md)).

---

## 5. Estrutura de uma fase

Cada fase é um arquivo JSON (ver [04 — Modelo de conteúdo](04-modelo-de-conteudo.md)) com:

- **Terreno sólido** e **plataformas de mão única** (dá para passar por baixo e pousar em cima).
- **Itens**: exatamente 1 alvo e até 3 distratores, posicionados em plataformas ou no chão.
- **Buraco**: em algumas fases, uma fenda no chão (custa só o retorno ao checkpoint).
- **Checkpoint**: onde o jogador reaparece depois de cair.

As fases são montadas a partir de **4 templates de terreno** (`planície`, `degraus`,
`plataformas`, `rio`), alternados entre as lições para dar variedade sem exigir trabalho
manual. Ver o gerador em `tools/generate-levels.mts`.

---

## 6. Fluxo de uma partida

```
Boot
 └─► Menu principal
      ├─ escolher/criar jogador
      ├─ trocar personagem (4 opções)
      ├─ escolher fase (somente as liberadas)
      └─ Jogar ──► próxima lição não concluída
                    │
                    ▼
                 Fase (game)
                    ├─ Esc ──► Pausa ──► continuar / recomeçar / menu
                    ├─ erros ──► perde coração ──► 0 corações ──► Game Over
                    └─ acerto ──► comemoração ──► Vitória
                                                    ├─ Próxima fase
                                                    ├─ Jogar de novo
                                                    └─ Menu
```

Há **pausa automática** ao trocar de aba ou minimizar a janela: o input é limpo (nenhuma
tecla fica presa) e o jogo pausa sozinho.

---

## 7. Progressão e recompensa

- Cada lição concluída é marcada como feita no perfil do jogador.
- **Estrelas** premiam a precisão:
  - 3 estrelas → nenhum erro
  - 2 estrelas → 1 erro
  - 1 estrela → 2 erros ou mais
- Se a criança refizer uma fase e for melhor, o **melhor resultado é mantido** (estrelas
  nunca diminuem).
- As lições são **liberadas em sequência**: sempre há as concluídas mais a próxima.
- Cada jogador tem seu próprio progresso — irmãos podem compartilhar o aparelho sem
  sobrescrever um ao outro (ver [04](04-modelo-de-conteudo.md#5-persistência)).

---

## 8. Conteúdo disponível

**16 unidades** e **152 lições** nesta versão:

| Unidade | Lições | Exemplos |
|---|---|---|
| Alfabeto | 26 | A, B, C, … Z |
| Famílias silábicas (B, C, D, F, G, L, M, P, S, T, V) | 55 | BA BE BI BO BU; CA CO CU CE CI |
| Dígrafos | 3 | CH, LH, NH |
| Encontros consonantais | 14 | BR, CR, DR, FL, GL, PL, TR, VR |
| Palavras de uma sílaba | 24 | SOL, MAR, PÉ, PÃO, FLOR, LUZ |
| Palavras de duas sílabas | 30 | BOLA, CASA, MAMÃE, GATO, VOVÓ |

O conteúdo é **dado**, não código: acrescentar uma palavra é editar
`src/content/curriculum.json` e rodar `npm run generate:levels`. Nada de programar.

A arte de produção (personagens, cenários, itens) já está em `public/assets/` — ver
[09 — Glossário e convenções](09-glossario-e-convencoes.md#7-licenças-e-procedência-de-arte).

---

## 9. Acessibilidade e cuidado com a criança

- Todo o texto do jogo está em português e em linguagem simples.
- A comparação de respostas **ignora acentos e maiúsculas**: `MAMÃE` = `mamae` = `Mamãe`.
- Menus são navegáveis por clique **e** por teclado (`Enter` confirma, `Backspace` volta).
- Botões do menu não roubam o foco do jogo, então o teclado continua funcionando depois
  de qualquer clique.
- Errar sempre traz uma mensagem didática (`Esse era "E". Procure "A".`), nunca só um "errou".
