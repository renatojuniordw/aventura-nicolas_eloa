# Plano de desenvolvimento — Corrida do alfabeto, Explorar e Sílabas

**Data:** 24/09/2026. **Status:** planejamento concluído; implementação aguardando autorização do usuário.
**Arquivo de continuidade:** este documento é suficiente para outro agente retomar o trabalho.
**Escopo desta entrega:** somente este plano. Não implementar, instalar dependências, baixar modelos ou publicar antes da autorização.

## 1. Objetivo e decisões de produto

Reorganizar o jogo em três atividades claras, com um objetivo de cada vez, removendo a navegação por dezenas de fases e a mistura de exploração livre com coleta de letras.

| Modo no menu | O que a criança faz | O que permanece / muda |
| --- | --- | --- |
| **Corrida do alfabeto** | Corre e pula para encontrar A até Z, em ordem, entre alternativas embaralhadas | Preservar a corrida atual, controles, checkpoints e recorde pessoal |
| **Explorar** | Conhece uma coisa do cotidiano, ouve sobre ela e monta sua palavra com letras embaralhadas | Substituir completamente o quintal aberto por uma atividade guiada |
| **Sílabas** | Junta letras para formar sílabas: B + A = BA; depois relaciona a sílaba a uma palavra | Criar uma atividade própria de composição, sem plataformas |

Remover do menu **Aventura surpresa**, **Começar/Continuar aventura**, **Escolher fase**, a placa **Sua próxima descoberta** e o contador **X de 152 fases**. Remover também as entradas indiretas para a aventura antiga, inclusive pelo pareamento do controle por celular.

Manter escolha de personagem/perfil, configurações, áudio, acessibilidade, instalação PWA e tela cheia como utilidades secundárias. Não transformá-las em mais modos.

A proposta é coerente como design: o objeto dá contexto à palavra; a montagem torna a escrita uma ação; as sílabas passam a ter uma atividade específica. Isso é uma hipótese de melhoria de usabilidade/aprendizado a validar observando crianças jogando, não uma promessa de eficácia pedagógica já comprovada.

### Premissas para aprovação deste plano

- Público continua sendo crianças em alfabetização, em português brasileiro, compartilhando perfis locais.
- Explorar e Sílabas funcionam por toque/clique e teclado, em retrato e paisagem. Corrida mantém paisagem no celular.
- Em Explorar e Sílabas não há cronômetro, perda de vidas, desenho de enforcamento ou bloqueio por errar. Aproveitar da ideia de forca os espaços e as dicas progressivas.
- Rodada sugerida: três atividades em Explorar e cinco em Sílabas; depois oferecer continuar ou menu. Esses números são configuração, não novos botões de fase.
- IA local faz parte do trabalho proposto, com prova de viabilidade e integração verificável. Um fallback por regras mantém a brincadeira disponível quando o aparelho não suporta o modelo.
- Não incluir busca livre, chat infantil, microfone, câmera, contas ou backend nesta reformulação.

## 2. Estado real do projeto e cuidados na retomada

Raiz: `/Users/renatobezerra/Documents/aventura-nicolas_eloa`.

- Motor TypeScript/Canvas 2D, menus React/TSX, Vite, Vitest, PWA; sem framework de jogo.
- `src/architecture.test.js` proíbe React nos módulos do motor e importação de `gameplay`, `scenes`, `render`, `physics` ou `core` pelos componentes React. Preservar essa separação.
- `package.json`, `package-lock.json` e `src/` foram inspecionados: **não há Transformers.js, ONNX Runtime ou modelo neural instalado neste jogo**. A implementação anterior usa regras adaptativas e geração procedural. O stack de embeddings citado pelo usuário pertencia a outro projeto.
- `src/gameplay/speedrun-course.ts` monta 26 segmentos; hoje varia posições/alternativas, mas usa os quatro terrenos em ciclo. Depende de `fase-alfabeto-a`, `-b`, `-c`, `-d` pelo registro de JSONs.
- `src/content/level-registry.ts` importa os JSONs por `import.meta.glob`; remover as fases indiscriminadamente quebra a corrida.
- `src/content/curriculum.json` tem conteúdo útil para sílabas. Remover o seletor visual não implica descartar esse conteúdo.
- Há alterações **ainda não commitadas** da implementação anterior, incluindo arquivos novos. Executar `git status` antes de começar; não usar `git reset`, `git clean` nem sobrescrever trabalho preexistente.
- `aventura-surpresa.md` e `docs/13-aventura-surpresa.md` descrevem a proposta anterior, agora substituída. Não executar aquele plano.
- Última verificação da implementação anterior nesta conversa: 625 testes passaram, tipos e build passaram. Isso é referência histórica; executar uma nova linha de base ao iniciar a implementação.

### Diagnóstico do problema atual

O menu acrescentou ações ao mesmo painel sem rever hierarquia e CSS responsivo: cinco entradas principais, identificação duplicada de personagem e progresso da campanha disputam espaço. No quintal, placas de região, nomes de objetos, HUD, plataformas e personagens dividem a mesma área do canvas. Na surpresa, a descoberta próxima do início se repete estruturalmente antes da coleta de uma resposta.

A correção é substituir esses fluxos, e não apenas afastar alguns elementos ou sortear mais posições.

## 3. Menu e apresentação visual

### Estrutura proposta

```text
Nicolas & Eloá                [personagem / trocar] [configurações]

         O que vamos brincar hoje?

[ Corrida do alfabeto ] [ Explorar          ] [ Sílabas         ]
[ Encontre A até Z    ] [ Conheça e escreva ] [ Junte os sons   ]

                  [Tela cheia, quando disponível]
```

- Três cartões de igual importância, cada um com ilustração pequena, título e uma frase.
- Uma identificação compacta do personagem; remover o grande painel lateral e a duplicação retrato + personagem animado + dois botões de troca.
- Em desktop, três cartões em linha quando houver largura; em celular retrato, coluna; em paisagem curta, composição compacta com rolagem vertical se necessária.
- Recorde da corrida fica no seu próprio cartão, em texto secundário.
- Manter arte e identidade do jogo, com fundo visualmente discreto nas atividades de escrita.
- Usar layout normal (grid/flex) para imagem, instrução, palavra e letras. Não posicionar esses elementos uns sobre os outros no canvas.
- Corrigir as regras conflitantes em `main.css` e `mobile.css`; não empilhar outra camada de sobrescritas para o menu antigo.
- Alvos de toque de pelo menos 48 px; foco visível; texto ampliado e contraste existentes devem funcionar.
- Enter só ativa a ação com foco ou a ação principal adequada; não iniciar uma modalidade antiga por atalho residual.

## 4. Explorar: fluxo detalhado

### 4.1 Estados da atividade

`apresentação → montagem → conferência → celebração → próxima descoberta/resumo`.

**Apresentação**

1. Mostrar um único objeto/animal/atividade em destaque, sem plataformas nem personagem caminhando.
2. Exibir e narrar uma identificação curta: “Encontramos uma borboleta!”
3. Explicar uma característica ou uso: “A borboleta é um inseto. Suas asas ajudam a voar.”
4. Mostrar a palavra correta nesta etapa para a criança relacionar imagem, fala e escrita.
5. Botões “Ouvir de novo” e “Montar a palavra”. Avanço manual, sem depender do término da voz.

Para animais/natureza, explicar o que são e características; para objetos, o que são e para que servem; para atividades, o que fazemos nelas. Não forçar a pergunta “para que serve?” para tudo.

**Montagem**

- Manter a imagem menor como referência e o objetivo “Monte o nome da borboleta”.
- Retirar a palavra completa como pista permanente no modo padrão; no assistido, permitir modelo visual explicitamente.
- Mostrar espaços na ordem da escrita e banco de letras embaralhado abaixo.
- Ao tocar uma letra, colocá-la no próximo espaço vazio. Tocar um espaço preenchido devolve aquela peça ao banco. Oferecer “Desfazer”, “Dica”, “Ouvir” e “Conferir”.
- Arrastar pode ser evolução posterior; toque/clique é suficiente e obrigatório na primeira entrega.
- “Conferir” fica indisponível enquanto faltarem espaços, com indicação textual do que falta.
- Não corrigir automaticamente cada letra colocada: a criança monta e então confere, como pedido pelo usuário.
- Garantir peça com ID próprio por ocorrência: BORBOLETA tem duas letras B e duas O. Nunca usar apenas o caractere como identidade.
- O embaralhamento deve preservar o multiconjunto das letras e não começar igual à resposta. Corrigir o caso de letras repetidas sem loop infinito.

**Conferência e ajuda**

- Resposta correta: pronunciar a palavra, mostrá-la completa junto da imagem, celebrar brevemente e permitir continuar.
- Resposta incorreta: “Vamos olhar com calma?”; indicar posições que precisam de revisão sem zerar tudo ou tirar vidas.
- Dicas em ordem: repetir explicação/som; mostrar a primeira letra; revelar mais uma posição; oferecer modelo completo quando necessário.
- Uma posição revelada consome a peça correspondente e fica marcada como ajuda; não duplica letras nem pode ficar impossível completar.
- Separar nos registros: resolvido sozinho, com dica ou com modelo. Não atribuir domínio autônomo a uma resposta quase toda revelada.
- Depois de duas conferências incorretas, oferecer ajuda, sem impor reinício.
- Ao terminar a rodada, mostrar palavras descobertas e botão “Mais descobertas”. Sem listas de 152 fases, estrelas punitivas ou comparação entre crianças.

### 4.2 Dificuldade e exemplos

| Apoio | Palavras propostas | Ajuda inicial |
| --- | --- | --- |
| Assistido / início | GATO, BOLA, PATO, MALA | Primeira letra preenchida, voz disponível e possibilidade de ver modelo |
| Padrão | ESCOVA, ESCOLA, SAPATO, BANHO | Banco exato de letras e dicas sob demanda |
| Desafio / familiaridade maior | BORBOLETA, CACHORRO, PASSARINHO | Mais letras, com pistas progressivas; sem pressão de tempo |

BORBOLETA continua como exemplo demonstrativo pedido pelo usuário, mas não deve ser sempre a primeira atividade nem a dificuldade padrão de quem está começando.

- Definir dificuldade por tamanho, repetição de letras, acentos, dígrafos e ajuda necessária; não apenas por categoria temática.
- Normalizar entrada para Unicode NFC e caixa alta. **Preservar acentos e Ç na comparação de escrita**: MACA não equivale a MAÇÃ. Não reutilizar cegamente o validador antigo, que ignora acentos.
- Segmentar peças por grafemas. Espaços/hífens são separadores fixos, nunca letras embaralhadas.
- “Escova de dentes”: começar com imagem e explicação da escova de dentes e alvo **ESCOVA**. Em dificuldade avançada, permitir **ESCOVA DE DENTES**, com separadores e a palavra DE já dados, respeitando a largura da tela. Não confundir o nome completo explicado com a parte solicitada na tarefa.
- Palavras longas podem ocupar duas linhas; nunca reduzir letras a botões minúsculos para caber.

### 4.3 Catálogo inicial

Meta: pelo menos 30 entradas revisadas, distribuídas entre animais, higiene, escola, casa/alimentação e brincadeiras/natureza. Exemplos:

| Grupo | Exemplos a cobrir |
| --- | --- |
| Animais | gato, cachorro, passarinho, pato, sapo, borboleta |
| Higiene e rotina | escova de dentes, banho, sabonete, pente, toalha, pia |
| Escola | escola, lápis, livro, mochila, papel, caderno |
| Casa/alimentação | copo, prato, colher, cama, banana, maçã |
| Brincadeiras/natureza | bola, pipa, tambor, flor, árvore, sol |

Cada entrada precisa de ID estável, nome de apresentação, alvo de escrita, categoria, dificuldade, arte local com descrição alternativa, explicação curta, textos de fala e dicas revisadas. Dados de silabificação, quando usados, são autorais e revisados.

As figuras pixeladas atuais podem ser reutilizadas se forem reconhecíveis na nova escala. Novos objetos precisam de arte consistente e legível. Criar assets durante o desenvolvimento (inclusive com auxílio de geração de imagem se apropriado), revisar e empacotar. Não gerar imagens pesadas durante a partida, nem usar apenas rótulos no lugar das figuras.

## 5. Sílabas: atividade própria

### Fluxo

1. Demonstração inicial curta: **B + A = BA**, com narração “B com A forma BA”.
2. Mostrar uma composição incompleta: **B + ? = BA**; escolher a vogal entre opções embaralhadas.
3. Em seguida, quando apropriado: **? + A = BA**, escolhendo a consoante.
4. Mostrar a sílaba formada em destaque e um exemplo: **BA** de **BALA**, com imagem relacionada.
5. Após familiaridade, pedir “Monte BA”, com duas posições vazias e escolhas controladas.
6. Conferir, dar dica, celebrar e seguir. Cinco atividades por rodada sugerida.

Reaproveitar as famílias do currículo, começando com combinações simples e aprovadas (B, M, P, L, F com vogais). Ampliar por progresso; não sortear qualquer par de letras como se toda junção fosse válida.

C/G têm mudanças conforme a vogal; dígrafos e encontros consonantais não são pares simples equivalentes. Criar atividades explícitas depois das famílias básicas, com exemplos e pronúncias revisados. Usar “letra” e “som” corretamente: o nome “bê” não é o mesmo que o som consonantal isolado.

A síntese de voz do navegador pode pronunciar sílabas de forma inadequada. Ouvir e validar BA/BE/BI/BO/BU e demais famílias; usar frases de apoio ou áudio local revisado para os casos problemáticos. A atividade funciona com voz desligada ou indisponível.

## 6. Variação e IA: implementação honesta e concreta

### 6.1 O que gera variedade

A variedade virá de um catálogo maior e de escolhas com memória: conteúdo, tema, nível de ajuda, posições das peças e sequência de tarefas. Mudar somente o terreno ou a primeira figura não resolve o problema descrito.

- Gerador com semente, para reproduzir falhas nos testes.
- Não repetir o mesmo objeto consecutivamente; preferir não repetir na mesma rodada.
- Janela de recência por perfil (sugestão: últimos dez itens), relaxada de forma previsível quando o conjunto elegível for pequeno.
- Misturar novidades e revisões (referência inicial: duas novidades/itens pouco vistos para uma revisão, quando houver candidatos).
- Garantir diversidade temática ao longo das rodadas; não fixar o começo em animal, letra A ou borboleta.
- Sorteios respeitam dificuldade e conteúdo liberado. “Aleatório” não significa jogar uma palavra de 14 letras para quem está começando.

### 6.2 Papel do modelo neural

**Proposta:** Transformers.js com um modelo pequeno de geração de texto, executado em Web Worker, para planejar uma sequência curta dentro de opções permitidas. O modelo pode sugerir uma relação temática (“coisas da hora do banho”), ordem de itens e tipos de dica. Palavras corretas, fatos educativos, imagens e regras de validação vêm do catálogo revisado.

Candidato inicial para o experimento: `onnx-community/Qwen2.5-0.5B-Instruct`, quantização `q4`, WebGPU. A documentação oficial apresenta esse uso; isso não comprova desempenho nem qualidade no aparelho do usuário. Fixar versão estável do pacote e revisão do modelo após o experimento, verificando licença e arquivos necessários.

Não trazer Postgres, `tsvector`, `pg_trgm`, RRF ou E5-base para resolver ordenação de letras. Embeddings podem futuramente relacionar um catálogo grande, mas não geram explicações nem substituem o validador de ortografia. Não instalar dois modelos para este escopo.

### 6.3 Contrato do planejador

A camada do jogo seleciona candidatos elegíveis antes de chamar o modelo. Entrada: IDs e metadados do catálogo, recência, nível de apoio e dificuldades agregadas — sem nome da criança. Saída proposta:

```json
{
  "themeId": "higiene",
  "activities": [
    { "contentId": "escova", "task": "word-order", "hint": "first-letter" },
    { "contentId": "banho", "task": "word-order", "hint": "none" },
    { "contentId": "toalha", "task": "word-order", "hint": "sound" }
  ]
}
```

Para Sílabas, usar IDs de atividades revisadas, por exemplo `ba-vowel`, sem deixar o modelo inventar combinações.

Validar estrutura, enums, tamanho, IDs, compatibilidade com o modo/dificuldade e restrições de repetição. A saída não contém HTML, código, URLs, novas palavras ou fatos arbitrários a exibir. Um JSON válido ainda pode ser pedagogicamente inválido: validar ambos. Rejeitar plano inválido e usar o planejador por regras; nunca avaliar código gerado.

A resposta de rede/worker carrega ID de requisição, perfil, modo e versão do catálogo. Cancelar ou ignorar respostas antigas ao trocar perfil, sair da atividade ou começar outra sessão. Nunca substituir a palavra enquanto a criança a monta.

### 6.4 Carregamento, desempenho e offline

- Importar biblioteca e criar worker somente quando necessário; não incluir o modelo no caminho crítico de abertura do menu.
- Primeiro conteúdo pode iniciar por regras. IA planeja próximas rodadas em segundo plano e só é aplicada numa fronteira de atividade.
- Não executar inferência durante a corrida; worker também disputa GPU/memória, mesmo fora da thread principal.
- Usar modelo e binários ONNX/WASM hospedados na própria origem, com manifest de revisão/tamanho e cache separado. Desabilitar busca automática de modelos/CDN externos.
- Não adicionar centenas de MB ao precache obrigatório da PWA. Nas configurações dos responsáveis, oferecer baixar/ativar IA local com tamanho medido, progresso, cancelar e remover arquivos. Não exigir download para brincar.
- Quando o modelo estiver disponível e o aparelho for compatível, o planejador neural é usado e seu funcionamento é verificável; quando não estiver, regras locais. Mostrar o estado apenas nas configurações, sem avisos técnicos interrompendo a criança.
- Tratar WebGPU ausente, memória insuficiente, cache removido, quota, download interrompido, timeout e perda do dispositivo GPU. Não presumir que fallback de um LLM para CPU será aceitável num celular.
- Orçamento inicial de tentativa de planejamento: até 8 segundos em background após modelo pronto; se exceder, cancelar/descartar e usar regras. É limite de produto proposto, não latência já medida.
- Antes de aprovar o modelo, medir bytes reais de download, inicialização fria/quente, latência p50/p95, taxa de planos válidos e responsividade em desktop e Android representativo. iOS/Safari também deve manter os jogos funcionais, com fallback quando necessário.
- Revisar `vite.config.js`, `docker/nginx.conf` e `docker/nginx-vps.conf`: worker, MIME de WASM, cache, rotas de modelo sem fallback HTML, CSP específica para o runtime escolhido. Verificar headers efetivos; não liberar fontes externas ou `unsafe-eval` amplamente por conveniência.
- Não ativar nova versão do service worker durante montagem de palavra ou sílaba. Integrar as novas cenas às proteções de atualização já existentes.

**Critério de honestidade:** uma implementação apenas com `Math.random` e regras não satisfaz a etapa de IA. Registrar prova de inferência real e plano consumido pelo jogo. Se o candidato não for viável, registrar resultados e a pendência; não declarar a integração concluída nem introduzir API paga sem nova decisão.

### 6.5 Fontes técnicas consultadas para este plano

- [Transformers.js — quantização e exemplo Qwen](https://huggingface.co/docs/transformers.js/guides/dtypes).
- [Modelo ONNX candidato](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct).
- [Configuração de modelos e binários locais](https://huggingface.co/docs/transformers.js/custom_usage).
- [Execução WebGPU](https://huggingface.co/docs/transformers.js/guides/webgpu).

Consultar documentação da versão estável que for instalada: as páginas `main` podem descrever APIs ainda não publicadas. Nenhum modelo foi instalado ou benchmarkado nesta etapa de planejamento.

## 7. Arquitetura e mapa de alterações

Nomes de arquivos novos são propostas concretas, a confirmar por busca de reuso antes de criar.

| Área | Arquivos existentes | Alterações planejadas |
| --- | --- | --- |
| Entrada e rotas | `src/main.ts`, `src/scenes/menu-scene.ts`, `src/ui/menu.ts` | Expor apenas iniciar corrida, explorar e sílabas; registrar cenas novas e remover navegação antiga |
| Menu | `src/ui/screens/main-menu.tsx`, `src/styles/main.css`, `src/styles/mobile.css` | Três cartões, perfil compacto, utilidades; remover placa, contador e botões antigos |
| Corrida | `src/gameplay/speedrun-course.ts`, `speedrun-run.ts`, `src/scenes/game-scene.ts`, `victory-scene.ts` | Preservar corrida/recordes; retirar ramificações normal/surprise após migrar dependências e testes |
| Exploração antiga | `src/scenes/exploration-scene.ts`, `src/ui/discovery-hud.ts`, `src/gameplay/discovery-run.ts` | Substituir o mundo livre pela sequência guiada; remover código sem consumidores ao final |
| Catálogo | `src/content/discoveries.ts`, `curriculum.json`, `curriculum-model.ts` | Extrair/revisar conteúdo reutilizável; deixar de acoplar objeto educativo a coordenadas de mapa |
| Regras novas | Criar `src/gameplay/word-builder.ts`, `syllable-builder.ts`, `activity-director.ts` | Estado puro da tarefa, peças, validação, dicas, progresso de rodada e escolha por regras |
| Dados novos | Criar `src/content/everyday-items.ts`, `syllable-activities.ts`, `activity-types.ts` | Contratos compartilhados, catálogo e combinações aprovadas |
| Cenas novas | Criar `src/scenes/word-exploration-scene.ts`, `syllables-scene.ts` | Orquestrar regras, narração, menus, persistência e ciclo de vida |
| UI nova | Criar `src/ui/screens/explore.tsx`, `syllables.tsx`, `activity-summary.tsx` e componente de peças reutilizável | Renderizar view models e callbacks, sem importar regras do motor |
| IA | Criar `src/ai/activity-planner.ts`, `planner-worker.ts`, `plan-validator.ts`, `model-config.ts` | Carregamento isolado, geração real, validação e cancelamento; injeção no diretor |
| Arte | `public/assets/`, `src/render/asset-plan.ts`, `sprite-assets.ts`, `discovery-pixels.ts` | Reutilizar arte reconhecível, adicionar figuras para catálogo e testar arquivos; não importar renderer em TSX |
| Narração | `src/audio/speech-narrator.ts`, `audio-manager.ts` | Explicação, letra/palavra/sílaba, repetir/cancelar; validar pronúncias e evitar fala sobreposta |
| Save | `src/persistence/migration.ts`, `progress-store.ts`, `save-store.ts`, `experience-settings-store.ts` | Progresso novo por modo, recência e uso de dicas, configuração de IA sem misturar cache de modelo no save |
| Input e celular | `src/input/keyboard-adapter.ts`, `src/ui/overlay-input.ts`, `src/ui/mobile-presentation.ts`, `src/styles/touch-controls.css` | Botões acessíveis sem acionamento duplo; orientação por modo; sem controles de caminhada nos modos DOM |
| Pareamento | `src/scenes/menu-scene.ts`, `src/ui/screens/phone-pairing.tsx` | Oferecer iniciar Corrida; retirar entrada residual para aventura antiga; toque/clique para as atividades de escrita |
| Atualizações/offline | `src/ui/pwa-update.ts`, `vite.config.js`, `docker/nginx.conf`, `docker/nginx-vps.conf` | Proteger sessões novas, cache separado do modelo e hospedagem compatível |
| Documentação | `README.md`, `docs/README.md`, documentos 01/02/04/10/11/12/13 | Explicar três modos, dados guardados, IA real/fallback e descarte da proposta anterior |

### Fronteiras obrigatórias

- React recebe dados e callbacks; não acessa `GameScene`, física ou regras diretamente. Contratos partilháveis ficam em conteúdo/tipos.
- Cenas controlam a sessão e persistem resultados; regras de montagem são puras e testáveis sem DOM.
- Reutilizar `MenuButton`, `buildScreen` e ciclo de cleanup do `MenuOverlay`. Não reconstruir a raiz React a cada clique de letra a ponto de perder foco; prever tela montada estável com atualização de props/view model.
- Não criar listeners globais de teclado fora de `src/input/`. Preferir navegação nativa Tab/Enter/Space nos botões; rever atalhos do jogo para não consumir a mesma ação duas vezes.
- Pausar/cancelar voz ao sair ou ocultar a atividade; bloquear duplo envio, duplo avanço e conclusões repetidas.
- Nos novos modos, esconder os controles de andar/pular; manter menu/ajuda/voz próprios. Parar autorun/controle corporal ao entrar em modos de montagem.
- Atualizar separadamente a classificação de “atividade em andamento” da PWA e de “exige paisagem” da apresentação mobile. São propriedades diferentes.

### Remoção da implementação anterior

Depois que os substitutos estiverem funcionando:

1. Retirar `startSurprise`, registros, chamadas e interfaces relacionadas.
2. Remover `surprise-run.ts`, `surprise-level.ts`, `adventure-status.ts`, `adventure-victory.tsx`, CSS e testes específicos obsoletos, substituindo-os pelos testes novos pertinentes.
3. Remover telas/rotas de `lesson-picker` e vitória de campanha que ficarem sem uso. Preservar vitória da corrida.
4. Preservar temporariamente os quatro JSONs necessários à corrida; preferencialmente extrair templates próprios para a corrida, provar equivalência e então eliminar o glob das 152 fases do bundle ativo.
5. Preservar as famílias silábicas como dados educativos, mesmo ao encerrar a campanha.
6. Atualizar ou marcar a documentação da surpresa como histórica. Remover imports e módulos órfãos apenas depois de busca por consumidores.

## 8. Dados, compatibilidade e adaptação

Proposta de campos opcionais normalizados por perfil:

```text
activities.explore[contentId] = { attempts, solvedAlone, solvedWithHelp, recentResults, lastSeenAt }
activities.syllables[activityId] = { attempts, solvedAlone, solvedWithHelp, recentResults, lastSeenAt }
activityRecency = { explore: [ids limitados], syllables: [ids limitados] }
```

- Definir formatos tipados e limites (oito resultados recentes por item; dez IDs na recência) antes de implementar; validar saves malformados.
- Contar tentativa na conferência, não em cada clique/troca de letra. Contar conclusão uma vez.
- Conteúdos resolvidos com muita ajuda continuam elegíveis para revisão; recência evita martelar a mesma palavra.
- Não usar quedas/tempo de corrida como inferência sobre escrita.
- Preservar perfis, personagem, consentimento, recorde da corrida e preferências existentes.
- Progresso antigo da campanha pode permanecer como legado, sem aparecer no menu. Não converter automaticamente “coletou a palavra” em “sabe escrevê-la”.
- `Zerar progresso` limpa também estatísticas e recência dos novos modos. Excluir perfil elimina seus dados. Cache de modelo é do aparelho e tem controle separado.
- Preferir extensão opcional compatível do save atual; se houver mudança de versão, implementar leitura/migração da chave anterior — mudar só o número da chave faria os dados parecerem perdidos.
- Ao recarregar, rodada incompleta pode reiniciar; atividades concluídas e preferências permanecem. Documentar essa escolha; não prometer retomada exata sem implementar.

## 9. Ordem de execução e entregas verificáveis

Não iniciar nenhum item abaixo antes da autorização do usuário.

- [ ] **1 — Linha de base e experimento de IA.** Ler instruções locais e estado Git, executar testes/tipos/build; fazer prova isolada do modelo candidato, com dados fictícios, sem mudar a experiência infantil. Registrar versão, peso, licença, hardware, latências, planos válidos e fallback. Entrega: viabilidade conhecida, sem afirmar integração pronta.
- [ ] **2 — Conteúdo e composição visual.** Definir catálogo de 30 itens, combinações silábicas, assets e wireframes de menu/apresentação/montagem/conferência. Validar BORBOLETA, ESCOVA, ESCOVA DE DENTES e MAÇÃ. Entrega: contrato de conteúdo e desenho que suportam palavras longas e telas pequenas.
- [ ] **3 — Regras testáveis.** Implementar peças com identidade, letras repetidas, grafemas/acentos, conferência exata, desfazer, dicas, rodadas e sorteio sem repetição. Entrega: testes de regras antes da integração visual.
- [ ] **4 — Explorar completo.** Integrar cena, UI estável, imagens, narração, montagem, feedback, resumo, pausa e retorno. Entrega: apresentação → palavra → conferência executada por toque/clique e teclado.
- [ ] **5 — Sílabas completo.** Integrar demonstração, escolha de vogal/consoante, composição, palavras de exemplo e áudio revisado. Entrega: famílias iniciais jogáveis sem depender das antigas fases.
- [ ] **6 — Progresso e planejador neural.** Persistir métricas novas; conectar modelo real em worker, validar saída, cancelar respostas antigas, cache local e fallback. Entrega: plano neural válido realmente usado por uma rodada e funcionamento sem modelo comprovado.
- [ ] **7 — Novo menu e retirada dos fluxos antigos.** Ativar somente três cartões, rever pareamento/atalhos, limpar código e CSS obsoletos, separar templates da corrida quando necessário. Entrega: nenhuma entrada visível ou indireta para campanha/surpresa/quintal antigo.
- [ ] **8 — Verificação e documentação final.** Executar toda a matriz abaixo, corrigir falhas, registrar capturas desktop/celular, atualizar documentos e entregar resumo com limites reais da IA. Não publicar automaticamente.

Dependências: 1 e 2 esclarecem viabilidade e conteúdo; 3 sustenta 4/5; 6 usa os fluxos e catálogo definidos; 7 conclui a substituição; 8 verifica tudo. Cada etapa deve atualizar este arquivo com o que foi feito, comandos e pendências concretas.

## 10. Critérios de aceite e testes

### Produto e interface

- Menu contém exatamente três entradas de jogo com os nomes pedidos; nenhum botão de escolher fases ou continuar campanha.
- Uma figura e uma instrução por etapa de Explorar; descrição e letras em áreas próprias, sem sobreposição.
- Os três modos têm começo, objetivo, resposta/feedback e saída compreensíveis.
- Na montagem, a criança escolhe letra por letra, pode corrigir e só então confere.
- Sílabas efetivamente ensina composição e não abre uma fase antiga de coletar BA.
- Exemplos cotidianos de todos os grupos estão presentes com imagem, explicação e escrita consistentes.

### Regras e persistência

- BORBOLETA com B/O repetidos; CACHORRO com R repetido; MAÇÃ/ÁRVORE/PÁSSARO com acentos; expressão com espaços.
- Pré-preenchimento/dica desconta as peças corretas; desfazer nunca devolve peça fixa; voltar/avançar não duplica resultado.
- Embaralhamento preserva letras e produz ordem diferente quando possível; semente reproduz o caso.
- Falta de candidato não trava o sorteio; recência relaxa; nenhum ID inexistente aparece.
- Perfis separados, save antigo sem campos novos, save malformado, storage indisponível, reset e exclusão.
- Progresso de campanha antigo não desbloqueia domínio de escrita novo.

### IA e falhas

- Provar inferência real: registrar modelo/revisão e exemplo de plano aplicado, sem dados pessoais.
- Cobrir JSON inválido, ID inventado, dificuldade inadequada, duplicação, timeout, resposta atrasada, perfil trocado e catálogo incompatível.
- Simular ausência de WebGPU, falha de download e cache vazio offline; todos os jogos continuam disponíveis.
- Testar cache aquecido offline e remoção do modelo; não carregar modelo ao simplesmente abrir a corrida.
- Medir variação em muitas sementes e sessões sem exigir “nunca repetir” matematicamente. Não contar apenas mudanças cosméticas como variedade educativa.

### Navegador, acessibilidade e regressão

- Desktop 1366×768; celular retrato 390×844; paisagem 844×390; largura 320 px com texto ampliado.
- Clique/toque nas peças, Tab/Enter/Space, desfazer, dica, ouvir novamente, sair e trocar personagem.
- Explorar/Sílabas em retrato sem aviso para girar; corrida preserva aviso e pausa em retrato.
- Foco não se perde a cada letra; Enter não aciona duas ações. Feedback anunciado sem narradores disputando a fala.
- Áudio desligado, TTS ausente, português disponível/indisponível, movimento reduzido e contraste.
- PWA não atualiza/recarrega no meio de nenhuma atividade; corrida e controle por celular mantêm comportamento anterior.
- Verificar imagens, modelo e WASM também servidos pelo ambiente de produção/Nginx, não somente pelo Vite.

### Comandos mínimos da entrega

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Adicionar testes unitários para regras/planejador, testes DOM para as telas e integração para rodadas completas e migração. Atualizar testes que explicitamente esperavam o menu antigo; não remover cobertura de corrida para fazer a suíte passar. Verificação visual em navegador real é obrigatória para os problemas de layout relatados.

## 11. Como retomar em outra conversa

Mensagem sugerida após o usuário aprovar:

> Leia `plano-reformulacao-modos-educativos.md` e implemente a reformulação aprovada. Preserve o trabalho existente e os saves. O menu deve ter somente Corrida do alfabeto, Explorar e Sílabas. Siga os fluxos de escrita e a etapa de IA real do documento, registrando progresso e verificações nele. Não restaure a Aventura surpresa nem o quintal livre e não declare IA concluída se houver somente sorteio por regras.

Antes da aprovação, o próximo passo é apenas o usuário revisar este plano. Nenhuma alteração do jogo foi autorizada para esta etapa.
