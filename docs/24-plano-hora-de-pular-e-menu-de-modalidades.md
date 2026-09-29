# 24 — Menu de modalidades e Hora de pular

Data: 29/09/2026. **Status: planejamento; não implementado nem validado em aparelho.**

Este plano detalha a proposta discutida para dividir o jogo em **Aventura das letras** e **Hora de pular**, entregando Pulo livre, Jardim dos pulos e comemoração. Define comportamento, arquitetura, implementação incremental e critérios de aceite. Valores de metas, animações e tolerâncias aqui sugeridos são parâmetros de protótipo, não resultados de teste com crianças.

## 1. Objetivo e decisões de escopo

Criar uma brincadeira em que a criança pula com o celular conectado e vê Nicolas ou Eloá responder na tela, com contagem de pulos detectados e transformação do cenário. Preservar integralmente a experiência de alfabetização e seu progresso.

Decisões acordadas na conversa:

- Tela inicial com duas entradas: Aventura das letras e Hora de pular.
- Aventura das letras reúne as funcionalidades atuais: lições, Explorar, Corrida do alfabeto e Caderno.
- Hora de pular tem Pulo livre e Jardim dos pulos.
- Comemoração integra o encerramento da missão; não é uma terceira atividade no menu.
- Perfil, personagem, preferências gerais e pareamento são compartilhados. Progresso é separado por modalidade.
- Cada pulo válido deve atualizar a contagem mesmo quando o personagem ainda está animando o anterior.

Propostas de implementação deste documento:

- Jardim inicial com uma missão curta, sem limite de tempo, perda de vidas ou exigência de ritmo.
- Primeira entrega com celular como fonte dos pulos contabilizados; teclado continua disponível para navegação e pausa.
- Apresentação com personagem em posição horizontal fixa e salto visual, sem percurso de plataforma.
- Histórico local mínimo, sem ranking, calorias, estimativa de altura, metas diárias ou comparação entre crianças.
- Manter ajustes finos e diagnóstico fora da tela da brincadeira.

## 2. Base atual e dependências

Referências: [arquitetura](01-arquitetura.md), [input](03-abstracao-de-input.md), [SOLID](05-solid-e-padroes-de-projeto.md), [controle por celular](12-controle-por-celular.md), [estabilidade](19-plano-estabilidade-controle-celular.md), [UX mobile](22-auditoria-ux-mobile-e-plano-de-implementacao.md) e [validação](23-validacao-implementacao-planos-17-a-22.md).

Inspeção feita no workspace, que já continha alterações locais em sensor/conexão, cenas e documentação. A seção 7 do documento 23 registra problemas de uma revisão anterior; o código local já contém mudanças posteriores em armamento e filtragem. Antes de implementar, conferir o diff e executar os testes pertinentes; não reaplicar correções com base apenas no registro histórico, nem declarar essas alterações aceitas sem validação.

| Base existente | Aproveitamento e atenção necessária |
| --- | --- |
| `src/controle/jump-detector.ts` | Detecta o gesto e pode emitir na decolagem ou aterrissagem. Não prometer sincronia exata nem contar as duas etapas como dois pulos. |
| `src/net/phone-control-coordinator.ts` | Dono do pareamento e saúde. `engage()` atualmente combina celular e auto-run; novo modo precisa de configuração sem corrida automática. |
| `src/net/phone-viewer-transport.ts` | Filtra eventos antes de entregá-los. Evitar múltiplos consumidores executando o mesmo filtro mutável. |
| `src/input/input-manager.ts` | `_pressed` é um `Set`: dois eventos da mesma ação antes da leitura podem virar uma única intenção. Não serve como contador físico. |
| `src/scenes/menu-scene.ts` e `src/ui/menu.ts` | Integram menus, configurações e pareamento; preservar retornos e evitar concentrar mais regras de atividade nessa cena. |
| `src/persistence/save-store.ts`, `profile-store.ts`, `progress-store.ts`, `migration.ts` | Documento versionado compartilhado; evolução aditiva, por perfil, com migração testada. |
| `src/architecture.test.js` | Garante fronteiras de input e React; estender as garantias ao novo domínio. |

Pré-requisito para aceite do modo: saúde da geração atual, retomada válida de sessão longa, join idempotente e descarte de comandos antigos demonstrados em testes. Aceite físico do plano 19 continua necessário. Desenvolvimento de telas e domínio pode avançar antes desse aceite; liberação da atividade depende dele.

## 3. Organização da navegação

### 3.1 Tela inicial

```text
              Aventura do Nicolas&Eloá
          Jogador: Nicolas · Trocar jogador
             Personagem · Trocar personagem

      [ Aventura das letras ]  [ Hora de pular ]
       Letras e palavras        Movimento e diversão

                    Configurações
```

Dois cartões grandes, com ilustração e rótulo legível. Em retrato, empilhar; em paisagem, colocar lado a lado quando houver espaço real. Ambos têm peso visual equivalente; usar uma única ação dourada apenas nas telas em que existir uma ação principal inequívoca. Não inventar preferência automática por uma modalidade.

Nome do jogador e personagem são conceitos distintos: trocar personagem altera aparência, trocar jogador altera o proprietário do progresso. Conferir o fluxo atual, pois o retrato da home abre a seleção de personagem; não apenas renomear esse botão como troca de jogador.

Aviso inicial aos responsáveis e convite de tela cheia continuam no fluxo existente, antes da navegação normal. Não repetir esses diálogos ao entrar em cada modalidade. Abrir o aplicativo leva à escolha de modalidade; o retorno de uma atividade leva à sua área.

### 3.2 Aventura das letras

Reutilizar a composição atual como submenu, com título e ação explícita “Voltar ao início”. Manter:

- Próxima descoberta e progresso pedagógico do jogador.
- Começar/Continuar aventura e Escolher aventura.
- Explorar, Corrida do alfabeto e Caderno de descobertas.
- Acesso secundário às Configurações, com retorno à origem.

Lições, estrelas, palavras descobertas e recorde da corrida permanecem iguais. Não mover regras pedagógicas para o novo hub.

A escolha inicial acrescenta uma ativação aos fluxos existentes. Registrar essa mudança no plano 22 e reconciliar o orçamento de navegação do plano 20: não afirmar que o mapa agora atende ao antigo limite de três escolhas. Medir separadamente entrada no módulo e navegação interna. Começar a próxima lição exige duas escolhas desde o hub, desconsiderando os diálogos de primeira utilização.

### 3.3 Hora de pular

```text
                   Hora de pular
                 Jogador: Nicolas

           [ Pulo livre ]  [ Jardim dos pulos ]
           Pule no seu ritmo   Faça uma flor crescer

          Celular: conectado / precisa conectar
                   [ Conectar celular ]

          Última brincadeira: 8 pulos detectados
                   Jardins concluídos: 2
                   Voltar ao início
```

Sem histórico, usar uma frase convidativa no lugar dos números. O contador da sessão aparece durante a atividade e no resumo; no submenu, mostrar apenas o último resultado e jardins concluídos. Não expor soma de pulos de toda a vida como meta competitiva.

“Conectar celular” vira “Ver conexão” quando pareado; pareamento sozinho não equivale a sensor operacional. Explicar estados como “Verificando movimentos” e “Precisamos reconectar”. Diagnóstico detalhado permanece em suporte.

### 3.4 Rotas e retornos

| Origem/ação | Destino e comportamento |
| --- | --- |
| Hub → letras | Submenu pedagógico com dados atuais. |
| Hub → pulos | Submenu de movimento com dados do mesmo perfil. |
| Pulos → atividade sem conexão | Pareamento → preparação → atividade escolhida. |
| Cancelar pareamento/preparação | Submenu de pulos; limpar intenção pendente. |
| Configurações abertas em uma área | Voltar à área de origem, restaurando foco. |
| Pausar atividade → sair | Finalizar parcialmente e voltar ao submenu de pulos. |
| Resultado → descansar | Submenu de pulos, sem início automático de outra sessão. |
| Resultado → brincar novamente | Nova sessão e nova preparação curta; pareamento reaproveitado. |
| Letras ↔ pulos pelo hub | Conservar perfil, preferências e conexão; desarmar entrada durante menus. |

Representar destino pendente como dado tipado, por exemplo `{ area: 'movement', activity: 'garden' }`, junto ao perfil de origem. Evitar callbacks duradouros que capturem perfil antigo. Troca de perfil ou cancelamento invalida o destino pendente. Só uma navegação pode consumir a intenção após o pareamento.

## 4. Preparação, início e interrupções

O uso previsto tem uma tela principal visível e o celular como controle preso ao corpo, conforme o fluxo já existente. A primeira versão não depende de a criança olhar ou tocar o celular enquanto pula.

1. Selecionar atividade.
2. Reutilizar conexão operacional ou abrir pareamento.
3. Mostrar uma instrução curta, visual e narrável: posicionar o celular na bolsinha, deixar espaço para brincar e acompanhar a tela com o responsável.
4. Oferecer teste com dois pulos detectados, apenas para verificar resposta. Não somar ao resultado nem transformar o teste em recalibração automática. Se não detectar, oferecer ajuste/recalibração pelo fluxo existente ou voltar.
5. Mostrar “Começar”, acionado na tela principal; contagem regressiva sugerida de três segundos, cancelável. Pulos nesse intervalo não contam.
6. Armar a entrada apenas ao começar a atividade. No replay, permitir pular a explicação já vista, mantendo verificação de conexão e início explícito.

O contador representa **pulos detectados e aceitos durante a atividade**, não uma medição garantida de todos os movimentos reais. Não estimar esforço físico nem prescrever duração de exercício.

| Interrupção | Tratamento |
| --- | --- |
| Pausa manual | Congelar tempo ativo e contagem; descartar eventos recebidos durante a pausa. |
| Sensor parado, tela do controle oculta ou conexão perdida | Pausar com motivo simples; manter progresso em memória e oferecer reconexão. |
| Conexão recuperada | Exigir “Continuar”, renovar armamento e fazer preparação curta; nunca reproduzir pulos atrasados. |
| Tela principal perde foco ou entra em retrato | Reutilizar política de pausa/orientação do jogo. Controle pode continuar em retrato. |
| Sessão remota encerrada | Oferecer novo pareamento para continuar a sessão local ou encerrar com resultado parcial. |
| Recarregar/fechar tela principal | Não retomar automaticamente atividade física; mostrar menu e último checkpoint salvo, identificado como interrompido. |

Tempo de pausa e preparação não integra duração ativa. Usar relógio monotônico injetável para intervalos; data civil apenas para registro do resultado.

## 5. Item 1 — Pulo livre

### Experiência

Personagem central, chão estável e fundo do quintal. HUD DOM com contador grande, “Pulos detectados”, Pausar e Encerrar. Sem plataforma, inimigo, coração, cronômetro competitivo ou objetivo obrigatório.

A cada evento válido:

1. Incrementar o contador exatamente uma vez.
2. Atualizar o HUD e emitir feedback visual imediato.
3. Acionar/reajustar a animação do personagem, sem bloquear a contagem.
4. Tocar efeito discreto, sujeito às preferências de áudio e sem acumular sons.

Ao encerrar, mostrar resumo com pulos detectados e ações “Descansar” e “Brincar novamente”. Zero pulos também permite sair normalmente, sem mensagem de falha. Duração pode integrar o registro de suporte/local, mas não precisa aparecer para a criança na primeira entrega.

### Critérios específicos

- Sem encerramento forçado por quantidade de pulos.
- Contagem permanece correta com vários eventos aceitos no mesmo quadro.
- Pausar, sair e repetir não transportam eventos para a próxima sessão.
- Eventos de tecla, toque, preparação e demonstração não inflam o resultado físico.
- Encerrar é sempre acessível na tela principal e por navegação de teclado sem depender do sensor.

## 6. Item 2 — Jardim dos pulos

### Experiência

Uma semente visível ao lado do personagem cresce conforme os pulos detectados. Narração inicial sugerida: “Vamos ajudar esta flor a crescer? Pule no seu ritmo.” Objetivo visual e textual: “Faça a flor crescer” e “3 de 8 pulos”.

Proposta inicial de conteúdo: **8 pulos por jardim**, configurados em dados, sujeitos ao teste de compreensão e conforto. Não apresentar esse valor como recomendação física. Primeira versão tem uma única meta; evitar seletor de dificuldade antes de validar a experiência básica.

| Progresso sugerido | Estado visual |
| --- | --- |
| 0 | Terra e semente. |
| 1–2 | Broto surgindo. |
| 3–4 | Caule crescendo. |
| 5–7 | Folhas e botão da flor. |
| 8 | Flor aberta; missão concluída. |

Armazenar marcos proporcionalmente à meta ou validar intervalos junto ao conteúdo; mudar a meta não pode deixar estágios inacessíveis. Cada evento tem feedback, mesmo quando não muda o estágio da planta.

Não há perda de progresso por esperar, interrupção ou ritmo irregular. O primeiro evento que alcança a meta encerra a coleta de pulos de forma síncrona e inicia comemoração. Eventos restantes do mesmo lote não entram no resultado nem iniciam outro jardim. Resultado da missão completa fica limitado à meta.

Ao sair antes da meta, registrar sessão parcial, sem aumentar jardins concluídos. Primeira versão não oferece retomada de jardim entre aberturas; durante uma pausa da mesma sessão, mantém o estágio. Explicar no botão de saída que a brincadeira será encerrada, sem diálogo extra de confirmação para essa ação reversível de navegação.

### Conteúdo e variações

Definição de missão sugerida: identificador estável, revisão de conteúdo, meta, marcos visuais, rótulo, instrução narrável e identificadores de assets. O domínio recebe uma definição validada; não conhece caminhos de imagens.

Variações posteriores podem trocar flor, fundo e efeito final usando a mesma regra. Não criar subclasses por cor de planta. Se houver sementes diferentes, oferecê-las como escolha estética, sem aumentar exigência física para desbloquear conteúdo essencial.

## 7. Item 3 — Comemoração e resumo

Jardim completo mostra flor aberta e personagem comemorando. Sugestão de duração: até dois segundos de efeito, com botão de saída disponível desde o início. Depois, resumo estável. Texto sugerido: “Seu jardim floresceu! 8 pulos detectados.”

No Pulo livre e na saída parcial, usar fechamento breve e acolhedor: “Você brincou com Nicolas! 5 pulos detectados.” Sem mostrar flor completa ou som de missão concluída quando a meta não foi atingida.

- “Descansar” é ação principal; “Brincar novamente” é secundária e explícita.
- Nenhuma repetição automática, contagem regressiva para recomeçar ou cobrança por sair.
- Com redução de movimento, substituir partículas/salto decorativo por pose estática, flor final e texto; preservar o contador e a compreensão da conquista.
- Narração não repete a cada renderização; interromper ao navegar ou iniciar outra instrução.
- Salvar resultado uma única vez, independentemente de skip, término da animação ou clique duplo.
- Falha em áudio ou carregamento de arte não impede resumo e botões.

## 8. Personagem, animação e assets

Separar a reação visual do salto físico de plataforma. No novo cenário, o personagem fica em uma posição fixa e recebe uma trajetória visual curta, parametrizada, sem alterar `PlayerController` nem introduzir outra aplicação de impulso físico fora dele.

Política proposta para eventos durante uma animação:

- Contador e indicador de recebimento respondem imediatamente a cada evento aceito.
- Se o personagem estiver no chão, iniciar o salto visual.
- Se estiver no ar, ajustar a curva a partir da posição atual com transição contínua e tempo restante limitado. Não criar fila ilimitada de saltos que continue depois que a criança parar.
- Se chegarem vários eventos no mesmo quadro, manter todos na contagem e agrupar apenas sua apresentação visual; não prometer um ciclo completo de sprite para cada evento.
- Pausa congela a apresentação; saída cancela animações e efeitos. Redução de movimento usa pose/realce sem deslocamento amplo.

Começar reutilizando sprites e poses existentes. Prototipar a planta com formas Canvas ou arte já licenciada; decidir sobre novos bitmaps depois de validar o ciclo. Registrar procedência e licenças de qualquer novo recurso. Não gerar ou importar pacotes de arte apenas para cumprir este plano.

Separar reação inicial de processamento do sensor e transporte: alvo de software é feedback no próximo quadro renderizado após aceitação. Atraso entre pulo real e feedback precisa ser medido em aparelho; detecção na aterrissagem pode produzir comportamento diferente da decolagem.

## 9. Arquitetura proposta e SOLID

### 9.1 Responsabilidades

Nomes abaixo são propostas de arquivos novos; confirmar convenções durante a implementação.

| Componente | Responsabilidade e dependências |
| --- | --- |
| `src/ui/screens/activity-hub.tsx` | Renderizar escolha das duas áreas, perfil e callbacks. |
| `src/ui/screens/movement-menu.tsx` | Mostrar atividades, resumo local e situação simplificada do celular. |
| `src/ui/screens/movement-hud.tsx` e `movement-result.tsx` | Exibir modelos de apresentação e emitir intenções; sem importar domínio. |
| `src/ui/movement-presenter.ts` | Fachada TypeScript da UI, expondo modelos simples e callbacks para a cena. |
| `src/scenes/movement-scene.ts` | Orquestrar sessão, entrada, pausa, apresentação e persistência; sem regras de contagem dentro do desenho. |
| `src/gameplay/movement/movement-session.ts` | Estado puro da brincadeira, contagem, tempo ativo e conclusão. |
| `src/content/movement-activities.ts` | Definições validadas de atividades e marcos. |
| `src/input/movement-event-source.ts` | Contrato de fonte discreta de eventos semânticos, cancelável e sem dependência do domínio. |
| `src/render/movement-renderer.ts` | Desenhar personagem/planta a partir de snapshot, sem escrever progresso. |
| `src/persistence/movement-progress-store.ts` | Checkpoints e resultados por perfil, usando o `SaveStore` existente. |
| Coordenador e transporte existentes | Sessão remota, saúde e validação única dos comandos, compartilhadas pelas modalidades. |

Não é obrigatório um arquivo por pequena função. Manter a divisão quando houver responsabilidade ou ciclo de vida distinto; evitar abstrações sem uso concreto.

### 9.2 Aplicação dos princípios

| Princípio | Decisão verificável |
| --- | --- |
| S — responsabilidade única | Detector identifica gesto; transporte valida mensagem; sessão conta; renderer anima; store persiste. Nenhum deles acumula essas cinco funções. |
| O — aberto/fechado | Novos jardins entram por dados. Nova regra, como ritmo, pode adicionar uma política quando existir demanda, sem condicionar toda a cena por modalidade. |
| L — substituição | Fonte real e fonte falsa seguem a mesma entrega discreta, ordem e cancelamento; repositório em memória e persistente têm a mesma semântica de checkpoint. |
| I — segregação | Domínio recebe evento/relógio, UI recebe snapshot/callbacks; nenhum exige socket, `Game` inteiro ou acesso ao storage para funcionar. |
| D — inversão | Construção em `main.ts`; sessão recebe dependências pequenas, sem buscar singletons ou acessar `localStorage`. |

Usar TypeScript estrito, união discriminada para estados e validação de dados nas fronteiras. Evitar `any`, herança extensa, event bus genérico novo, framework de estado ou contêiner de injeção. A complexidade deve responder a requisitos presentes.

React permanece em `src/ui/`; componentes TSX não importam `core`, `gameplay`, `render`, `physics` ou `scenes`, inclusive para obter tipos. Modelos de apresentação vivem na fachada UI; a cena mapeia snapshots para esses modelos. Motor continua sem importar React.

### 9.3 Fluxo dos eventos e risco de consumo duplo

```text
Sensor → detector → mensagem remota → validação única no transporte
                                         ↓
                             fonte semântica da atividade
                                         ↓
                           sessão de movimento em execução
                               ↙                     ↘
                       snapshot da UI           reação visual
                               ↓
                     checkpoint / resultado local
```

O `onMessage` atual instala um handler que chama um filtro com estado. Assinar separadamente para contador e animação faria o primeiro consumidor avançar a sequência e o segundo descartar o mesmo evento. **Não adicionar duas assinaturas independentes sobre esse caminho.**

Proposta: transporte filtra uma vez por mensagem recebida e distribui o evento já aceito; a atividade tem um único consumidor de domínio, que produz snapshot e reação visual. Confirmar ciclo de instalação/remoção do listener de socket. Domínio não conhece `generation`, `seq`, tokens nem sincronização de relógios.

Criar fonte discreta para movimento, preservando cada pulso aceito em vez de usar `consumePressed(JUMP)` como contador. Se usar fila, ela deve ser limitada, limpa em pausa/saída e ter política explícita de saturação: pausar com diagnóstico, sem descartar silenciosamente e continuar apresentando precisão falsa. Preferir entrega síncrona leve à sessão e atualização visual no próximo quadro.

O modo de letras continua usando `InputManager` e `PlayerController`. Não alterar o contrato booleano de todas as ações para resolver uma exigência específica de contagem.

### 9.4 Pareamento e armamento

Separar posse da conexão de posse da entrada da atividade. Estender o coordenador com uma configuração tipada ou estratégia pequena de consumo:

- Letras: celular produz ação semântica de pulo e auto-run existente.
- Movimento: celular produz eventos discretos, sem `AutoRunAdapter`.
- Menu, preparação, pausa e resultado: conexão preservada; contagem desarmada.

O coordenador conhece o contrato de consumo, não regras de jardim. Trocar consumo deve remover o anterior, limpar pendências e estabelecer nova fronteira de armamento. Não manter adaptador de plataforma contando junto com o novo módulo.

A saúde operacional e o estado da atividade são condições distintas: conexão saudável durante pausa não autoriza contar. Retomada exige saúde atual, confirmação do usuário e nova fronteira para rejeitar pulos feitos na pausa, mesmo na mesma conexão. Reutilizar a política de expiração do plano 19 e sua validação temporal; não comparar timestamps de dispositivos presumindo relógios iguais.

## 10. Máquina de estados

| Estado | Aceita pulos para resultado? | Saídas principais |
| --- | --- | --- |
| `preparing` | Não; teste separado | Começar → `countdown`; cancelar → menu. |
| `countdown` | Não | Final → `running`; falha/cancelamento → preparação. |
| `running` | Sim, apenas fonte física válida | Pausa → `paused`; meta → `celebrating`; encerrar → `result`. |
| `paused` | Não | Continuar saudável → `countdown`; encerrar → `result`. |
| `celebrating` | Não | Fim/skip → `result`; saída sempre disponível. |
| `result` | Não | Descansar → menu; repetir → nova sessão em preparação. |
| `disposed` | Não | Estado terminal; callbacks tardios ignorados. |

Domínio distingue resultado `completed`, `ended` e `interrupted`. `completed` exige meta do jardim; Pulo livre encerrado usa `ended`. Desconectar não finaliza imediatamente: pausa permite recuperação. Fechar a sessão ou recarregar sem conclusão deixa checkpoint interrompido.

Invariantes:

1. Contador é inteiro não negativo e só cresce em `running`.
2. Evento duplicado ou antigo é rejeitado antes do domínio.
3. Jardim conclui no máximo uma vez por `sessionId`.
4. Tempo ativo não inclui pausa, menu, regressiva ou comemoração.
5. Resultado e perfil proprietário são fixados ao iniciar; nunca consultar o perfil corrente para salvar uma sessão antiga.
6. Sair libera listeners, efeitos, narração e captura de entrada sem necessariamente desconectar o celular.

## 11. Persistência e separação de dados

Adicionar ao perfil um campo próprio de movimento, mantendo `progress`, `stats`, `learning`, descobertas e recorde pedagógico intactos. Incrementar a versão do documento com migração pura e normalização; número exato depende da versão encontrada ao implementar.

Modelo ilustrativo, a ajustar ao estilo atual:

```ts
interface MovementProgress {
  completedGardens: number;
  lastSession: {
    sessionId: string;
    activityId: 'free-jump' | 'garden';
    contentRevision: number;
    detectedJumps: number;
    targetJumps: number | null;
    activeDurationMs: number;
    status: 'in-progress' | 'completed' | 'ended' | 'interrupted';
    updatedAt: number;
  } | null;
}
```

Não manter histórico ilimitado ou amostras brutas do sensor. Salvar checkpoints em fronteiras de estado e, durante execução, em intervalo limitado sugerido de cinco segundos. Não escrever em disco a cada quadro. Se a página fechar abruptamente, os eventos posteriores ao último checkpoint podem não ser recuperados; comunicar essa limitação no teste e não prometer contagem durável a cada gesto.

Ao concluir, atualizar último resultado e total de jardins numa única operação do `SaveStore`. Garantir idempotência usando sessão/estado persistido, mesmo se finalização for chamada duas vezes. Uma sessão antiga não pode sobrescrever uma mais nova; apenas uma sessão ativa por instância do jogo. Uso simultâneo de múltiplas abas não ganha sincronização nova nesta entrega e deve ser documentado/testado conforme limitações do storage atual.

| Operação | Efeito esperado |
| --- | --- |
| Migrar save antigo | Inicializar movimento vazio; preservar todos os dados pedagógicos. |
| Trocar perfil | Ler progresso de movimento do novo perfil; não compartilhar resultados. |
| Trocar personagem | Alterar aparência; manter resultados do perfil. |
| Zerar progresso das letras | Limpar somente os dados pedagógicos com texto de confirmação específico. |
| Zerar progresso dos pulos | Limpar somente movimento, com confirmação específica. |
| Excluir jogador / apagar todos os dados | Incluir movimento no escopo já confirmado da exclusão. |
| Storage indisponível/cheio | Continuar em memória e informar ao responsável que o resultado pode não ficar salvo. |

Revisar o rótulo genérico atual “Zerar progresso” para que a nova separação não torne a ação ambígua. Integrar movimento aos fluxos existentes de exportação/exclusão de dados se aplicáveis. Atualizar a documentação de privacidade descrevendo exatamente os campos novos, sem ampliar coleta de sensor ou telemetria remota.

## 12. UI/UX, acessibilidade e desempenho

- Preservar paleta, tipografia, personagens e componentes definidos em `DESIGN.md`.
- Cartões e botões com pelo menos 48 px, foco visível e nomes acessíveis. Não usar apenas emoji para identificar atividade.
- Menus em retrato/paisagem; atividade principal em paisagem conforme política atual. Safe areas e espaço do HUD medidos, sem cobrir personagem ou contador.
- Texto funcional em `rem`. Reorganizar composição antes de reduzir dimensões. Com zoom/texto ampliado, permitir fallback vertical alcançável sem corte horizontal.
- Contador e ações em DOM, com representação visual no Canvas apenas se houver necessidade; evitar duas regiões acessíveis anunciando a mesma informação.
- Leitor de tela anuncia início, pausa, conclusão e marcos, sem uma fala por pulo. Não colocar o contador de alta frequência em uma região viva intrusiva.
- Narração e ícone complementam texto. Som desativado ou falha de síntese não bloqueiam instruções.
- Usar política de movimento efetiva já existente, incluindo preferência do sistema. Não introduzir flashes, tremor de câmera ou confete obrigatório.
- Na pausa por falha, explicar o que fazer: “O celular parou de enviar movimentos. Confira a conexão.” Mostrar Continuar apenas habilitado quando operacional, e manter Encerrar disponível.
- Reutilizar modo bolsinha do controlador. Na primeira versão o celular não precisa exibir contador ou receber snapshots do jogo; evitar protocolo bidirecional novo sem necessidade.
- Sem RAF adicional para cada planta/efeito. Reutilizar laço existente; suspender trabalho quando oculto e respeitar orçamento de partículas.
- Atualizar React quando o snapshot muda, não em todo tick de física. Contador não requer render de 60 Hz.
- Carregar assets locais via catálogo existente, prever fallback e atualizar cache PWA conforme estratégia atual. Cache do app não torna o controle remoto offline: o serviço de sinalização continua necessário.

## 13. Etapas de desenvolvimento

Cada etapa deve ser uma mudança revisável, com seus testes e documentação. Não estimar prazo fechado antes de validar sensor, migração e navegação.

| Etapa | Entrega | Dependência | Critério de saída |
| --- | --- | --- | --- |
| P0 — conferir base | Revisar alterações locais do plano 19, fronteiras de pausa/armamento e regressões. | Estado atual do workspace. | Testes de geração, retomada longa, join repetido e evento atrasado passam; pendências físicas registradas. |
| P1 — navegação | Hub, submenu de letras preservado, submenu de pulos e retornos por origem. | P0 para integração; telas podem avançar isoladas. | Fluxos reais e restauração de foco testados; nenhuma perda de progresso existente. Não publicar botões para atividades ainda indisponíveis. |
| P2 — domínio e entrada | Sessão pura, fonte discreta, consumo sem auto-run e filtragem única. | P0. | Eventos múltiplos, pausa, conclusão e descarte testados com fontes falsas e transporte. |
| P3 — Pulo livre | Preparação, contador, personagem, pausa e resultado. | P1/P2. | Fluxo completo com sensor sintético e teste inicial em aparelho. |
| P4 — Jardim e comemoração | Definição de missão, estágios da planta, conclusão e efeitos acessíveis. | P3. | Meta exata, animação interrompível e resumo idempotente. |
| P5 — dados | Migração, checkpoints, resumos por perfil e ações de limpeza. | Modelo de P2; pode iniciar antes de P4. | Save antigo preservado, perfis isolados e falha de storage tratada. |
| P6 — aceite integrado | Auditoria visual, aparelhos, áudio, rede, ciclo PWA e atualização dos docs. | P0–P5. | Matriz abaixo preenchida com evidências e limitações; liberação do módulo completo. |

Antes de liberar, revisar `main.ts`, registro de cenas, retornos em `menu-scene.ts`, visibilidade dos controles de toque e todas as verificações que hoje reconhecem apenas a cena `game` como atividade. Pausa por visibilidade, orientação e atualização PWA precisam reconhecer a nova sessão ativa; preferir um contrato pequeno de estado/capacidade a espalhar comparações de nomes de cena.

## 14. Plano de testes e aceite

### 14.1 Automatizados

| Camada | Casos obrigatórios |
| --- | --- |
| Domínio | Zero pulos; vários no mesmo quadro; meta exata; evento além da meta; tempo excluindo pausas; sair cedo; conclusão única; callback após dispose. |
| Entrada/transporte | Duplicata; ordem inválida; geração antiga; atraso na mesma conexão; dois assinantes recebem o mesmo evento validado sem disputar filtro; troca de consumidor; limpeza de fila. |
| Coordenador | Letras com auto-run; movimento sem auto-run; menu/pausa sem contagem; conexão reaproveitada; recuperação sem retomada automática. |
| Detector | Preservar suíte atual; gravações/replays representativos; decolagem mais aterrissagem não geram dois eventos do mesmo gesto. |
| Persistência | Migração de saves legados; normalização; perfis distintos; checkpoint interrompido; finalização duplicada; erro/quota; reset separado; exclusão do perfil. |
| UI e navegação | Hub → área → atividade → resultado; cancelamento do QR; retorno de Configurações; troca de perfil; foco; narração única; redução de movimento. |
| Arquitetura | Domínio sem React/DOM/socket/storage; input sem gameplay; componentes sem motor; renderer sem persistência. |
| Regressão | Próxima lição, Explorar, Caderno, Corrida, pareamento já ativo e atualização PWA durante ambas as atividades. |

Usar relógio e fonte de eventos injetados, sem esperas reais em testes unitários. Testar efeitos observáveis e invariantes, evitando testes que apenas repetem detalhes privados da implementação.

Comandos previstos para a implementação:

```bash
npm test
npm --prefix signaling test
npm run typecheck
npm run build
npm run dev -- --host 127.0.0.1 --port 5173
# Com o servidor local em execução, em outro terminal:
npm run audit:ux -- --url http://127.0.0.1:5173 --out /tmp/aventura-movement-ux
```

Ampliar o harness de auditoria para incluir telas novas e caminhos reais, não apenas capturas isoladas. Cobrir viewports e casos de texto ampliado do plano 22; registrar cortes inalcançáveis separadamente do fallback de rolagem permitido. Canvas exige inspeção visual própria.

### 14.2 Aparelhos e experiência

| Ensaio | Evidência/resultado esperado |
| --- | --- |
| Celular preso ao corpo, telas reais | Registrar aparelho, navegador, posição e sensibilidade; comparar pulos observados, detectados e aceitos. |
| Movimentos sem pular | Caminhar, ajustar bolsinha e tocar celular; registrar falsos positivos, sem afirmar precisão a partir do teste sintético. |
| Ritmos espontâneos | Observar perda de eventos, saltos visuais atrasados e reação percebida; parar o ensaio quando a criança quiser. |
| Rede e ciclo de vida | Queda, bloqueio, background, reload e retomada após mais de dez minutos; nenhuma contagem durante pausa. |
| Uso prolongado do sistema | Aplicar roteiro do plano 19, incluindo sessões de 30 minutos de sistema com pausas e alternância de telas; não pedir 30 minutos contínuos de pulos à criança. |
| Acessibilidade | Texto ampliado, zoom, teclado, leitor de tela, som desligado e redução de movimento. |
| Compreensão | Verificar se a criança distingue as áreas, entende crescimento da planta e encontra saída com apoio apropriado. |
| Dois perfis | Alternar jogadores e personagens; números e progresso permanecem corretamente separados. |

Separar três medidas: movimentos observados → eventos detectados; eventos detectados → entregues/aceitos; eventos aceitos → contador. Para o último trecho, exigir correspondência exata em execução ativa. Para precisão física e latência percebida, registrar resultados e definir tolerâncias a partir do piloto antes do aceite final, sem inventar porcentagens de acerto neste planejamento.

## 15. Riscos e decisões para o piloto

| Risco | Resposta planejada |
| --- | --- |
| Contar balanço do celular como pulo | Testar posicionamento/calibração, oferecer ajuste pelo fluxo existente e usar rótulo “detectados”. |
| Perder pulos por agrupamento de input | Fonte discreta independente do `Set` de ações. |
| Duas assinaturas disputarem sequência | Filtrar uma vez e distribuir eventos aceitos; teste explícito de múltiplos assinantes. |
| Animação continuar depois da criança parar | Evitar fila ilimitada; contador independente e reação com duração limitada. |
| Eventos de pausa aparecerem ao continuar | Desarmar atividade e renovar fronteira temporal, mantendo testes de atraso. |
| Crescimento do menu dificultar letras | Submenu pedagógico preservado, retornos claros e auditoria da ativação extra. |
| Nova persistência apagar progresso antigo | Migração aditiva, fixtures reais anonimizadas ou sintéticas representativas e testes de isolamento. |
| Escopo crescer para plataforma de exercícios | Entregar duas atividades e um fechamento; expansões só após piloto. |

Decisões a confirmar no piloto: meta inicial de 8 pulos; duração do salto visual e comemoração; necessidade de repetir teste de sensor a cada sessão; clareza dos nomes; posição do celular que melhor funciona nos aparelhos disponíveis. Essas decisões não impedem implementar o domínio com parâmetros e preparar as telas.

## 16. Evoluções sugeridas, fora da primeira entrega

| Sugestão | Valor e pré-requisito |
| --- | --- |
| Pule e congele | Alternar movimento/espera; precisa de instrução clara e tolerância que não penalize atraso da rede. |
| Ritmo das estrelas | Sinais visuais/sonoros espaçados; depende de medição de latência e acessibilidade sem áudio. |
| Jardins diferentes | Novas flores e cenários via dados/assets, preservando o mesmo domínio. |
| Metas selecionáveis pelo responsável | Mais controle da rodada; avaliar após o piloto, sem chamar quantidade de medida de capacidade física. |
| Contagem narrada opcional | Pode aproximar movimento e números; evitar sobreposição de falas e validar interesse da criança. |
| Experimentar com botão | Modo acessível de demonstração com resultado claramente separado de pulos físicos; exige contrato explícito de origem da entrada. |

Dificuldade futura deve privilegiar variedade de sequências e atenção. Não atrelar desbloqueio de conteúdo principal a pular mais alto, mais rápido ou competir com outra criança.

## 17. Documentação e definição de concluído

Na implementação, atualizar README, `DESIGN.md` e docs 01/02/03/04/05/06/10/12/19/22 conforme contratos efetivamente alterados. Ajustar a descrição de “três modos” para duas áreas, com os modos pedagógicos dentro de Aventura das letras. Registrar neste documento o que foi entregue e as evidências; não converter propostas em afirmações de funcionamento antes do teste.

Este planejamento permanece no repositório. Exportação ou diário no Obsidian só quando a tarefa envolver explicitamente o vault, respeitando o limite de `AGENTS.md`; não escrever no vault como efeito colateral desta entrega documental.

Checklist de conclusão do módulo:

- [ ] Hub e submenus claros, com retorno correto e dados por modalidade.
- [ ] Pulo livre, Jardim e comemoração entregues juntos no recorte inicial.
- [ ] Contagem exata de eventos aceitos, sem dependência da animação ou física de plataforma.
- [ ] Perfil e conexão compartilhados, progresso separado e saves anteriores preservados.
- [ ] Pausa/retomada/saída/recarga tratadas; comandos antigos não contam.
- [ ] UI acessível, áudio opcional, redução de movimento e fallback de assets.
- [ ] Testes de domínio, integração, persistência, arquitetura e regressão aprovados.
- [ ] Aparelhos e crianças usados no piloto documentados com resultados e limites, sem dados pessoais desnecessários.
- [ ] Critérios físicos do plano 19 e critérios definidos pelo piloto satisfeitos antes da liberação.
- [ ] Documentação de comportamento e histórico de validação atualizados.
