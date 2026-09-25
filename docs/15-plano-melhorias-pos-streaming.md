# Plano de melhorias após a adoção do mundo contínuo

Data: 24/09/2026. Base revisada: `e257445`. Documento para implementação posterior por outra LLM.

## Escopo e validação realizada

Esta entrega contém somente um plano. Nenhuma correção, funcionalidade ou alteração de configuração foi implementada. Foram revisados o histórico recente, os módulos de gameplay, conteúdo, renderização, preferências, persistência e os planos existentes.

Validação local executada nesta revisão:

| Verificação | Resultado |
| --- | --- |
| `npm test` | 658 testes passaram em 75 arquivos |
| `npm run typecheck` | Passou |
| `npm run build` | Passou; precache com 38 entradas e 2082,69 KiB |
| Bundle principal | 347,67 kB; 108,78 kB gzip |
| Bundle de currículo | 426,59 kB; 10,46 kB gzip |
| Bundle de embeddings | Não foi emitido neste build |

Não houve validação visual em navegador, teste em aparelho físico, medição de FPS/memória, teste de atualização entre versões nem validação de publicação Android. Os testes aprovados validam os cenários cobertos, não todos os comportamentos abaixo. As propostas não dependem de pesquisa externa; APIs e requisitos de lojas deverão ser conferidos na documentação oficial durante a futura implementação.

Legenda: **confirmado** = observável no código ou nos comandos executados; **risco** = caminho identificado por inspeção, ainda sem reprodução ponta a ponta; **proposta** = evolução de produto, não defeito comprovado. P1 = prioridade alta; P2 = média; P3 = opcional. Esforço relativo: pequeno, médio ou grande; não representa prazo.

## O que mudou e deve ser preservado

| Mudança recente | Validação e avaliação |
| --- | --- |
| `8878d62`, `150056c`, `e6b6dfd` — exploração e reformulação dos menus | A exploração atual monta uma palavra por fase. O quintal de interação livre descrito em documentos antigos foi substituído. Preservar a intenção atual e não restaurar automaticamente o desenho antigo. |
| `cc9e459` — slots de letras no HUD | O modelo acompanha letras coletadas e próxima posição. Preservar esse apoio visual e cobrir palavras repetidas/acentuadas. |
| `7ef8ad7`, `6120c89` — substituição dos percursos por streams | `WorldStream` centraliza geração, reposição de alvo e encerramento; fábricas configuram exploração, corrida e lição. Boa base para compartilhar terreno sem duplicar regras pedagógicas. |
| `79c889a` — portal próximo e novo tamanho | Portal de 130 × 126, chegada plana e vitória após entrar nele. Há testes de geometria, animação e cena; falta verificar câmera real e diferentes pontos de abertura. |
| `e6b6dfd` — progresso das palavras | IDs `palavra-*` e contagem filtrada evitam somar palavras às conclusões do currículo. Preservar compatibilidade dos saves. |
| `bf3ada7` e ajustes anteriores — controle e acessibilidade | Há testes do detector de pulo e preferências persistidas. Validação física do gesto e cobertura completa do Canvas permanecem pendentes. |
| `e257445` — Android | É um plano em `docs/14-plano-app-android-capacitor.md`, não um app implementado. Manter a decisão de projeto Android separado. |

## Fase 0 — Consolidar a base e o escopo

### 0.1 — Atualizar a documentação do comportamento vigente

- **Tipo/prioridade/esforço:** confirmado; P1; pequeno.
- **Evidência:** `docs/13-revisao-ux-arquitetura.md` ainda descreve exploração livre sem corações ou derrota; `GameScene` atual cria vidas para exploração e aplica penalidade a respostas erradas. `ExploreRun` representa uma palavra ordenada.
- **Plano:** marcar descrições antigas como históricas; alinhar README, DESIGN e documentos de gameplay com três modos atuais; explicitar o significado de Explorar, Aprender e Corrida e registrar quais recursos foram removidos.
- **Aceite:** instruções e telas descrevem a mesma experiência; nenhum recurso removido aparece como disponível; histórico anterior continua identificável.

### 0.2 — Estabelecer cenários reproduzíveis para a implementação

- **Tipo/prioridade/esforço:** proposta; P1; pequeno.
- **Plano:** registrar commit-base, comandos e resultados acima; definir seeds fixas para testes de stream e uma matriz dos três modos com teclado, toque e celular como controle. Cada correção deve começar por um cenário que reproduza o problema.
- **Aceite:** outra LLM consegue executar a base e reproduzir cada regressão sem depender de sorte ou de dados pessoais.
- **Dependência:** nenhuma. Não criar infraestrutura extensa antes de existir necessidade.

## Fase 1 — Corrigir invariantes do mundo e da conclusão

### 1.1 — Limitar o crescimento do mundo em partidas longas

- **Tipo/prioridade/esforço:** confirmado; P1; grande.
- **Evidência:** `WorldStream._appendSegment` acumula segmentos, sólidos, plataformas, perigos e itens. Não há descarte em `update`; `LevelManager.collected` também acumula IDs. O impacto exato em FPS não foi medido.
- **Plano:** manter uma janela de segmentos ativos e margem de retorno; preservar o checkpoint e o alvo; usar índice global independente do tamanho da coleção; descartar IDs antigos; atualizar os caches de física/renderização. Definir se voltar além da janela será bloqueado ou regenerará o mundo deterministicamente.
- **Aceite:** simulação de milhares de segmentos mantém contagens limitadas pela janela; voltar, morrer e reaparecer continuam seguros; medir memória e tempo por frame antes/depois em sessão longa.
- **Dependência:** 0.2. Culling de desenho isolado não resolve retenção de dados.

### 1.2 — Manter distratores coerentes quando o alvo muda

- **Tipo/prioridade/esforço:** risco; P1; médio.
- **Evidência:** `createSpeedrunStream` calcula distratores conforme o alvo da geração. `setTarget` troca apenas os itens `target`; distratores existentes permanecem. `AnswerValidator` aceita pelo rótulo, não pelo campo `type`. Uma letra já espalhada pode tornar-se resposta válida nas etapas seguintes.
- **Plano:** reproduzir avançando vários alvos em um stream determinístico; definir que todo rótulo aceito corresponde ao alvo vigente; retirar ou reclassificar distratores incompatíveis ao avançar, evitando alterações visuais bruscas na tela. Não resolver apenas rejeitando uma letra visualmente correta pelo seu tipo interno.
- **Aceite:** em toda transição A–Z, nenhum item rotulado como distrator equivale à resposta atual; o progresso não avança duas vezes pela mesma coleta; letras visualmente iguais têm comportamento coerente.
- **Dependência:** 0.2; integrar com a janela de 1.1.

### 1.3 — Garantir alvo disponível e caminho até ele

- **Tipo/prioridade/esforço:** risco; P1; médio.
- **Evidência:** `_spawnTarget` retorna silenciosamente se não encontrar posição; `update` só repõe alvo existente que ficou para trás. `_appendSegment` pode voltar a candidatos não filtrados quando faltam posições seguras/alcançáveis. Os testes atuais cobrem várias seeds, mas não esgotamento de posições ou percurso físico completo.
- **Plano:** definir fallback seguro ou falha explícita de conteúdo; recuperar ausência de alvo enquanto a fase não estiver concluída; validar emendas de templates e alcance usando física real, além do predicado local de alcance.
- **Aceite:** fase ativa sempre tem um alvo alcançável ou estado explícito de recuperação; testar pool vazio, posições ocupadas, templates sem posição válida, retorno e respawn; nenhum loop de extensão ilimitado.
- **Dependência:** 1.1 e 1.2.

### 1.4 — Tornar a chegada ao portal consistente

- **Tipo/prioridade/esforço:** risco; P1; médio.
- **Evidência:** `spawnPortal` corta o mundo em `playerX + 420`, preservando itens/perigos anteriores ao corte. A cena continua aceitando coletas após `portalOpen`; `checkpointFor` usa a grade de segmentos mesmo depois do selamento. A visibilidade é estimada em relação ao jogador, não medida pela câmera.
- **Plano:** estabelecer uma chegada sem novas cobranças pedagógicas após a última resposta; validar o trecho entre jogador e portal; limitar checkpoints à geometria preservada; tornar a abertura idempotente; conferir visibilidade pela câmera efetiva e a compatibilidade entre desenho e colisão durante a revelação.
- **Aceite:** abrir portal perto de buracos, emendas, plataformas altas e limites de câmera; cair ou voltar após abrir; chegar com uma vida; não perder a fase por um distrator remanescente após concluir o objetivo; emitir vitória uma vez.
- **Dependência:** 1.3.

### 1.5 — Fechar estados da cena e corrigir métricas derivadas

- **Tipo/prioridade/esforço:** confirmado/risco; P2; médio.
- **Evidência:** o cronômetro da corrida avança antes do ramo `WON`, incluindo a animação final. `remainingItems` subtrai todos os IDs coletados do array atual, embora o stream remova itens. Eventos de perigo não verificam estado em `onHazardHit`, ao contrário das coletas.
- **Plano:** definir término do tempo na entrada do portal e congelá-lo; calcular itens restantes pela interseção com os itens ativos; impedir efeitos de gameplay após derrota/vitória; verificar eventos síncronos no mesmo frame. Confirmar consumidores dessas métricas antes de mudar contratos.
- **Aceite:** duração da animação não altera recorde; contagem nunca fica negativa; colisões simultâneas não duplicam conclusão nem retiram vidas após estado terminal; pausa excluída do tempo.
- **Dependência:** 1.4.

## Fase 2 — Fazer os apoios e feedbacks corresponderem às preferências

### 2.1 — Conectar o nível de apoio às regras atuais

- **Tipo/prioridade/esforço:** confirmado; P1; médio.
- **Evidência:** `supportLevel` é salvo e exposto em `settings-v2.tsx`; sua aplicação encontrada limita-se ao atributo `data-support`, sem consumo pelas regras atuais de gameplay.
- **Plano:** definir comportamentos observáveis para assistido, padrão e desafio; proposta inicial: assistido com destaque do próximo alvo, repetição de instrução e prática sem perda de vidas por erro pedagógico; padrão preserva o atual; desafio varia distratores após validação de conteúdo. Separar ajuda pedagógica de dificuldade motora.
- **Aceite:** alterar a preferência muda a partida seguinte; teste de cada política; configuração explica seu efeito; nenhum modo depende somente de cor para orientar.
- **Dependência:** fase 1.

### 2.2 — Completar movimento reduzido e acessibilidade do Canvas

- **Tipo/prioridade/esforço:** confirmado; P1; médio.
- **Evidência:** sprites e partículas recebem `reducedMotion`, mas tremor de câmera, atração do jogador e flash em `GameScene` não consultam essa preferência. Texto ampliado e contraste são aplicados por CSS; o HUD usa tamanhos e cores próprios no Canvas.
- **Plano:** centralizar a leitura de preferências; oferecer transição discreta sem tremor, sucção ou flash quando movimento reduzido estiver ativo; aplicar escala e contraste aos textos do Canvas; apresentar objetivo e feedback relevante também no DOM, evitando anúncios repetidos a cada frame.
- **Aceite:** testar preferência do sistema e do jogo; palavra mais longa, texto ampliado e menor tela suportada sem corte; menus acessíveis por teclado; validar anúncios com leitor de tela. Não declarar acessibilidade completa da navegação espacial sem testá-la.
- **Dependência:** 2.1 para os apoios; pode iniciar após 1.4.

### 2.3 — Melhorar narração e clareza da montagem de palavras

- **Tipo/prioridade/esforço:** proposta; P2; médio.
- **Evidência:** o HUD acompanha slots; `_advanceExplore` troca a letra esperada sem narrá-la explicitamente. A conclusão abre o portal com uma fala genérica. O feedback de erro referencia a lição da letra corrente.
- **Plano:** oferecer repetir instrução; narrar a próxima letra conforme nível de apoio e a palavra completa ao terminar; coordenar elogio, instrução e portal para não se cancelarem; validar letras repetidas e acentos. Associar palavra a imagem do banco quando disponível.
- **Aceite:** montar palavras com repetição e acentuação; ouvir objetivo sem adulto; nenhuma sobreposição/cancelamento que esconda a instrução principal; respeitar voz desligada e volume configurado.
- **Dependência:** 2.1 e 2.2.

### 2.4 — Validar apresentação e controles em aparelhos reais

- **Tipo/prioridade/esforço:** risco; P2; médio.
- **Plano:** medir proporção do Canvas e legibilidade em retrato/paisagem, tablets e telas alongadas; testar andar+pular simultaneamente, arrastar dedo para fora, interrupção do app e retorno. Para celular como controle, testar o detector após a mudança de empurrão sustentado, reconexão e prevenção de confirmações involuntárias.
- **Aceite:** roteiro registrado com aparelho/navegador; nenhum botão preso após cancelamento ou pausa; HUD e portal visíveis; zero confirmação destrutiva por gesto residual. Corrigir apenas problemas reproduzidos.
- **Dependência:** 2.2 e 2.3. Não considerar viewport emulado equivalente a aparelho físico.

## Fase 3 — Organizar contratos, dados e manutenção

### 3.1 — Separar regras dos modos da orquestração

- **Tipo/prioridade/esforço:** confirmado; P2; grande.
- **Evidência:** `GameScene` concentra ramificações dos três modos; `ExploreRun` mantém regras de letras futuras não usadas pelo stream atual; `GameScene` converte níveis por `as unknown as` e eventos por `as never`. `LevelManager` importa tamanho do portal do módulo gerador.
- **Plano:** extrair políticas pequenas de objetivo, coleta, conclusão e persistência; manter cena responsável por ciclo de vida e apresentação; compartilhar contrato de nível e geometria do portal em módulo neutro; remover legado sem consumidores após conferir referências. Não criar framework genérico de modos.
- **Aceite:** mesmos cenários da fase 1 passam; adicionar uma regra de modo não exige espalhar condicionais; fronteiras de nível/eventos sem casts que ocultem incompatibilidade.
- **Dependência:** fases 1 e 2, com testes de comportamento estabilizados.

### 3.2 — Especificar evidências de aprendizagem por contexto

- **Tipo/prioridade/esforço:** confirmado/proposta; P2; médio.
- **Evidência:** exploração registra respostas usando `this.lesson.id`, que representa uma letra do alfabeto, mas conclui em `palavra-*`. `recordLessonAnswer` mantém oito respostas recentes sem distinguir modo. Isso não é necessariamente erro: falta explicitar a semântica desejada.
- **Plano:** decidir como separar evidência por letra, palavra e modo sem duplicar estatísticas; versionar dados se necessário; preservar estrelas, descobertas e recordes; testar saves antigos e troca de perfil. Agrupar gravações de uma mesma coleta se medições mostrarem custo relevante.
- **Aceite:** montar uma palavra não conclui lições de alfabeto; relatórios distinguem tentativa de palavra e reconhecimento de letra; migração idempotente e sem perda do histórico anterior.
- **Dependência:** 3.1; necessário antes de adaptação pedagógica.

### 3.3 — Remover premissas desatualizadas sobre embeddings

- **Tipo/prioridade/esforço:** confirmado; P2; pequeno.
- **Evidência:** `pickWeighted` aparece no módulo e seus testes, sem consumidor atual no jogo. O build revisado não emitiu `embeddings-data`, apesar de configuração e plano Android preverem esse peso. O comentário sobre JSON ausente também não corresponde a um import estático obrigatório.
- **Plano:** decidir manter a ferramenta como experimento offline ou integrá-la a uma funcionalidade concreta; alinhar comentários e plano Android ao grafo real; se o arquivo puder faltar, estabelecer fallback no build/geração. Não aumentar cache nem adicionar carregamento tardio sem medir necessidade.
- **Aceite:** documentação corresponde aos arquivos emitidos; build e testes funcionam na condição de checkout suportada; eventual seleção semântica tem revisão pedagógica e fallback determinístico.
- **Dependência:** nenhuma; executar antes de otimizações Android.

### 3.4 — Cobrir os fluxos reais e atualização offline

- **Tipo/prioridade/esforço:** proposta; P2; médio.
- **Plano:** adicionar poucos testes de navegador cobrindo perfil → modo → coleta → portal → vitória → próxima fase, além de pausa/retorno; testar versão A para B no menu e durante partida, preservando save; repetir abertura offline e rota de controle.
- **Aceite:** regressões de integração são detectadas além dos testes unitários; relatório diferencia automatizado, manual e não executado; não repetir infraestrutura/testes já existentes sem lacuna demonstrada.
- **Dependência:** fases 1–3. A suíte atual permanece obrigatória.

## Fase 4 — Novas funcionalidades, em incrementos independentes

### 4.1 — Caderno de palavras e revisitação

- **Tipo/prioridade/esforço:** proposta; P2; médio.
- **Plano:** usar descobertas e fases concluídas para uma coleção local de palavras, imagem e pronúncia; permitir repetir palavras já conhecidas sem alterar a próxima fase pendente; acesso secundário sem recriar um menu inicial complexo.
- **Aceite:** coleção isolada por perfil; repetir não bloqueia progresso; funcionamento offline; palavras ainda não visitadas não aparecem como aprendidas.
- **Dependência:** 2.3 e 3.2.

### 4.2 — Prática orientada por dificuldades recentes

- **Tipo/prioridade/esforço:** proposta; P3; grande.
- **Plano:** usar evidências locais para sugerir pequenas revisões de letras/sílabas confundidas, com regras simples e explicáveis; permitir ignorar sugestões; não inferir diagnóstico ou domínio definitivo a partir de poucas respostas.
- **Aceite:** exemplos determinísticos de recomendações; separação entre erro motor e pedagógico; apoio e ritmo ajustáveis; sem bloquear conteúdo já liberado.
- **Dependência:** 3.2 e observação do uso de 4.1. Embeddings não são pré-requisito.

### 4.3 — Retomar uma palavra em andamento

- **Tipo/prioridade/esforço:** proposta; P3; grande.
- **Plano:** persistir estado mínimo versionado da sessão: modo, palavra, posição da letra, política de vidas e seed quando necessária; reconstruir um trecho seguro ao retomar; preservar exploração e currículo separadamente; não salvar o mundo infinito inteiro.
- **Aceite:** fechar e reabrir retoma sem duplicar respostas ou recompensa; save incompatível oferece reinício seguro; troca de perfil não mistura sessões; escolher explicitamente se corrida permite retomada e como afeta recordes.
- **Dependência:** 1.1 e 3.2.

## Fase 5 — Refinar o plano Android e preparar a futura entrega

### 5.1 — Transformar o plano existente em tarefas verificáveis

- **Tipo/prioridade/esforço:** proposta; P2; médio para planejamento; implementação do app é projeto separado.
- **Evidência:** `docs/14` já decide Capacitor em outro repositório e exclusão do controle remoto. `StorageAdapter` atual é síncrono. O bundle real não confirma o custo atribuído aos embeddings.
- **Plano:** fixar commit de origem e estratégia para portar correções; mapear referências ao controle remoto antes de removê-las; verificar contrato assíncrono do armazenamento nativo escolhido e planejar hidratação/flush/migração; definir testes de suspensão, botão voltar, offline e áudio. Separar migração de storage dentro do app de eventual transferência de progresso da PWA: não presumir que os dois compartilham dados.
- **Aceite:** tarefas incluem arquivos afetados, ordem de inicialização, tratamento de falha de gravação e teste de atualização; a versão web mantém o controle remoto; decisões de identidade/assinatura são registradas antes de eventual transição TWA → app.
- **Dependência:** fase 3; incorporar 3.3. Funcionalidades opcionais da fase 4 não bloqueiam o app.

### 5.2 — Medir antes de trocar tecnologia ou publicar

- **Tipo/prioridade/esforço:** proposta; P2; grande.
- **Plano:** no novo projeto, medir abertura, memória e distribuição de tempo por frame em aparelhos representativos; incluir sessão longa de stream, áudio offline e retomada. Definir orçamento de desempenho antes da avaliação. Validar licenças dos assets e áudios; revisar requisitos oficiais vigentes das lojas e declarações conforme comportamento efetivo do binário.
- **Aceite:** evidências em aparelhos reais e critérios definidos antes do teste; gargalos identificados antes de propor troca de engine; testes do ciclo de vida e persistência aprovados. Publicação e criação do app não fazem parte desta entrega documental.
- **Dependência:** 5.1 e correções críticas das fases 1 e 2.

## Ordem sugerida e instruções para a próxima LLM

1. Executar fase 0 e confirmar a base, pois o código pode ter mudado desde esta revisão.
2. Priorizar fase 1: invariantes do stream, conclusão e segurança do respawn.
3. Completar fase 2, principalmente preferências que hoje não produzem o efeito esperado.
4. Executar fase 3 para sustentar manutenção e futuras funcionalidades.
5. Escolher incrementos da fase 4 conforme uso observado; avançar Android pela fase 5 sem exigir os opcionais.

Para cada item, implementar uma mudança revisável, registrar o cenário anterior e comprovar o aceite. Rodar `npm run typecheck`, `npm test` e `npm run build` após mudanças pertinentes. Testes em aparelho e navegador devem ser explicitamente registrados como executados ou pendentes. Não transformar riscos deste documento em bugs confirmados sem reprodução. Não restaurar funcionalidades removidas nem alterar decisões de plataforma silenciosamente.

Este arquivo complementa os documentos 13 e 14: registra o estado atual e o trabalho futuro, sem executar nenhuma fase.

## Registro de execução (24/09/2026, sobre `e257445`)

Base reconfirmada antes das mudanças: 658 testes em 75 arquivos, typecheck e build iguais à tabela acima. Depois: **703 testes em 78 arquivos**, typecheck e build aprovados (bundle principal 356,56 kB / 111,45 kB gzip; precache 38 entradas, 2091,38 KiB). Todos os cenários novos usam seeds fixas (`seeded(n)` em `world-stream.test.ts`) ou `random: () => 0.42` nos testes de cena.

| Item | Estado | O que foi feito / evidência |
| --- | --- | --- |
| 0.1 | Feito | `docs/13` marcado como histórico (quintal removido); README, DESIGN e `docs/02` descrevem os três modos, níveis de apoio, portal e acessibilidade vigentes. |
| 0.2 | Feito | Esta seção; seeds fixas nos testes novos. Matriz teclado/toque/celular permanece manual (ver 2.4). |
| 1.1 | Feito | `WorldStream` mantém 2 trechos atrás + atual + 2 à frente, parede e `camera.minX` no limite; voltar além da janela é **bloqueado**. `LevelManager.pruneCollected`. Medição Node (sem render), 60 min simulados: antes 2520 sólidos / 739 itens, depois 25 / 7; `update`+física ~0,0018 → ~0,0005 ms/quadro. Memória e FPS em navegador/aparelho **não medidos**. |
| 1.2 | Feito | Risco reproduzido (distrator "C" espalhado para "A" virava resposta válida). `setTarget` retira distratores fora do pool do novo alvo e reporta via `drainWithdrawn`; a cena faz um "puf" nos visíveis. `LevelManager` ignora itens retirados no mesmo quadro. Teste A–Z com 10 seeds. |
| 1.3 | Feito | Fallback: alvo toma a posição mais próxima adiante; sem posição alguma, `update` reoferece. Testes de pool vazio, posições ocupadas, ausência de alvo e **física real** (toque rápido alcança cada posição de cada template; andar não alcança) e emendas com chão. |
| 1.4 | Feito | `spawnPortal` idempotente, corta dentro da câmera efetiva (`visibleRight`), retira todas as letras; após o objetivo coletas são ignoradas e espinhos não tiram coração; checkpoint limitado ao chão de chegada; portal só aceita entrada revelado por completo. Visibilidade real na tela **não validada em navegador**. |
| 1.5 | Feito | Cronômetro só avança em `RUNNING` (para na entrada do portal, exclui pausa); `remainingItems` pela interseção; perigo, derrota e vitória ignorados em estado terminal; `finishLevel` idempotente (achado durante os testes). |
| 2.1 | Feito | `gameplay/support-policy.ts`; efeitos na tabela de `docs/02`; texto da configuração explica cada nível. |
| 2.2 | Feito (parcial) | Movimento reduzido sem tremor/sucção/flash; HUD do Canvas com escala e alto contraste (também `prefers-contrast`), textos encolhem para caber; região ARIA live para objetivo/feedback. **Pendente:** validação com leitor de tela e na menor tela física. |
| 2.3 | Feito (parcial) | Botão ♫ repete a instrução; próxima letra e palavra completa narradas em fila (`interrupt: false`) sem cancelar o elogio. **Pendente:** imagem do banco junto da palavra; audição sem adulto. |
| 2.4 | Pendente | Exige aparelhos reais. |
| 3.1 | Parcial | `PORTAL_SIZE` em `core/config.ts`; `GameScene` sem `as unknown as`/`as never` (payload de `ITEM_COLLECTED` tipado); removidas dicas "letra futura" sem consumidores (`isAhead`, `claimFutureHint`). Extração de políticas de objetivo/coleta por modo **não** feita. |
| 3.2 | Pendente | Decisão de produto sobre evidência por letra/palavra/modo. |
| 3.3 | Feito | Módulo de embeddings mantido como experimento offline; comentários (`embedding-select.ts`, `vite.config.js`) e `docs/14` alinhados ao bundle real. |
| 3.4 | Pendente | Testes de navegador/atualização offline. |
| 4.x, 5.x | Não iniciados | Opcionais / projeto Android separado. |
