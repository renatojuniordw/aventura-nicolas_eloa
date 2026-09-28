# 20 — Plano de melhorias inspirado em Aventura das Letras

Data da análise: **28/09/2026**. Estado: **primeiro recorte implementado (ver §12)**; demais itens seguem como proposta.

## 1. Objetivo e limites

Evoluir o layout, a variedade das fases e as atividades educativas de Aventura do Nicolas&Eloá, aproveitando ideias do [Aventura das Letras](https://github.com/samarameneses/aventura-das-letras). Priorizar sensação de descoberta, clareza para a criança e diversidade de brincadeiras.

**ESP32 está fora de todo este plano:** não importar firmware, receptor Python, protocolos USB/Wi-Fi ou detecção de pulo desse hardware. Teclado, toque e o controle por celular já existente continuam sendo os meios de entrada do projeto. A estabilidade deste último permanece no [plano 19](19-plano-estabilidade-controle-celular.md).

Preservar Nicolas e Eloá, a identidade visual de [DESIGN.md](../DESIGN.md), TypeScript + Canvas 2D, React na interface, PWA e progresso local. A referência usa Godot; adaptar conceitos, dados e recursos visuais compatíveis, sem transplantar seu motor.

Este documento não altera as regras atuais. As mudanças de comportamento abaixo só passam a valer quando implementadas, verificadas e incorporadas aos documentos oficiais correspondentes.

## 2. Referência consultada e o que mudou

Versão pública identificada: [`bbcd9eb37244f54c4b011081977f254da4f62d82`](https://github.com/samarameneses/aventura-das-letras/commit/bbcd9eb37244f54c4b011081977f254da4f62d82), de **19/09/2026**, com a mensagem “Fix collectible retries and fire contact during jumps”. O commit anterior consultado, de 16/09, atualiza links após transferência do projeto; o de 15/09 acrescenta um prompt de criação personalizável.

Não foi identificada a revisão exata usada como inspiração na criação deste projeto. Portanto, esta é uma comparação do **estado atual**, não uma lista afirmando que todos os recursos surgiram depois da nossa versão.

Fontes primárias:

- [README da referência](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/README.md): dimensão do conteúdo e apresentação geral.
- [Como jogar](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/docs/COMO-JOGAR.md): menus, escolha de fases, continuidade, palavras, vidas, terrenos e corridas.
- [Catálogo de poderes](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/scripts/powers.gd): oito habilidades, duração e recarga.
- [Arquitetura](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/docs/development/ARCHITECTURE.md): separação entre conteúdo, terreno, poderes e apresentação no projeto original.

A referência anuncia 68 fases e 332 atividades, com 100 palavras dissílabas. Aqui, `curriculum.json` contém 16 unidades e 152 lições. **Fase, atividade e lição não são unidades equivalentes**: a expansão deve considerar objetivos e palavras ainda ausentes, não perseguir uma contagem maior. [Fonte: README da referência](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/README.md).

A leitura do guia confirma escolha de fases, aventura contínua opcional, corridas com palavras, pistas silábicas e terrenos com rio, ponte e lava. O catálogo implementa supervelocidade, pulo duplo, asas, ímã, bolha, ponte, redução de velocidade e iluminação do alvo. São as principais inspirações deste plano. [Guia](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/docs/COMO-JOGAR.md), [poderes](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/scripts/powers.gd).

Limite da análise: inspeção de documentação, catálogo de poderes e código local; o jogo Godot não foi executado. Observações sobre interface não constituem um teste visual ou de usabilidade. As propostas de minijogos na seção 6 são novas ideias para este projeto.

## 3. O que já temos e onde há espaço para evoluir

Base local consultada: commit `4df5b6a`, README, DESIGN, documentos de gameplay/conteúdo/mobile e módulos citados abaixo.

| Área | Estado local verificado | Melhoria proposta |
| --- | --- | --- |
| Menu | Personagem em destaque, continuar aventura, Explorar, corrida e caderno em `main-menu.tsx` | Acrescentar navegação por mundos sem multiplicar botões na home |
| Cenário | Cinco imagens de fundo; seleção temática e parallax em `sprite-assets.ts` e `sprites.ts` | Dar identidade a cada mundo e variar terreno, decoração e som |
| Percursos | Stream reutiliza quatro templates: planície, degraus, plataformas e rio, em `speedrun-course.ts` | Mais combinações e transições, com geometria validada |
| Currículo | Alfabeto, famílias silábicas, dígrafos, encontros e palavras em `curriculum.json` | Ampliar vocabulário por temas e acrescentar pistas de segmentação |
| Explorar | Montagem de palavras por letras, jornadas curtas e descobertas | Montar por sílabas e alternar com pequenas atividades |
| Corrida | Sequência A–Z em `stream-courses.ts` | Corridas de sílabas e palavras com recordes separados |
| Apoio | Políticas assistida, padrão e desafio em `support-policy.ts` | Pistas sob demanda e maior separação entre desafio motor e leitura |
| Poderes | `POWER_1` e `POWER_2` reservados em `input/actions.ts` | Implementar primeiro duas habilidades simples de apoio |
| Entrada | Adaptadores de teclado, toque e celular | Gamepad opcional em etapa posterior |
| Progresso | Perfis, lições e caderno de descobertas | Mapa por unidade, revisão e resumo local para responsáveis |

Narração, confetes, acessibilidade, parallax, perfis e palavras ilustradas já existem: devem ser refinados, não apresentados como recursos inéditos.

**Divergência encontrada no Obsidian:** a nota `Aventura surpresa.md` marca como entregue um modo adaptativo de cinco etapas. A implementação correspondente não foi localizada no menu, cenas ou gameplay atuais. Não considerar esse modo disponível nem usar a nota como evidência de entrega; confirmar o histórico antes de reaproveitar essa ideia. O vault não foi modificado.

## 4. Layout e apresentação

### L1 — Mapa de mundos e seleção de fases — prioridade alta

Adaptar a escolha de fases da referência para uma trilha visual própria. Um acesso “Escolher aventura” abre cartões de mundos; cada mundo lista unidades e atividades, com nome, ilustração, progresso e ação de repetir. Manter “Continuar aventura” como caminho mais rápido.

- Indicar “Você está aqui”, a próxima descoberta e o que já foi aprendido.
- Permitir revisitar conteúdo sem apagar progresso; oferecer seleção livre para prática acompanhada.
- Em celular, usar cartões empilhados com uma única rolagem; em telas largas, uma trilha ilustrada com lista equivalente acessível.
- Não exigir arrastar um mapa ou reconhecer apenas cores para navegar.

**Aceite:** abrir uma família silábica ou palavra já estudada em até três escolhas a partir da home, por toque e teclado; seleção com foco visível e progresso correto por perfil.

### L2 — HUD com objetivo mais expressivo — prioridade alta

Evoluir o HUD existente com imagem pequena da palavra quando disponível, alvo legível e indicação da etapa, por exemplo “2 de 3”. Nas atividades silábicas, mostrar espaços como `BO · LA`, preenchidos após cada acerto. Repetir áudio e pedir pista devem ser ações distintas.

Preservar áreas seguras e medições dos botões DOM dos planos [17](17-plano-melhorias-layout-mobile.md) e [18](18-plano-experiencia-mobile-complementar.md). A interface discreta do original serve de inspiração, mas os alvos de toque locais não devem diminuir.

**Aceite:** objetivo, pausa, dica e pulo não se sobrepõem em paisagem baixa; texto ampliado continua legível; informação permanece compreensível sem som.

### L3 — Mundos com personalidade — prioridade média

Reaproveitar os fundos existentes e associar paleta, decoração, transição e paisagem sonora a cada mundo. Propostas iniciais:

| Mundo proposto | Conteúdo principal | Identidade e percurso |
| --- | --- | --- |
| Jardim das Letras | Alfabeto e palavras de referência | Primavera, flores, chão amplo e saltos curtos |
| Pomar das Sílabas | Famílias silábicas | Frutas, placas e pequenos degraus |
| Lago das Palavras | Palavras curtas e associação com imagens | Água rasa, margens largas e pontes fixas |
| Bosque das Descobertas | Dissílabas por tema | Outono, trilhas alternativas e coleções |
| Vale dos Desafios | Dígrafos, encontros e revisão | Entardecer, plataformas e desafios opcionais |

Os mundos são uma organização proposta, não uma divisão já existente no original. Alterações de luz devem preservar contraste das letras; redução de movimento deve desativar animações decorativas intensas.

**Aceite:** reconhecer visualmente cada mundo e repetir uma fase com identidade estável; validar desempenho em um aparelho alvo antes de ampliar efeitos.

## 5. Fases, conteúdo e ritmo

### F1 — Expandir palavras por temas — prioridade alta

Comparar as listas do original com `curriculum.json` e `word-bank.ts`; identificar palavras ausentes e selecionar um primeiro lote pequeno, de aproximadamente 20 palavras. Organizar por animais, alimentos, casa, brinquedos e família. Incorporar ilustração, pronúncia e divisão silábica revisadas.

Não importar automaticamente as 100 palavras. Verificar adequação, acentos, duplicatas, imagens e qualidade da voz. Manter identificadores antigos para preservar saves. A revisão pedagógica deve distinguir nome da letra, som, sílaba e palavra inteira.

**Aceite:** cada nova palavra tem objetivo, resposta válida, distratores, imagem ou fallback e pista coerentes; fases geradas são alcançáveis; palavras antigas mantêm progresso.

### F2 — Pista progressiva — prioridade alta

Inspirar-se na pista silábica da referência. Primeiro repetir a palavra; depois mostrar sua segmentação; por fim destacar a opção correta, quando o nível de apoio permitir. Exemplo: “BOLA” → “BO · LA” → realce de “BO”. Não exibir uma segmentação calculada por uma heurística sem revisão.

**Aceite:** dica não coleta automaticamente nem conta como erro; não há falas sobrepostas; apoio assistido continua disponível sem depender de poderes.

### F3 — Mais variedade de terreno — prioridade média

Adicionar progressivamente pontes fixas, trechos de água rasa, pequenas subidas e caminhos opcionais. Depois avaliar troncos, plataformas móveis e lava no modo desafio. Uma fase deve introduzir uma novidade de terreno por vez.

O modelo atual de perigos é genérico: lava com contato nos pés, água sem dano e plataformas móveis exigem regras específicas. Não basta trocar a imagem de um espinho. Usar a correção recente da referência como lembrete para testar salto sobre perigo, aterrissagem na borda e recuperação de itens após retorno.

**Aceite:** nenhum alvo obrigatório exige um poder; pulo curto alcança as opções previstas; não há dano por passar sobre lava sem contato; retorno oferece novamente o objetivo sem apagar descobertas consolidadas; portal mantém chegada segura.

### F4 — Duração de sessão configurável — prioridade média

Adaptar a aventura contínua do original com duas escolhas claras: sessão curta e continuar entre fases. Preservar jornadas de até três palavras no Explorar como padrão inicial. Na opção contínua, atravessar o portal inicia a próxima atividade com uma apresentação breve do objetivo, sem exigir confirmação a cada etapa.

Oferecer uma oportunidade discreta de descansar após um bloco de atividades. Salvar nas transições; pausar ou sair deve ser sempre simples. Definir retomada por atividade, sem prometer salvar cada posição do mundo.

**Aceite:** transição não duplica recompensa ou conclusão, troca o alvo e a narração corretamente e preserva progresso após recarregar; perda do controle por celular continua pausando a partida.

### F5 — Revisar a consequência de erros — prioridade média

O original renova corações ao esgotarem, sem interromper a brincadeira. Avaliar aqui uma opção acolhedora que mantém a atividade e oferece ajuda após erros repetidos. Preservar a política assistida já existente e manter regras explícitas para quem escolher desafio.

**Aceite:** erro de leitura, queda e contato com perigo têm registros distintos; retomada não apaga acertos; a regra escolhida aparece nas configurações e é coberta por testes. A adoção depende de observar crianças jogando, não apenas de reproduzir a referência.

## 6. Jogos e modalidades possíveis

Somente a expansão das corridas abaixo vem diretamente de uma modalidade confirmada no guia original. Os demais são **propostas novas**, inspiradas no mesmo conteúdo educativo. Introduzir inicialmente uma atividade de cada vez, reutilizando o vocabulário ilustrado.

| Proposta | Como brincar | Aprendizagem e exemplo | Prioridade / esforço |
| --- | --- | --- | --- |
| Monta-sílabas | Coletar sílabas na ordem para completar uma imagem | `BO` + `LA`, como evolução do Explorar | Alta / médio |
| Corrida de palavras e sílabas | Escolher conjunto curto e encontrar os alvos em sequência | Família B ou palavras de animais | Média / médio |
| Palavra e imagem | Ouvir/ver a palavra e selecionar a imagem correspondente | “GATO” entre gato, pato e bola | Média / pequeno a médio |
| Memória das descobertas | Virar pares de imagem e palavra com áudio opcional | Reutilizar palavras já vistas no caderno | Média / médio |
| Complete a palavra | Escolher a letra ou sílaba ausente em um ponto de parada | `CA _ A`, com imagem de casa e opções inequívocas | Média / médio |
| Trilha das rimas | Escolher entre palavras ilustradas que rimam com o alvo | PÃO → MÃO | Baixa / médio, com revisão pedagógica |
| Oficina de frases | Ordenar cartões para formar uma frase curta ilustrada | “O GATO PULA” | Baixa / grande |
| Jornada de revisão | Alternar três atividades curtas usando conteúdo já estudado | Reconhecer → montar → associar | Posterior / grande |

Para as corridas, separar recordes por conjunto, versão do percurso, nível de apoio e uso de poderes. Uma corrida incompleta não deve ser comparada com uma completa. Não mudar silenciosamente o contrato atual da corrida A–Z para permitir ignorar alvos.

Para atividades de cartões, oferecer seleção por toque e teclado; arrastar pode ser opcional. Implementar regras independentes da interface e renderizar esses menus/atividades em DOM quando adequado, sem levar React para o motor. O controle corporal pode continuar limitado às atividades de plataforma, com explicação clara da troca de entrada.

**Aceite comum:** instrução curta, rodada de demonstração, feedback compreensível sem som, ausência de punição por tempo no modo inicial e resultado salvo separadamente por modalidade.

## 7. Poderes e controles

Começar por **Luz das descobertas** e **Tempo de tartaruga**, inspirados no catálogo do original. A luz oferece uma pista temporária; a tartaruga reduz o deslocamento para dar tempo de decidir, especialmente com corrida automática. Não confundir redução de velocidade com alterar gravidade ou toda a simulação.

| Etapa | Habilidades | Condições para adotar |
| --- | --- | --- |
| Primeiro protótipo | Luz e tartaruga | Efeito, término e recarga claros; ajuda básica sempre gratuita e disponível |
| Segunda etapa | Pulo duplo e asas | Rever física, colisões, animação e acessibilidade sem tornar poderes obrigatórios |
| Exploração posterior | Ponte, bolha, ímã e velocidade | Validar terreno temporário e coleta; ímã não pode transformar acerto assistido em evidência de reconhecimento autônomo |

Os dois slots reservados no input podem ser reutilizados, mas a primeira interface pode expor somente um poder para limitar complexidade. Ativação por teclado e toque; no controle por celular, prever acionamento acessível ou apoio automático, sem exigir um novo gesto corporal.

Adicionar futuramente um adaptador de gamepad e remapeamento de teclas. O guia do original informa testes de controle com eventos simulados: isso não comprova compatibilidade com um controle físico específico. Validar dispositivos reais antes de anunciar suporte.

**Aceite:** pausa congela duração e recarga; término restaura os parâmetros; reinício não duplica efeito; mudar de fase segue uma política explícita; botões de poderes não ocupam o espaço do pulo; teclado/toque seguem funcionando sem ESP32.

## 8. Recompensas e acompanhamento

- **Caderno ampliado:** separar coleções por mundo/tema e permitir ouvir, rever e jogar uma atividade relacionada. Reaproveitar o caderno existente.
- **Recompensas visuais:** adesivos de descobertas e pequenos acessórios para Nicolas e Eloá, sem alterar a habilidade de aprender ou exigir sequência diária.
- **Resumo para responsáveis:** mostrar conteúdos visitados, tentativas e pistas usadas, com sugestão de revisão. Tudo local e por perfil; não apresentar porcentagens como diagnóstico de alfabetização.
- **Áudio:** organizar paisagens sonoras discretas e avaliar gravações locais das instruções mais usadas, com volume separado e funcionamento offline.

**Aceite:** recompensas não duplicam ao repetir; dados de um perfil não aparecem em outro; reset limpa os novos registros; ausência de voz instalada ou áudio não impede completar nenhuma atividade.

## 9. Ordem de implementação sugerida

Esforço relativo: pequeno = mudança localizada; médio = múltiplos módulos; grande = novo comportamento com integração e validação extensa. Não é uma estimativa em dias.

| Entrega | Escopo verificável | Dependências | Esforço |
| --- | --- | --- | --- |
| 1 — Escolher a próxima descoberta | Mapa/lista de mundos, seleção de fases e revisão do objetivo no HUD | Manter contratos dos planos 17 e 18 | Médio |
| 2 — Mais conteúdo com sentido | Lote de palavras temáticas, imagens e pistas silábicas | Revisão do conteúdo e migração compatível | Médio |
| 3 — Primeiro jogo novo | Monta-sílabas com cinco palavras piloto | Entrega 2; regras separadas da apresentação | Médio |
| 4 — Cenários variados | Ponte fixa, água rasa e identidade visual dos mundos | Validação do stream e física | Médio |
| 5 — Ritmo de sessão | Continuidade opcional e revisão da recuperação após erro | Saves/transições; plano 19 para sessões com celular | Grande |
| 6 — Apoio lúdico | Luz e tartaruga, um poder visível inicialmente | HUD e ciclo de vida bem definidos | Médio |
| 7 — Ampliar brincadeiras | Corridas temáticas, associação e memória | Métricas/recordes por modalidade | Grande |
| 8 — Expansões opcionais | Gamepad, poderes avançados, frases e revisão adaptativa | Evidência de uso e estabilidade das entregas anteriores | Grande |

**Primeiro recorte recomendado:** entregas 1 e 2, seguidas de um piloto de Monta-sílabas. Isso torna as melhorias perceptíveis no menu, no conteúdo e na brincadeira, antes de ampliar a complexidade da física e dos poderes.

## 10. Pontos técnicos e validação futura

Locais prováveis de alteração, a confirmar em cada implementação:

- `src/content/`: currículo, banco de palavras, segmentação revisada, metadados de mundo e tipos de atividade.
- `src/gameplay/`: regras das atividades, continuidade, apoio, poderes e seleção dos percursos.
- `src/render/`: HUD, cenários e efeitos, preservando contraste e redução de movimento.
- `src/ui/screens/` e `src/styles/`: mapa, seleção, cartões e configurações acessíveis.
- `src/persistence/`: evolução de saves e resultados por modalidade, preservando identificadores existentes.
- `src/input/`: ativação semântica e gamepad opcional; nenhum adaptador de ESP32.

Novos tipos de atividade, poderes e terrenos interativos exigem código e testes; não são apenas novas entradas JSON. Separar escolha pedagógica, geração de terreno e desenho para evitar concentrar toda a evolução em `GameScene`.

Verificações exigidas quando essas entregas forem implementadas:

1. Testes de conteúdo: IDs únicos, acentos, segmentação, distratores, referências a imagens e compatibilidade com saves antigos.
2. Testes de gameplay: alvo alcançável, retorno após queda, portal seguro, término de poder, pausa, transições e memória limitada do stream.
3. Testes de interface: foco, toque, texto ampliado, retrato nos menus, paisagem na partida e ausência de sobreposição no HUD.
4. Testes de progresso: repetição sem perda, isolamento por perfil, recordes comparáveis e conclusão registrada uma vez.
5. `npm test`, `npm run typecheck` e `npm run build`; testes do signaling se o ciclo de sessão do celular for alterado.
6. Ensaio real de uma sessão curta e uma contínua em desktop e celular, incluindo offline/PWA, sem áudio e com redução de movimento.

Antes de reutilizar arquivos da referência, registrar origem e versão em `THIRD_PARTY_NOTICES.md` e conferir a procedência de cada recurso. Os personagens próprios permanecem sujeitos às regras locais de arte.

Após cada entrega, atualizar gameplay, conteúdo, arquitetura e DESIGN somente conforme o comportamento efetivamente implementado. Exportação e diário no Obsidian ficam para uma tarefa que inclua autorização para alterar o vault.

## 11. Resultado desta análise

- Plano documental criado; nenhuma melhoria acima foi implementada nesta tarefa.
- Comparação feita com documentação pública, código do catálogo de poderes e arquivos locais; não houve execução do jogo original ou teste em dispositivo.
- Links locais verificados e revisão de whitespace concluída sem erros, incluindo o arquivo novo. O clone temporário confirmou a revisão de referência. Não foram executados testes de aplicação ou build, pois a alteração se limita a Markdown.

## 12. Implementação do primeiro recorte (28/09/2026)

Avaliação: o plano é coerente com o código (as referências a `main-menu.tsx`, `speedrun-course.ts`, `support-policy.ts`, `POWER_1/2` e `curriculum.json` conferem) e a ordem da §9 é sensata, porque as entregas 1 e 2 não mexem em física nem em saves. Ajustes feitos ao aplicar:

- **Ordem dos mundos:** segue a ordem do currículo (Jardim → Pomar → Vale → Lago → Bosque), não a da tabela da §4 L3, para que a trilha leia de frente para trás.
- **Entrada do mapa:** a placa “Sua próxima descoberta” virou o botão “Escolher aventura”, em vez de um botão novo, respeitando “sem multiplicar botões na home” e a grade compacta do plano 17.
- **Palavras temáticas:** entraram como cinco unidades novas (ordem 17–21), e não dentro de “Palavras de duas sílabas”, para preservar ids, ordem e o progresso de quem já jogou. As palavras foram escolhidas localmente, sem importar a lista da referência.
- **Imagens:** lições do currículo não exibem ilustração hoje; por isso o lote novo não exigiu arte. Imagens por palavra continuam restritas ao Explorar.

Entregue:

| Item do plano | O que foi feito | Onde |
| --- | --- | --- |
| L1 — Mapa de mundos | Lista de mundos, detalhe com lições por unidade, “Você está aqui”, repetir concluídas, prática livre com adulto | `content/worlds.ts`, `ui/screens/world-map.tsx`, `scenes/menu-scene.ts` |
| L2 — HUD (parcial) | Botão de dica separado do “Ouvir novamente”; faixa de dica com sinal próprio (💡), não só cor | `ui/hud-controls.tsx`, `render/hud.ts` |
| F1 — Palavras por tema | 20 palavras: animais (GALO, FOCA, TATU, PERU), alimentos (SUCO, PERA, CAJU, CAFÉ), casa (CAMA, SOFÁ, COPO, PIA), brinquedos (PIÃO, BALÃO, CORDA, BOLHA), família (TIA, TIO, NENÊ, IRMÃ); 20 fases geradas | `content/curriculum.json`, `content/levels/` |
| F2 — Dica progressiva | Repetir → sílabas revisadas → seta sobre o alvo (não no Desafio); não conta erro nem coleta | `gameplay/progressive-hint.ts`, `content/syllables.ts`, `scenes/game-scene.ts` |

Verificação: `npm test` (863 testes, incluindo mundos, cobertura da segmentação, palavras temáticas sem duplicatas, dica na cena e telas do mapa), `npm run typecheck` e `npm run build` passaram. Capturas em navegador (1000×700 e 390×800) da home, lista de mundos e detalhe do Pomar conferidas.

Pendente (continua como proposta): etapa “2 de 3” e espaços `BO · LA` no HUD das lições (dependem do Monta-sílabas), L3 (identidade visual por mundo), F3–F5, minijogos da §6, poderes da §7, recompensas da §8. Não houve teste com criança nem em aparelho real; a qualidade da voz ao falar sílabas isoladas (“bo, la”) precisa ser ouvida no iPhone/Android alvo.
