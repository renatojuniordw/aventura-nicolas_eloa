# 06 — Estratégia de testes

**171 testes** em **21 arquivos**, rodando em menos de 1 segundo.

A estratégia é simples e deliberada: **testar lógica pura sem DOM** e ter **um** teste de
integração que prova que as peças se conectam.

```bash
npm test            # roda tudo uma vez
npm run test:watch  # modo observador durante o desenvolvimento
```

---

## 1. Filosofia

| Princípio                                    | Como aparece no projeto                                       |
| -------------------------------------------- | ------------------------------------------------------------- |
| Teste o que decide, não o que desenha        | Física, validação, input e migração são testados; desenho não |
| Injeção de dependência em vez de mock de DOM | `FakeAdapter`, `MemoryStorageAdapter`, `NullRenderer`         |
| Regras de arquitetura como testes            | `src/architecture.test.js`                                    |
| Um teste de integração, não vinte            | `src/integration.test.js` (jsdom), cobre o caminho completo   |
| Testes são documentação                      | Os nomes dos testes descrevem o comportamento esperado        |

Por que não testar renderização: um teste que só verifica "a função de desenhar foi
chamada" trava mudanças visuais sem pegar bug real. Preferimos concentrar a lógica em
módulos puros — que são a maioria — e deixar o desenho fino e burro.

---

## 2. Mapa de testes

| Arquivo                                     | Testes | O que garante                                                                |
| ------------------------------------------- | -----: | ---------------------------------------------------------------------------- |
| `core/event-bus.test.js`                    |      5 | Assinatura, cancelamento, `once`, remoção durante o despacho                 |
| `core/game-loop.test.js`                    |      6 | Timestep fixo: 0,5 s → 30 passos; 10 s → limitado a 5 e descarta o resto     |
| `core/scene-manager.test.js`                |      5 | `enter`/`exit` na ordem certa, evento de troca, cena inexistente             |
| `input/keyboard-keymap.test.js`             |      8 | Mapeamento por `code`, teclas não mapeadas, teclado remapeado                |
| `input/input-manager.test.js`               |      9 | "Segurado" vs "apertado uma vez", auto-repeat ignorado, troca de adaptador   |
| `physics/aabb.test.js`                      |      6 | Sobreposição de caixas, encostar ≠ sobrepor, caixa envolvente                |
| `physics/physics-engine.test.js`            |     10 | Gravidade, velocidade terminal, colisão nos 4 lados, plataforma de mão única |
| `gameplay/player/player-controller.test.js` |     12 | Pulo só no chão, tempo de coiote, buffer de pulo, pulo curto, transições     |
| `gameplay/lives-manager.test.js`            |      5 | Perda de coração, esgotamento anunciado uma vez, nunca negativo              |
| `gameplay/level-manager.test.js`            |      7 | Coleta única, perigo ao entrar, queda anunciada uma vez                      |
| `content/text-utils.test.js`                |      8 | Acentos, cedilha, caixa, espaços, entrada inválida                           |
| `content/answer-validator.test.js`          |      7 | Acerto, acento, variantes, rejeição de distratores                           |
| `content/level-loader.test.js`              |     12 | Defaults, conversão do mapa em retângulos, rejeição de fases malformadas     |
| `content/curriculum.test.js`                |     14 | 152 fases existem, 1 alvo por fase, distratores rejeitados, ids únicos       |
| `persistence/migration.test.js`             |      9 | Primeira execução, migração v0→v1, save corrompido, versão futura            |
| `persistence/persistence.test.js`           |     17 | Round-trip, melhores estrelas, isolamento entre perfis, liberação sequencial |
| `render/camera.test.js`                     |      6 | Conversão mundo→tela, limite de rolagem, suavização                          |
| `render/hud-model.test.js`                  |      5 | Corações, mensagem que aparece e desaparece                                  |
| `render/effects.test.js`                    |      5 | Partículas nascem, caem, morrem; desenho sem canvas real                     |
| `architecture.test.js`                      |      5 | **As regras de arquitetura** (ver seção 3)                                   |
| `integration.test.js`                       |     10 | **O jogo inteiro**, em jsdom (ver seção 4)                                   |

---

## 3. Testes de arquitetura (funcões de aptidão)

Estes cinco testes transformam decisões de design em algo que a suíte verifica sozinha.
Se alguém violar a regra no futuro, o teste falha e explica o porquê.

| Teste                                                                  | Regra que protege                                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `the input layer never depends on gameplay, physics, render or scenes` | Adaptadores de entrada não podem conhecer regras de jogo          |
| `keyboard listeners exist only inside the input layer`                 | Ninguém registra `keydown`/`keyup` fora de `src/input/`           |
| `physical key codes are handled only inside the input layer`           | `event.code` só existe no mapa de teclas                          |
| `the jump impulse is applied only by the player controller`            | `jumpVelocity` só aparece em `config.js` e `player-controller.js` |
| `semantic actions are never redefined outside actions.js`              | As ações têm uma única definição                                  |

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
- [ ] Espinhos (fase "Plataformas"): perdem um coração e voltam ao checkpoint.
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
| Grade da sprite sheet | Ao ligar a arte real, use as medidas de `render/atlas-meta.js` para conferir os recortes |
| Save inspecionável    | DevTools → Application → Local Storage → `joguinho.sobrinhos.v1`                         |
| Save corrompido       | Comparar com `joguinho.sobrinhos.v1.degraded`                                            |
| Reset de progresso    | Botão "Zerar progresso" no menu (ou apagar a chave no DevTools)                          |
