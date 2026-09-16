# 07 — Plano de desenvolvimento por fases

Roadmap do projeto, com entregáveis e critérios de aceite. As fases 0 a 4 estão
**concluídas** nesta versão; a fase 5 é o próximo passo.

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

**Entregáveis:** os 10 documentos em `docs/`, em português.

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
- `main.js` como composition root.
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
- `curriculum-model.js` expandindo pools em lições (compartilhado com o gerador).
- `tools/generate-levels.mjs` com 4 templates de terreno.
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

## Fase 5 — Polimento e arte 🔜

**Objetivo:** transformar o esqueleto funcional em um jogo bonito e agradável.

**Tarefas**

1. **Arte original.** Substituir as formas provisórias por pixel art própria (ou CC0).
   Os pontos de troca são `render/sprites.js` e `render/atlas-meta.js`. A sprite sheet em
   `imgs_referencia/` serve **apenas** para medir proporções — é arte estilo Mario e não
   pode ser distribuída.
2. **Animações.** `idle`, `andar`, `pular`, `cair` ligadas aos estados do jogador.
   O mapeamento de pose já existe em `atlas-meta.js` (`POSE_BY_STATE`).
3. **Som.** Efeitos de pulo, coleta, acerto, erro e uma trilha por unidade. O lugar
   natural é um `SoundManager` inscrito nos mesmos eventos do `EventBus`
   (`item.collected`, `answer.correct`, `level.complete`).
4. **Sensação de jogo.** Ajuste fino de gravidade, altura de pulo e velocidade em
   `config.js` com uma criança testando de verdade.
5. **Qualidade de vida.** Contagem de fases concluídas no HUD; tela de escolha de fase
   agrupada por unidade; botão de repetir áudio do objetivo.

**Critérios de aceite**

- Uma criança joga uma lição completa sem ajuda e sem erro no console.
- Cada estado do jogador tem uma animação correspondente.
- Existe som para acerto, erro, pulo e vitória, com opção de silenciar.
- Arte com licença documentada em `docs/09`.

---

## Fase 6 — Hardware: ESP32 💡

**Objetivo:** controlar o jogo com sensores e botões físicos.

Seguir o roteiro de [03 — Abstração de input](03-abstracao-de-input.md#7-como-plugar-o-esp32-no-futuro-o-caminho-exato).

**Tarefas**

1. Definir o protocolo de mensagens (`{ "button": "jump", "pressed": true }`).
2. Firmware no ESP32 enviando por BLE ou Web Serial.
3. `src/input/esp32-adapter.js` implementando `InputAdapter`.
4. Trocar uma linha em `main.js`.
5. Tela de conexão/estado do dispositivo.

**Critérios de aceite**

- Nenhum arquivo de gameplay, física ou render foi alterado.
- Os testes existentes continuam passando sem modificação.
- Dá para jogar usando apenas o hardware.

---

## Fase 7 — Ideias de longo prazo 💡

- **Pulo duplo** como novo `PlayerState` (ver [08](08-evolucao-futura.md)).
- **Poderes `E`/`Q`**: as ações já estão reservadas no vocabulário de entrada.
- **Modo dois jogadores** na mesma tela.
- **Relatório para pais/professores**: quais letras a criança mais erra.
- **Síntese de voz** para ler o objetivo em voz alta (apoio à alfabetização).
- **Editor de fases** reaproveitando o `level-loader` como validador.
- **Controles por toque** para tablet: eventos de ponteiro emitindo as mesmas ações.

---

## Convenções de trabalho

| Prática | Regra |
|---|---|
| Antes de commitar | `npm test` e `npm run build` passando |
| Mudou conteúdo | Rodar `npm run generate:levels` e commitar as fases |
| Mudou regra de jogo | Atualizar `docs/02` e o teste correspondente |
| Mudou arquitetura | Atualizar `docs/01`/`docs/05`, e o teste de arquitetura se aplicável |
| Novo número de balanceamento | Vai para `config.js`, nunca solto no código |
| Novo conteúdo pedagógico | Vai para `curriculum.json`, nunca em código |
