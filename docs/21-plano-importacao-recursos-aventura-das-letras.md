# 21 — Plano de aproveitamento e importação de recursos de Aventura das Letras

Data: **28/09/2026**. Estado: **etapas 1 a 4 implementadas (§9 e §10)**; da etapa 5, os testes com mecânica equivalente foram traduzidos e as mecânicas novas seguem no plano 20.

## 1. Escopo e base da análise

Complementar o [plano 20](20-plano-melhorias-referencia-aventura-das-letras.md) com um inventário concreto de arquivos aproveitáveis, instruções de download manual, destinos propostos e etapas de integração. Preservar Nicolas e Eloá, TypeScript/Canvas, UI React e funcionamento PWA. O primeiro recorte do plano 20 já consta no código local: mundos, palavras temáticas e dicas progressivas; não refazê-lo.

Referência inspecionada: cópia local já disponível de [Aventura das Letras, revisão `bbcd9eb37244f54c4b011081977f254da4f62d82`](https://github.com/samarameneses/aventura-das-letras/tree/bbcd9eb37244f54c4b011081977f254da4f62d82), especialmente `game/`. Os links abaixo fixam essa revisão para evitar mudanças silenciosas em `main`. O README público também foi consultado. Não houve execução do Godot, audição dos WAV ou avaliação visual dos PNG; qualidade sonora e adequação visual continuam como critérios de aceite.

Base local: README, DESIGN, índice de docs, gameplay, plano 20, `src/audio/`, `src/scenes/game-scene.ts`, `src/render/asset-plan.ts`, `src/content/`, `vite.config.js` e arquivos de `public/`. Consideradas as alterações já presentes no workspace, sem modificá-las.

## 2. Resultado da comparação

| Recurso verificado | Situação e valor para nosso projeto | Decisão |
| --- | --- | --- |
| Dois efeitos WAV de resposta | Arquivos pequenos; temos gerenciador de áudio, mas nenhum registro/chamada de SFX nas cenas consultadas | **Primeira entrega**: acerto e tentativa incorreta |
| Narração | Referência usa TTS do sistema em `main.gd`; aqui usamos `speechSynthesis` | Aproveitar textos e revisar pronúncia; não existe pacote de falas em `game/audio/` |
| Música ambiente | Não encontrada na pasta de áudio inspecionada | Produção/seleção futura, sem download atribuído à referência |
| Cinco fundos, letra, checkpoint e chegada | Já há equivalentes WebP locais, catalogados em `asset-plan.ts` | Reutilizar os arquivos locais; não duplicar PNG |
| Textura `grass.png` | Não consta no catálogo local; referência a usa para desenhar plataformas | Piloto visual posterior, sem alterar colisões |
| `speed.png` | Existe, mas não foi encontrada referência ao arquivo nos scripts consultados | Baixa prioridade; examinar imagem antes de decidir uso como ícone |
| 100 palavras dissílabas segmentadas | Dados editáveis, com grupos temáticos | Selecionar lacunas e adaptar ao nosso modelo |
| Instruções, pronúncias e pistas | Campos `spoken`, `hint`, `example`, `options` do currículo original | Revisão editorial e integração pontual |
| Terrenos, poderes, efeitos e testes Godot | Implementação específica de outro motor | Portar conceitos e casos de teste; não copiar para execução direta |
| Personagens e animações originais | Não representam Nicolas e Eloá; atlas usa recortes próprios | Manter elenco local; usar metadados só como referência técnica |

**Divergências verificadas:** o README local aponta para `THIRD_PARTY_NOTICES.md`, mas esse arquivo não existe no workspace inspecionado. A cópia de `08-evolucao-futura.md` no Obsidian menciona sons procedurais via Web Audio; isso não foi confirmado no código de áudio atual, que usa `Audio` com URLs registradas. Planejar a integração a partir do código. Nenhuma nota do vault foi alterada.

## 3. Primeira entrega: sons de acerto e erro

### 3.1 Arquivos e download manual

Não é necessário instalar ou exportar pelo Godot. Baixar os WAV originais e manter os nomes. No GitHub, abrir o arquivo e usar **Download raw file**; os links diretos abaixo também permitem salvar o binário. Não salvar a página HTML.

| Arquivo e download direto | Destino relativo à raiz deste projeto | Metadados verificados |
| --- | --- | --- |
| [answer_success.wav](https://raw.githubusercontent.com/samarameneses/aventura-das-letras/bbcd9eb37244f54c4b011081977f254da4f62d82/game/audio/answer_success.wav) | `public/assets/audio/sfx/answer_success.wav` | 18.564 bytes; 0,42 s |
| [answer_error.wav](https://raw.githubusercontent.com/samarameneses/aventura-das-letras/bbcd9eb37244f54c4b011081977f254da4f62d82/game/audio/answer_error.wav) | `public/assets/audio/sfx/answer_error.wav` | 12.392 bytes; 0,28 s |

Ambos são WAV PCM, mono, 22.050 Hz, 16 bits; total **30.956 bytes (~30,2 KiB)**. Manter WAV no primeiro lote: conversão acrescentaria trabalho com ganho pequeno. A pasta de destino será criada na etapa de importação; colocá-los nela ainda não ativa o som.

Hashes SHA-256 para conferir downloads idênticos à revisão analisada:

```text
answer_success.wav  738b6d1c1da6272cf1896e1bbc540fabd550457db3cae677e8f14fd072466c83
answer_error.wav    6e6c05dc97025aec21f53899aaaa4a434de25a07514053cd395cb0af5f43b1f7
```

Verificação opcional no macOS, após o download:

```bash
shasum -a 256 public/assets/audio/sfx/answer_success.wav public/assets/audio/sfx/answer_error.wav
```

### 3.2 Integração proposta

1. Registrar chaves semânticas, por exemplo `answer-success` e `answer-error`, no `AudioManager`, durante a inicialização. As URLs de execução começam em `/assets/audio/sfx/`, sem `public/`.
2. Conectar as chaves aos fluxos `_handleCorrectAnswer` e `_handleWrongAnswer` de `GameScene`. Acerto toca uma vez por resposta aceita nos modos Aprender, Explorar e Corrida. Erro toca uma vez por resposta incorreta, inclusive quando o apoio assistido dispensa perda de coração. Queda, perigo e portal não devem reutilizar esse som automaticamente.
3. Conciliar efeitos com elogio e próxima instrução falada. Ouvir ambos antes de definir volume relativo; o original usa `volume_db = -6`, mas essa propriedade do Godot não deve ser copiada como valor de volume HTML.
4. Respeitar mudo e volume de efeitos; mudanças de volume/mudo devem alcançar também efeitos em reprodução. Hoje `playSfx` cria um `Audio` sem guardá-lo, e `_applyToCurrent` só atualiza música: prever rastreamento e limpeza dos efeitos ativos.
5. Definir cancelamento ao sair da cena, pausar ou esconder o app; impedir sobreposição excessiva. Falha de reprodução não pode interromper a resposta ou o progresso. Validar o desbloqueio na primeira interação real, pois o método atual usa um elemento sem fonte e não comprova reprodução dos WAV em aparelho.
6. Incluir `wav` nos padrões de precache em `vite.config.js`. Hoje os padrões incluem código, imagens e fontes, **não áudio**. Conferir entradas dos dois arquivos no service worker gerado e testar reprodução offline após instalação do cache.

**Aceite:** um efeito por resposta; silêncio com mudo/volume zero; voz inteligível; ausência de sons antigos após sair/pausar; reprodução em desktop, Android e iPhone alvo; jogo funcional se o áudio falhar. Testar a primeira interação e o retorno do segundo plano, inclusive ao jogar com celular como controle — o áudio pertence à tela do jogo.

## 4. Arte: o que exportar e o que já foi aproveitado

### 4.1 Mapeamento dos recursos existentes — sem novo download

Origem na [pasta `game/art`](https://github.com/samarameneses/aventura-das-letras/tree/bbcd9eb37244f54c4b011081977f254da4f62d82/game/art). Equivalência identificada por nomes e catálogo; não foi feita comparação pixel a pixel entre PNG e WebP.

| Origem em `game/art/` | Destino local existente |
| --- | --- |
| `garden.png` | `public/assets/backgrounds/garden-pixel-v1.webp` |
| `primavera-pomar.png` | `public/assets/backgrounds/primavera-pomar-pixel-v1.webp` |
| `primavera-lago.png` | `public/assets/backgrounds/primavera-lago-pixel-v1.webp` |
| `outono-bosque.png` | `public/assets/backgrounds/outono-bosque-pixel-v1.webp` |
| `outono-vale.png` | `public/assets/backgrounds/outono-vale-pixel-v1.webp` |
| `letter.png` | `public/assets/items/letter-carrier-pixel-v1.webp` |
| `checkpoint.png` | `public/assets/objects/checkpoint-pixel-v1.webp` |
| `finish.png` | `public/assets/objects/finish-portal-pixel-v1.webp` |

Melhoria: associar os fundos e suas paletas aos mundos já implementados, conforme L3 do plano 20. O benefício virá da composição e seleção, sem aumentar o pacote de imagens com duplicatas.

### 4.2 Novos candidatos

| Download | Destino de avaliação proposto | Exportação e integração futura |
| --- | --- | --- |
| [grass.png](https://raw.githubusercontent.com/samarameneses/aventura-das-letras/bbcd9eb37244f54c4b011081977f254da4f62d82/game/art/grass.png) | `imports/aventura-das-letras/game/art/grass.png` | Inspecionar o PNG de 1254×1254, 939.893 bytes; exportar derivado WebP para `public/assets/terrain/grass-pixel-v1.webp`, com dimensões adequadas ao desenho real |
| [speed.png](https://raw.githubusercontent.com/samarameneses/aventura-das-letras/bbcd9eb37244f54c4b011081977f254da4f62d82/game/art/speed.png) | `imports/aventura-das-letras/game/art/speed.png` | PNG de 1254×1254, 347.871 bytes; se aprovado visualmente, exportar `public/assets/items/speed-pixel-v1.webp` para eventual poder |

`imports/` é uma pasta proposta de trabalho, fora de `public/`; ainda não foi criada nem configurada no `.gitignore`. Antes de adicionar originais volumosos, decidir se serão versionados ou guardados fora do repositório. Só derivados aprovados entram no pacote público.

Para exportar imagens: abrir o PNG em editor com suporte a WebP, preservar transparência, iniciar com WebP sem perdas e comparar em escala de jogo. Se houver redução de pixel art, avaliar vizinho mais próximo e evitar suavização indevida. Registrar tamanho antes/depois; não estabelecer dimensão final sem inspecionar a arte.

A textura `grass.png` não é um tileset convencional confirmado: `world.gd` recorta a imagem para a superfície e o preenchimento das plataformas. Adaptar o desenho em `src/render/`, registrar a arte em `asset-plan.ts` e testar emendas, bordas e contraste. Colisões permanecem definidas pela geometria. Água, pontes móveis e lava demandam regras próprias do plano 20; a textura não entrega essas mecânicas.

**Aceite:** aparência coerente com DESIGN, letras legíveis, plataformas sem emendas visíveis e sem custo excessivo de memória/frame. `speed.png` só entra quando existir uso definido; não baixar preventivamente todo o elenco ou todos os masters de `assets/`.

## 5. Conteúdo pedagógico: importar dados com adaptação

### 5.1 Arquivos e destinos

Usar **Raw → salvar arquivo** nos links abaixo e preservar UTF-8. Guardar as cópias para análise, sem substituir nossos JSON.

| Origem | Cópia de trabalho proposta | Destino após seleção/adaptação |
| --- | --- | --- |
| [disyllables.json](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/content/disyllables.json) | `imports/aventura-das-letras/game/content/disyllables.json` | `src/content/curriculum.json`, `src/content/syllables.ts`; quando houver ilustração, também `word-bank.ts` e catálogo de imagens |
| [curriculum.json](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/content/curriculum.json) | `imports/aventura-das-letras/game/content/curriculum.json` | Campos editoriais selecionados no modelo local; textos de narração e pistas |
| [activities.json](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/content/activities.json) | `imports/aventura-das-letras/game/content/activities.json` | Apenas referência de atividades; não importar automaticamente |

### 5.2 Transformação proposta

1. Ler `groups[].words` de `disyllables.json`: `BO-LA` vira palavra `BOLA` e segmentação `['BO', 'LA']`. Preservar acentos e revisar segmentação e sentido antes de publicar.
2. Comparar com todos os `pool` do currículo e os `label` de `word-bank.ts`. Na comparação literal atual, **67 das 100 palavras não aparecem nessa união**; isso mede ausência de entradas nesses dois catálogos, não ausência em todos os textos do jogo nem aprovação pedagógica.
3. Primeiro lote sugerido: PORTA, PRATO, GARFO, POTE, LIVRO, CAIXA, BOCA, NARIZ, LEITE e NUVEM. São candidatas ausentes; revisar adequação e imagens antes de decidir a lista final. Evitar repetir as 20 palavras temáticas já entregues no plano 20.
4. Mapear temas para unidades existentes ou novas com IDs estáveis. Preservar IDs e ordem das lições antigas para manter progresso. Gerar fases pelo comando local `npm run generate:levels`; não copiar coordenadas `x`, comprimentos de fase ou checkpoints do currículo Godot para o nosso stream.
5. Para Explorar, cada entrada também precisa de `id`, `label`, `fact`, categoria local e imagem/fallback explícito. Os temas do original não são todos categorias válidas em `WordCategory`. A pasta `game/art/` inspecionada não oferece um conjunto de ilustrações individuais dessas 100 palavras; essa produção fica como tarefa separada.
6. Aproveitar `spoken`, `hint` e `example` como referências editoriais. Revisar “nome da letra” versus fonema e preservar as associações próprias de `letter-reference-words.json`. Testar pronúncias no dispositivo; texto “bê” não é um áudio gravado nem deve substituir a letra visual B.
7. `activities.json` contém quatro exemplos, incluindo quantidade de estrelas. O tipo `quantity` não é uma modalidade local pronta: mantê-lo fora do primeiro lote, como possível expansão futura.

**Aceite:** nenhuma duplicata indevida, sílabas revisadas, saves antigos preservados, distratores válidos, fases alcançáveis e imagens sem referências quebradas. Não importar `curriculum.json` inteiro sobre o arquivo local: schemas e organização diferem.

## 6. Código, animações e testes: aproveitar como referência

Os arquivos desta seção podem ser lidos diretamente no GitHub. Se for útil guardar cópias, usar `imports/aventura-das-letras/game/` mantendo os subdiretórios. Não colocar GDScript em `src/` esperando execução pelo navegador.

| Fonte na referência | Aproveitamento e destino local futuro |
| --- | --- |
| [answer_effects.gd](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/scripts/answer_effects.gd) | Sincronização de som/feedback; ajustar `src/render/effects.ts` apenas se necessário, pois já há confetes e redução de movimento |
| [adventure_terrain.gd](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/scripts/adventure_terrain.gd) e [world.gd](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/scripts/world.gd) | Catálogo de terrenos e composição; adaptar em `src/gameplay/stream-courses.ts`, `world-stream.ts` e render conforme plano 20 |
| [powers.gd](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/scripts/powers.gd) | Referência para luz/tartaruga; implementação TypeScript posterior, com pausa e recarga testadas |
| [animations.json](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/art/animations.json) | Exemplo de retângulos por frame e escala de referência; não serve diretamente para nossas folhas, que usam grades em `atlas-meta.ts` |
| [tests/](https://github.com/samarameneses/aventura-das-letras/tree/bbcd9eb37244f54c4b011081977f254da4f62d82/game/tests) | Traduzir cenários relevantes de `answer_feedback.gd`, `lava_jump.gd`, `respawn_collectibles.gd` e `powers_continuity.gd` para Vitest quando a mecânica correspondente for implementada |

Não importar `.godot/`, `*.import`, `*.uid`, cenas `.tscn`, `project.godot`, exportações executáveis, firmware ou dependências do motor. Sons de pulo, trilha musical e pacote de voz seriam recursos novos, não itens encontrados para exportação nesta análise.

## 7. Procedência e créditos na futura importação

O [aviso de terceiros original](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/THIRD_PARTY_NOTICES.md) declara código, conteúdo pedagógico, efeitos próprios e gráficos publicados sob a [licença MIT da raiz](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/LICENSE). A procedência da arte está em [assets/manifest.json](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/assets/manifest.json); há registros históricos de imagens substituídas, portanto não tratar toda entrada como arte pronta.

Na entrega dos arquivos:

- Salvar o texto integral de `LICENSE` em `public/licenses/aventura-das-letras-MIT.txt`, preservando o copyright original, para acompanhar o build distribuído. Incluir esse arquivo no precache se houver acesso offline aos créditos.
- Criar o `THIRD_PARTY_NOTICES.md` local já citado pelo README, com origem, revisão, caminhos importados, conversões e referência à licença. Conferir também os cenários/objetos já presentes.
- Registrar por arquivo: URL original, revisão, SHA-256, destino, formato original/final, modificações e licença. Para derivados de imagem, guardar hashes de origem e resultado.
- Não alterar a condição da arte própria de Nicolas e Eloá nem incorporar fotografias privadas ou referências externas citadas nos prompts.

## 8. Sequência de execução e checklist de entrega

| Etapa | Entrega | Responsável sugerido | Esforço relativo |
| --- | --- | --- | --- |
| 1 | Baixar dois WAV e licença; conferir hashes; registrar créditos | Usuário pode baixar; agente pode integrar depois | Pequeno |
| 2 | Registrar sons, conectar respostas, controlar ciclo de vida e cache offline | Implementação no projeto | Pequeno a médio |
| 3 | Revisar instruções/pronúncias e selecionar lote de dez palavras | Revisão conjunta; adaptação dos dados pelo agente | Médio |
| 4 | Avaliar textura de chão e compor identidade dos mundos com fundos existentes | Usuário pode baixar PNG; implementação após inspeção | Médio |
| 5 | Mecânicas e testes derivados da referência | Seguir prioridades do plano 20 | Médio a grande |

Checklist para a primeira entrega implementada:

- [x] Dois WAV íntegros nos destinos exatos e licença incluída na distribuição.
- [x] Testes de acerto/erro garantem uma reprodução por resposta, inclusive no Explorar e Corrida.
- [x] Testes de áudio cobrem mudo, volumes, limpeza e falha de reprodução.
- [ ] Build inclui os WAV no precache (**feito**, entradas conferidas em `dist/sw.js`); uso offline confirmado em navegador após o cache estar pronto (**pendente**).
- [x] `npm test`, `npm run typecheck` e `npm run build` passam.
- [ ] Audição real aprova volume, caráter acolhedor do erro e convivência com voz; validar iPhone/Android alvo.
- [x] Documentação de gameplay e áudio atualizada somente após implementação.

**Atalho para a próxima tarefa:** começar apenas pelos dois WAV da seção 3 e a licença da seção 7. O usuário pode colocá-los diretamente nos destinos indicados; a integração de código será uma entrega separada. Nenhum download manual é necessário agora para concluir este plano.

A versão inicial deste documento foi só planejamento; a implementação da primeira entrega está registrada na §9.

## 9. Implementação da primeira entrega (28/09/2026)

**Recursos.** `answer_success.wav` e `answer_error.wav` baixados da revisão fixada para `public/assets/audio/sfx/`; SHA-256 idênticos aos da §3.1. `LICENSE` salvo em `public/licenses/aventura-das-letras-MIT.txt` (copiado para `dist/licenses/` no build). `THIRD_PARTY_NOTICES.md` criado na raiz com origem, revisão, hashes e destinos dos WAV e o mapeamento da §4.1 com o hash dos WebP já existentes. O `.txt` da licença **não** entra no precache: ainda não há tela de créditos offline.

**Código.**

- `src/audio/sfx-catalog.ts`: chaves `answer-success`/`answer-error`, URLs em `/assets/audio/sfx/` e ganho relativo por som (0,7 acerto; 0,55 erro — valores iniciais, a ajustar após audição). `main.ts` registra o catálogo ao criar o `AudioManager`.
- `AudioManager`: `register(key, url, { gain })`; `playSfx` agora rastreia os efeitos ativos, não cria elemento com mudo ou volume efetivo zero, corta a instância anterior da mesma chave, limita sobreposição (3 simultâneos, corta o mais antigo), esquece o efeito em `ended`/`error`/rejeição de `play()` e nunca lança. `stopSfx()` para todos; mudanças de mudo/volume alcançam efeitos em reprodução.
- `GameScene`: acerto toca em `_handleCorrectAnswer` (Aprender, Explorar, Corrida); erro em `_handleWrongAnswer`, inclusive no apoio assistido. Queda, espinhos e portal não tocam. `pause()` e `exit()` chamam `stopSfx()`; `core/lifecycle.ts` também para os efeitos ao perder foco/esconder o app.
- `vite.config.js`: `wav` nos `globPatterns`; `dist/sw.js` contém as duas entradas.

**Verificações.** `npm test` (879 testes), `npm run typecheck` e `npm run build` passaram. Testes novos em `audio-manager.test.js`, `game-scene.test.js` e `lifecycle.test.js`.

**Pendente.** Audição real (volume relativo à voz, caráter do erro) em desktop, Android e iPhone; confirmar reprodução offline após instalar o cache; validar o desbloqueio na primeira interação — `unlock()` continua usando um elemento sem fonte — e o retorno do segundo plano, inclusive com celular como controle. Etapas 3 a 5 da §8 não foram iniciadas.

## 10. Implementação das etapas 3 a 5 (28/09/2026)

### Etapa 3 — lote de dez palavras

Decisão: em vez da lista sugerida na §5.2, o lote segue **dois grupos temáticos da própria referência**, para que cada unidade tenha cinco palavras coerentes entre si (quatro distratores do mesmo tema). Seis palavras da sugestão ficaram; PORTA, LIVRO, CAIXA e NUVEM saíram por não formarem grupo com as demais e podem compor um próximo lote.

| Unidade (ordem) | Palavras | Grupo na referência |
| --- | --- | --- |
| `palavras-cozinha` — Na Cozinha (22) | PRATO, GARFO, POTE, JARRA, LEITE | “Na cozinha” e “Hora do lanche” |
| `palavras-corpo` — Nosso Corpo (23) | BOCA, NARIZ, DENTE, BRAÇO, PERNA | “Nosso corpo” e “Hora de cuidar” |

- Unidades acrescentadas **no fim** do currículo: ids, ordem e terrenos das 172 fases anteriores não mudaram (conferido: `generate:levels` só criou os 10 arquivos novos). Ambas entram no mundo Bosque das Descobertas.
- Segmentação em `syllables.ts`, idêntica à pista `hint` da referência para cada palavra (ex.: `Leia em duas partes: NA · RIZ`).
- Nenhuma entra no Explorar: não há ilustração dessas palavras (a referência também não tem), então não foram para `word-bank.ts`.
- Pronúncias: os campos `spoken` da referência escrevem o nome da letra por extenso (“letra bê”, “éfe”, “agá”). A narração local continua usando a letra e a palavra de referência (“Encontre a letra b de bola”, plano 16). Trocar para a grafia fonética só depois de ouvir as duas formas no iPhone/Android alvo; não alterado.
- `activities.json` (inclui o tipo `quantity`) e `positive_feedback` não foram importados.
- Testes em `worlds.test.ts`: posição das unidades, ausência das palavras no currículo e no Explorar, quatro opções distintas por lição e fase gerada para cada uma.

### Etapa 4 — textura do chão e identidade dos mundos

- `grass.png` baixado para `imports/aventura-das-letras/game/art/` (pasta agora no `.gitignore`: originais ficam fora do versionamento, reproduzíveis pela URL e pelo SHA-256 em `THIRD_PARTY_NOTICES.md`).
- Inspeção: não é um tileset de várias peças, e sim um único bloco de pixel art 40×40 ampliado para 1254×1254. Derivado `public/assets/terrain/grass-pixel-v1.webp`: WebP sem perdas **40×40, 1.580 bytes** (antes 939.893), amostrando o centro de cada bloco depois de verificar que todos são uniformes. Linhas 0–9 são grama e 10–39 são terra.
- Desenho (`render/sprites.ts`): a textura é desenhada 1:1 em pixels do mundo, numa grade ancorada no x 0 do mundo, para que sólidos vizinhos continuem o mesmo padrão. A terra se repete a cada 30 px em qualquer profundidade; a faixa de grama só aparece nos topos expostos. Só a parte visível é desenhada. O novo `CanvasRenderer.worldTile` arredonda a posição na tela, o que evita emendas de 1 px com a câmera entre pixels. Até a textura carregar (pré-carregada no boot, 1,5 KB), o chão usa as cores lisas antigas. Colisões não mudaram.
- Identidade por mundo (L3 do plano 20, parcial): achado no código — todo stream fixava `bg:primavera-lago`, então todas as fases usavam o mesmo fundo. Agora cada mundo em `worlds.ts` declara seu fundo (Jardim → jardim, Pomar → pomar, Vale → vale, Lago → lago, Bosque → bosque), e `createLessonStream` o aplica. A Maratona usa o Jardim; o Explorar continua no lago. Os oito PNG da §4.1 não foram baixados de novo.
- `speed.png`: não baixado, pois ainda não há poder que o use (§4.2).
- Testes: `sprites.test.js` (fallback, cobertura exata do sólido, grade contínua, só o trecho visível) e `stream-courses.test.ts` (fundo estável por mundo e diferente entre mundos).

### Etapa 5 — testes e mecânicas da referência

Traduzidos para Vitest em `game-scene.test.js` os cenários de `answer_feedback.gd` e `respawn_collectibles.gd` que têm mecânica equivalente: erro mantém posição, mundo e letras achadas; acerto substitui o aviso de erro; efeitos congelam na pausa; queda volta ao ponto de retorno sem custar coração nem contar erro de leitura; o alvo atual continua oferecido após a queda; a mesma coleta é reportada uma vez. Todos passaram sem mudar código de jogo.

Diferenças mantidas de propósito: aqui o erro custa coração (exceto no apoio assistido) em vez de renovar corações, e a queda preserva o que já foi coletado em vez de restaurar o trecho inteiro.

**Não implementado:** `lava_jump.gd` e `powers_continuity.gd` pressupõem lava e poderes, que ainda não existem aqui. Essas mecânicas, assim como terrenos de `adventure_terrain.gd`, são as entregas 3 a 6 do plano 20 (Monta-sílabas, ponte e água, ritmo de sessão, luz e tartaruga) e exigem decisões de produto próprias. Os testes serão traduzidos junto com elas.

### Verificação

`npm test` (895 testes), `npm run typecheck` e `npm run build` passaram. O service worker gerado inclui `assets/terrain/grass-pixel-v1.webp`. O aviso de chunk acima de 500 kB já existia antes destas mudanças.

**Pendente:** conferir no navegador e no aparelho alvo a aparência do chão (emendas, contraste com as letras, custo por quadro) e dos cinco fundos por mundo; ouvir a pronúncia das 10 palavras novas.
