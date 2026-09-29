# 22 — Auditoria de UX mobile e plano de implementação

Data: 28/09/2026. Estado: **P0 e P1 de interface implementados e validados em navegador (Chrome headless, matriz da §10); app de controle (M20) e fluxo real de navegação auditados em 29/09/2026 (§13); pendentes: aparelho real, leitor de tela e validação integrada de HUD/orientação em aparelho (M17/M18)**. Registro da implementação na §12.

## 1. Objetivo e alcance da revisão

Reorganizar Configurações, centralizar verticalmente a home, eliminar rolagem na experiência mobile normal e uniformizar botões sem sacrificar leitura, alcance ou acessibilidade. Preservar a identidade visual, as funcionalidades, os saves e a separação entre React e motor.

Evidências: imagens fornecidas pelo usuário, leitura dos componentes React, orquestração de menus, CSS e documentação do repositório. Não houve execução em navegador, medição de caixas renderizadas nem teste em aparelho. As dimensões das imagens não comprovam a viewport CSS ou o zoom usado. Os itens abaixo distinguem defeitos observados de riscos que precisam de reprodução.

Foram consultados `README.md`, `DESIGN.md`, o índice de docs e os planos 17/18. O vault foi consultado apenas para localizar contexto adicional; nenhuma nota foi modificada. A exportação para Obsidian fica fora desta entrega documental: a tarefa não envolve atualizar o vault.

**Relação com decisões anteriores:** `DESIGN.md` e o plano 17 permitem rolagem nos menus. Este plano propõe substituir essa estratégia por páginas curtas e conteúdo progressivo no uso mobile normal. Os registros de implementação dos planos 17/18 não comprovam que o layout ficou correto em aparelhos. Atualizar a documentação funcional conforme cada mudança for implementada e validada, sem marcar propostas como comportamento existente.

## 2. Contrato de responsividade e ausência de scroll

### Resultado desejado

- Partida e prática: nenhuma rolagem da página ou dos controles.
- Home, hubs, diálogos e resultados: conteúdo e ações inteiros na área útil, sem rolagem em ambas as orientações de menu.
- Coleções e textos extensos: páginas explícitas, botões Anterior/Próxima e indicação de posição; nenhum carrossel que dependa de arrastar ou de scroll horizontal.
- Configurações: uma responsabilidade por tela; dividir páginas maiores novamente quando necessário.
- Nunca usar `overflow: hidden` como correção para conteúdo que não cabe. Não reduzir fonte, alvo de toque ou escalar toda a interface com `transform: scale()` para passar no teste.

**Limite e recomendação de acessibilidade:** “nenhum scroll” é o critério do uso normal, não uma garantia possível para toda combinação de zoom, teclado virtual e altura arbitrária. Primeiro reduzir decoração e dividir conteúdo. Se mesmo uma unidade indivisível não couber com ampliação, permitir **um único contêiner vertical acessível**, sem corte ou rolagem horizontal. Registrar cada exceção; não normalizar scroll nos menus comuns. Essa é uma recomendação explícita deste plano para conciliar os dois requisitos, não um requisito já aprovado pelo usuário.

O reflow deve preservar informações e funções em largura equivalente a 320 CSS px; a exceção para conteúdo bidimensional de jogos não abrange automaticamente seus menus. [W3C — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). Texto deve continuar utilizável quando ampliado a 200%; a preferência atual de 118% não substitui essa verificação. [W3C — Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).

### Regra de adaptação

Calcular espaço pelo contêiner disponível, altura visível e safe areas, não pelo nome do aparelho ou apenas pela orientação. Usar a infraestrutura de `dvh` existente, com fallback, e tratar teclado virtual onde houver campos. Aplicar cada inset em um único nível. A área útil é a viewport disponível menos insets, margens e regiões reservadas; não contar duas vezes o mesmo desconto.

Ordem de adaptação: reduzir espaços decorativos → colocar blocos lado a lado → compactar retrato/ilustração → mover explicação secundária para detalhe → reduzir itens por página → fallback acessível excepcional. Não esconder instruções indispensáveis ou ações de saída.

## 3. Diagnóstico das imagens com causas no código

| ID / prioridade | Problema e evidência | Causa / localização | Solução e aceite |
| --- | --- | --- | --- |
| M01 / P0 | “Repetir” e “Continuar” escapam das caixas e se sobrepõem no fim do treino. Observado. | `src/ui/hud-controls.tsx`: botões textuais usam `hud-ctrl-btn`; `main.css` fixa essa classe em 48 × 48 px, fonte pixel e `line-height: 1`. `touch-controls.css` só acrescenta padding e mínimo de altura em `.practice-coach-btn`. | Separar botão textual de botão de ícone, largura automática, fonte UI, altura mínima 48 px e altura livre. Ações lado a lado se couberem. Conferir também “Pular introdução”. Todo rótulo e foco devem caber no botão. |
| M02 / P0 | Caderno mostra BAÚ, mas ações inferiores ficam fora da área visível. Observado; a imagem isolada não prova se ainda são alcançáveis por scroll. | `discoveries.tsx` renderiza todos os cartões; `main.css` usa imagem 112 × 112, padding, vários blocos verticais e grid `auto-fit`. Um único cartão expande em largura, mas continua alto. `.overlay` usa scroll. | Paginar e usar cartão horizontal em paisagem baixa; separar detalhe do catálogo. “Ouvir”, “Jogar de novo”, Voltar e paginação sempre inteiros no uso normal. |
| M03 / P1 | Home concentrada no alto e sobra grande abaixo. Observado nas duas imagens repetidas. | `mobile.css`: `.overlay.home-screen { justify-content: flex-start }`; em retrato e paisagem ≤540 px, `.home-board` recebe `flex: none; margin: 0 auto`, removendo o centramento. `.home-main-stage` alinha filhos ao início. | Centralizar o conjunto dentro da área útil com altura intrínseca; reservar botão de tela cheia sem deslocar desnecessariamente todo o conjunto. Aceite geométrico na §5. |
| M04 / P1 | Oferta de treino tem botão Treinar muito largo e outra ação isolada abaixo apesar do espaço horizontal. Observado. | `practice-offer.tsx` usa `btn-retro`, cuja base em `main.css` impõe `width: 100%`, dentro de `.overlay-actions` flex com quebra. | Componente de ações pareadas com duas colunas iguais quando houver espaço. Largura total deve ser uma variante explícita. Manter contraste de ação principal e opção de pular clara. |
| M05 / P1 | Configurações é uma coluna muito extensa com tarefas sem relação direta. Observado. | `settings-v2.tsx` reúne áudio, apoio, acessibilidade, controles, prévia, instalação, tela cheia, pareamento, suporte e exclusão; `.settings-actions` organiza ações em coluna. | Hub e subtelas da §4. Não excluir acessibilidade para encurtar a tela. Voltar presente em cada nível e preferências preservadas. |

P0: ação encoberta/ilegível ou fluxo possivelmente bloqueado. P1: reorganização necessária para cumprir os requisitos. P2: refinamento e prevenção de regressões. Risco não reproduzido não deve ser comunicado como falha confirmada em todos os aparelhos.

## 4. Configurações com responsabilidades separadas

Manter **um acesso Configurações na home**, evitando substituí-lo por vários botões novos. Ao abrir, mostrar título, seis destinos e Voltar, sem os formulários inline. Grade 2 × 3 quando couber; lista de seis linhas no retrato com altura suficiente. Se faltar altura, dividir o hub em páginas de três destinos, com navegação explícita.

| Destino | Conteúdo atual que recebe | Divisão para telas pequenas |
| --- | --- | --- |
| Som e narração | Música, efeitos e voz | Três linhas rotuladas com valor; ajuda em detalhe se necessária. |
| Apoio para jogar | Assistido / Padrão / Desafio e efeito na próxima fase | Seleção com rótulos curtos e explicação completa abaixo; preservar a informação sobre espinhos no assistido. |
| Acessibilidade | Alto contraste, texto ampliado, movimento reduzido, cores adaptadas | Página “Texto e cores” e página “Movimento”; não depender de acordeão longo. |
| Controles | Presets de toque, restaurar controles, experimentar controles e controle por outro celular | Submenu “Ajustar toque”, “Treinar”, “Usar outro celular como controle”. Ajustar toque separa formulário e prévia em duas etapas no espaço reduzido. |
| Aplicativo | Instalar e tela cheia | Exibir estado instalado e suporte à API; não oferecer operação indisponível como se funcionasse. Manter o atalho de tela cheia na home/pausa quando já existir. |
| Ajuda e dados | Informações para suporte, acesso às informações aos responsáveis, zerar progresso | Suporte em tela própria; exclusão em área separada e confirmação já existente, com Cancelar inicialmente focado. |

“Acessibilidade” fica identificável no primeiro nível. Não criar bloqueio parental fictício ou senha nova. O texto “Controles de toque” só aparece como ajustável onde o recurso estiver disponível; preservar a detecção para aparelhos híbridos.

Remover da tela raiz os formulários, a prévia e o botão destrutivo; **realocar**, sem remover capacidades. Não duplicar controles com estados divergentes. Restauração de toque deve dizer “Restaurar controles” e nunca limpar áudio/progresso.

Preservar aplicação e armazenamento atuais: áudio, preferências de experiência e presets do aparelho continuam em seus stores; apoio vale para a próxima fase. Não introduzir Salvar se a alteração continuar imediata. Retornar da prática aberta via Configurações deve levar à origem coerente, sem iniciar uma aventura por engano.

`src/ui/menu.ts` importa **`settings-v2.tsx`**, não `settings.tsx`. Não implementar a mudança apenas no arquivo legado. Verificar referências e testes antes de propor remoção dele.

## 5. Home centralizada e compacta

Manter a hierarquia: jogador atual → próxima descoberta/Escolher aventura → Começar/Continuar → Explorar e Corrida → Caderno e Configurações. Não trocar a ação principal por um novo menu intermediário sem necessidade.

- Paisagem: jogador compacto à esquerda, ações à direita. Centralizar verticalmente ambos dentro da mesma área útil; preferir o cartão do jogador centralizado em relação ao painel de ações, sem altura artificial igualada.
- Retrato: jogador como faixa curta acima das ações; evitar um grande cartão de personagem somado a outro grande cartão de menu.
- Continuar pode ocupar a linha inteira. Os pares Explorar/Corrida e Caderno/Configurações usam duas colunas se os rótulos couberem, inclusive em retrato largo.
- Preservar Escolher aventura como botão identificável. Reduzir a placa a rótulo e objetivo, sem empilhar cabeçalhos decorativos redundantes.
- Em altura muito limitada, ocultar decoração e levar explicações secundárias ao destino. O progresso pode ficar no mapa; não ocultar o modo, jogador atual ou ações essenciais.
- Substituir a regra global `html[data-text-size="large"] .home-btn-group { grid-template-columns: 1fr }`: texto ampliado não significa automaticamente que duas colunas deixaram de caber.

Tokens iniciais: espaço de 8/16/24 px, margens externas de 16 px e opção compacta de 12 px em pouca altura, combinadas com safe areas. Não somar padding de raiz, tela e painel sem justificar. Os números são ponto de partida, a aceitação depende do conteúdo renderizado.

**Aceite:** na área útil descontada de controles fixos, diferença entre espaço acima e abaixo do conjunto principal ≤8 CSS px quando o conteúdo couber. Se não couber, ativar composição mais compacta; não manter centramento com topo negativo. Tela cheia deve manter hitbox ≥48 × 48 e não tocar cartão, foco ou nome do jogador.

## 6. Sistema compartilhado de botões e ações

Separar visual (primário, secundário, destrutivo), geometria (texto, ícone) e composição (isolado, par, grade). `btn-retro` não deve obrigar todos os botões a ocupar 100% da linha. Classes do HUD não devem ser reutilizadas como base de botões textuais.

| Propriedade | Contrato proposto |
| --- | --- |
| Alvo | Botões comuns ≥48 × 48 CSS px; ação principal pode ter mínimo 56 px. Preservar direções 56 px, pulo 68 px e presets maiores. |
| Texto | Fonte UI, referência de 1rem e line-height 1.25–1.4. Altura automática; aceitar duas linhas quando necessário, nunca reticências no nome de ação. |
| Pares | Mesma largura e altura na mesma linha; gap 8–12 px. Referência de mínimo de 9rem por coluna, ampliada conforme rótulos reais. |
| Largura isolada | Intrínseca, com padding horizontal de 16–24 px; máximo de 100% do contêiner. Botão isolado não precisa de 100% da tela. |
| Quando empilhar | Quando duas colunas não preservarem rótulos e alvos; decidir pelo espaço do contêiner, não por “todo retrato”. |
| Foco | Anel visível e espaço reservado para ele; sem recorte por overflow. Ordem DOM acompanha ordem visual. |
| Ícones | Quadrado apenas para ação iconográfica; nome acessível e tooltip não como única explicação. Emojis decorativos fora do nome acessível quando redundantes. |

Os 48 px são uma decisão de conforto deste produto infantil. WCAG 2.2, critério 2.5.8, usa 24 × 24 CSS px ou condições de espaçamento/exceções; não afirmar que WCAG exige 48 px. [W3C — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Aplicar o contrato a oferta de treino, coach, confirmação, personagem, game over, vitórias, instalação, suporte, pareamento e paginação. Não tornar todas as ações douradas; uma ação principal por contexto. A opção de pular treino precisa continuar igualmente alcançável.

## 7. Inventário complementar por tela e componente

Os itens desta tabela são achados estáticos ou riscos a validar visualmente; não correspondem todos a bugs comprovados nas imagens.

| ID / prioridade | Tela / arquivos | Problema ou risco | Implementação e aceite |
| --- | --- | --- | --- |
| M06 / P1 | Caderno: `screens/discoveries.tsx`, `word-picture.tsx` | Lista cresce com descobertas; cartão mistura catálogo e descrição completa. | Catálogo paginado com imagem, palavra e estado. Abrir detalhe para frase, Ouvir e Jogar de novo. Em paisagem, imagem ao lado do texto. Página mínima de um item completo. Estado vazio mantém Explorar. |
| M07 / P1 | Mundos e lições: `screens/world-map.tsx` | Cinco mundos empilhados; detalhe monta todas as unidades/lições e ação adulta ao final. | Fluxo mundos → unidades → lições, com páginas em cada coleção. Abrir a página da próxima lição; preservar bloqueios e treino livre. Voltar retorna ao mundo/unidade e página de origem. |
| M08 / P1 | Personagens: `screens/character-picker.tsx` | Cartões, explicação e botão principal de largura total competem pela altura. | Dois cartões compactos quando couber, ações pareadas, descrição reduzida; seleção legível e persistente. Conteúdo futuro usa paginação, não compressão ilimitada. |
| M09 / P1 | Resultados: `screens/victory.tsx`, `game-over.tsx` | Ilustração, texto e resumo de até três palavras podem produzir excesso de altura. | Paisagem com mídia e resumo lado a lado; miniaturas em linha se couberem. Caso contrário paginar palavras do resumo, com conclusão e ações estáveis. Testar primeira/última fase, recorde, rótulo longo e jornada incompleta. |
| M10 / P1 | Pausa/confirmar: `screens/pause.tsx`, `confirm.tsx` | Número variável de ações e confirmação interna podem alterar a altura. | Grade de ações, mensagem curta, sem controles sob o diálogo. Preservar Cancelar como foco inicial de exclusão; descrever alcance real do reset a partir do callback. |
| M11 / P1 | Boas-vindas: `privacy-notice.tsx` | Cards e `<details>` aberto ampliam muito o painel. | Resumo inicial e página separada “Informações aos responsáveis”, com retorno sem consentimento automático. Preservar conteúdo informativo e confirmação explícita. |
| M12 / P1 | Tela cheia e instalação: `fullscreen-offer.tsx`, `install-guide.tsx` | Guia iOS de quatro passos; regra atual empilha ações de fullscreen em todo retrato. | Pares quando couberem; guia por etapas se necessário. Não exigir instalação/tela cheia para jogar. Testar recusa, falha e API indisponível. |
| M13 / P1 | Pareamento: `phone-pairing.tsx` | QR de 220 px, status variável e ações ocupam muita altura. | QR e instruções lado a lado em paisagem; fluxo por etapas em retrato. Preservar QR legível, código alternativo e Cancelar. Testar conectando, conectado, erro e desconexão. |
| M14 / P2 | Suporte: `support-info.tsx` | Relatório `<pre>` extenso e botões em coluna. | Resumo por páginas/seções, ações em pares e cópia do relatório completo. Fallback de cópia deve disponibilizar todo o texto selecionável; exceção de scroll documentada se indispensável. Não truncar dados copiados. |
| M15 / P1 | Prévia de toque: `settings-v2.tsx`, `touch-controls.css` | Prévia vive dentro de painel estreito com overflow oculto; preset grande/distante pode sobrepor ou cortar controles. | Tela própria ampla; calcular espaço real antes de desenhar. Se não couber em retrato, explicar e oferecer teste em paisagem. Não apresentar miniatura escalada como teste de alcance real. |
| M16 / P1 | Coach ativo: `hud-controls.tsx`, `touch-controls.css` | Painel superior cresce com texto; além de M01, pode encobrir alvo/personagem em pouca altura. | Instrução curta por etapa, área reservada, botões fora de zona de movimento. Validar pular/repetir/continuar sem tocar involuntariamente o jogo. |
| M17 / P1 | HUD/toque: `hud-controls.tsx`, `hud-safe-area.ts`, `touch-controls.ts`, `render/hud.ts` | Colisão potencial entre objetivo longo, imagem, tempo e controles em paisagem baixa. | Preservar medições existentes e verificar todos os modos/presets. Sem scroll; mover ação secundária para pausa se necessário. Não reduzir alvos ou esticar Canvas. |
| M18 / P1 | Orientação: `mobile-presentation.ts`, `orientation.ts`, `index.html` | Aviso e retomada devem sobreviver à rotação e pouco espaço. | Menus nas duas orientações; manter regra atual de partida/prática em paisagem. Aviso com saída visível, input liberado ao girar, retomada sem salto involuntário. |
| M19 / P2 | Splash e atualização: `index.html`, `pwa-update.ts` | Mensagem de atualização pode cobrir ações ou roubar espaço; splash pode exceder altura curta. | Splash compacta; aviso de atualização com região reservada ou apresentação segura fora da partida. Testar aviso aberto junto de diálogo e recuperação de foco. |
| M20 / P1 | App de controle: `src/controle/main.ts`, `src/styles/controle.css`, `controle.html` | É outra superfície mobile, com conexão, permissões, calibração e diagnóstico; não recebe automaticamente o CSS dos menus React. | Auditar o fluxo separado por estados; uma tarefa por etapa, início/parada/saída acessíveis com teclado aberto. Diagnóstico fica secundário. Não alterar detector de pulo ou transporte como parte do ajuste visual. |
| M21 / P1 | Navegação: `menu.ts`, `navigation-context.ts`, `overlay-input.ts` | Contexto atual guarda foco e scroll, mas não páginas/submenus propostos. | Guardar página, item e origem em memória, por chave de tela. Após rotação, manter item visível recalculando página; não restaurar só índice antigo. |
| M22 / P2 | CSS compartilhado: `main.css`, `mobile.css`, `touch-controls.css` | Base e overrides distribuídos geram geometria diferente para controles semelhantes. | Consolidar regras por componente, remover apenas overrides substituídos e verificar estilos computados. Evitar cadeia de `!important` e correções isoladas por aparelho. |

Para M15, não confiar no comentário de `touch-controls.css` que estima o preset extremo em 324 px: com gap de 14 px, dois direcionais de 68 px, pulo de 80 px e duas bordas de 48 px, a soma já é **326 px**, antes de espaço adicional entre grupos e bordas do painel. A prévia interna em retrato pode ter menos largura que isso.

## 8. Paginação e composição técnica

Criar um padrão compartilhado de tela: cabeçalho compacto, conteúdo dimensionável e navegação em fluxo, com layout grid/flex e `min-height: 0` nos ancestrais pertinentes. Rodapé não deve ser `position: fixed` sobre conteúdo que ainda ocupa toda a altura.

Para coleções, começar com uma unidade completa por página no mobile compacto. Aumentar capacidade somente quando largura **e altura** comportarem os cartões, considerando texto ampliado. Não calcular capacidade apenas por largura ou por número fixo de itens em todos os aparelhos.

- Exibir “Página 2 de 5” ou “Palavra 2 de 12”, Anterior e Próxima; desabilitar limites sem sumir com as caixas e deslocar os botões.
- Não avançar automaticamente nem exigir swipe. Se adicionado, gesto é complementar a botões.
- Montar somente a página ativa ou remover completamente páginas ocultas da navegação/foco.
- Preservar item por ID estável quando capacidade mudar; recalcular índice de página e ajustar limites ao trocar jogador ou filtrar conteúdo.
- Ao paginar, manter foco no controle acionado quando apropriado e anunciar posição com `aria-live="polite"`; ao abrir detalhe, focar título/ação inicial e restaurar origem ao voltar.
- Desativar callback semântico de tela anterior e limpar listeners no unmount. Preservar atalhos centralizados em `src/input/`/`overlay-input.ts`, sem criar novos `keydown` nos componentes.
- Reutilizar `WordPicture` e seu fallback de imagem; paginação não pode disparar carregamento/retry sem limite.

Novos componentes possíveis: `ScreenLayout`, `ActionGroup`, `PaginationControls` e páginas de configurações. Nomes são sugestões, não dependências existentes. Não adicionar biblioteca de UI ou framework ao motor para esta tarefa.

## 9. Plano de execução para a próxima LLM

1. **Reproduzir e registrar:** iniciar app, capturar telas equivalentes às imagens, registrar viewport CSS, DPR, zoom, barras, texto ampliado e estado. Preparar progresso de teste isolado, sem apagar saves reais.
2. **Corrigir P0:** coach textual e Caderno cortado. Criar base de botões e ações que será reutilizada.
3. **Criar composição e navegação:** shell com área útil, foco/origem e estado de página. Corrigir centralização da home sem regressão desktop.
4. **Dividir Configurações:** implementar árvore da §4, reutilizando stores e callbacks; testar ida/volta de instalação, suporte, pareamento e treino.
5. **Eliminar listas longas:** Caderno, mundos/unidades/lições, resultados e guias. Não basta ocultar barras de rolagem.
6. **Auditar demais estados:** pausa, personagem, aviso inicial, orientação, HUD, atualização e app controlador.
7. **Validar e documentar:** executar checks, matriz visual, leitor de tela e aparelho. Atualizar `DESIGN.md`, docs 02/11/17/18 e textos de navegação conforme comportamento entregue. Seguir limites do AGENTS.md para qualquer escrita no vault.

Não refazer física, currículo, narração, saves ou pareamento. Se um defeito independente aparecer, registrar separadamente, sem misturar refatoração extensa com esta revisão.

## 10. Matriz de validação e critérios mensuráveis

Viewports em **CSS px**, não resolução física:

| Grupo | Tamanhos iniciais | Condições |
| --- | --- | --- |
| Retrato compacto | 320×568, 360×640, 375×667 | Home, todas as páginas, maior nome/rótulo/frase disponível. |
| Retrato comum | 390×844, 412×915 | Navegador e PWA; barras expandidas/recolhidas. |
| Paisagem baixa | 568×320, 640×360, 667×375 | Prioridade para coach, Caderno, home, ajustes e resultados. |
| Paisagem alongada | 844×390, 915×412 | Safe areas nos dois sentidos, HUD e todos os presets. |
| Tablet/desktop | 768×1024, 1024×768, 1280×720 | Aproveitar largura sem botões gigantes nem regressão de teclado. |
| Estresse acessível | Texto do app ampliado; texto a 200%; reflow em 320 px equivalentes | Sem perda de conteúdo, foco ou funções; registrar fallback vertical excepcional. |

Em Safari/iOS e Chrome/Android reais, registrar medidas efetivas: emulação de viewport não comprova teclado, safe area, permissões, multitoque ou comportamento PWA. Cobrir menus em retrato e paisagem; partida mantém a restrição atual de orientação.

### Checklist obrigatório

- [ ] No uso normal da matriz, documento, tela e componentes sem scroll vertical ou horizontal: `scrollHeight <= clientHeight + 1` e `scrollWidth <= clientWidth + 1` nos contêineres relevantes.
- [ ] Verificar também retângulos dos elementos e `elementFromPoint` em ações: `overflow: hidden` pode esconder um defeito mesmo quando não há barra. Todo alvo fica na área útil e não é coberto.
- [ ] Imagens do usuário reproduzidas e corrigidas com comparação antes/depois; telas não cobertas pelas imagens também verificadas.
- [ ] Rótulos completos dentro dos botões, sem interseção entre alvos; foco visível sem corte.
- [ ] Home satisfaz centramento da §5; pares permanecem lado a lado quando couberem.
- [ ] Caderno com 0, 1 e muitas palavras; mundo com mais unidades; última página incompleta; troca de jogador; palavra/frase mais longa e falha de imagem.
- [ ] Configurações com todos os recursos visíveis e com recursos indisponíveis, sem células vazias artificiais; alteração persiste ao sair e voltar.
- [ ] Texto ampliado, alto contraste, movimento reduzido e cores adaptadas, inclusive combinações.
- [ ] VoiceOver/TalkBack: títulos, valores de sliders, seleção, página atual e ações anunciados; sem páginas ocultas no foco. Teclado: ordem visual coerente, retorno à origem e Cancelar inicialmente focado na exclusão.
- [ ] Toque simultâneo, pausa, rotação e perda de foco não deixam input preso; nenhuma ação de menu produz movimento no jogo.
- [ ] Zoom e teclado virtual preservados nos menus; exceções de scroll registradas por tela e condição, nunca ocultadas para “aprovar” a matriz.
- [ ] Repetir/Continuar/Pular introdução e todos os resultados têm botões legíveis, sem herança de dimensão de ícone.

Testes automatizados devem cobrir comportamento: paginação sem perder itens, restauração de foco/página, persistência das preferências, consentimento e cancelamento destrutivo. Testes DOM em jsdom não comprovam geometria CSS. Usar navegador real/automação visual para dimensões, overflow e sobreposição; não considerar snapshot de classes como validação de layout.

Após implementação, executar `npm test`, `npm run typecheck` e `npm run build`, além dos testes visuais pertinentes. Nesta entrega apenas documental, esses comandos não foram executados: não validariam a interface proposta.

## 11. Entrega esperada da implementação

Relatar arquivos alterados, telas e estados cobertos, screenshots com viewport/condições, comandos e resultados, testes em aparelho e exceções restantes. Não declarar “100% responsivo”, “sem nenhum scroll em qualquer aparelho” ou conformidade WCAG integral sem evidência correspondente.

Concluído quando os P0/P1 estiverem implementados, todas as funções permanecerem alcançáveis, a matriz normal não exigir rolagem e os cenários de acessibilidade não perderem conteúdo ou ações. Refinamentos P2 não podem mascarar pendências que bloqueiem esses critérios.

## 12. Registro da implementação (28/09/2026)

### O que mudou

| Item | Implementação | Arquivos |
| --- | --- | --- |
| Base compartilhada (§6, §8, M21, M22) | `usePager` (página derivada de um item-âncora por ID estável: sobrevive a rotação, texto ampliado e troca de jogador), `PaginationControls` (Anterior · "Página N de M"/"Palavra N de M" · Próxima; limites com `aria-disabled`, sem perder o foco; posição em `aria-live`), `useArea`/`useBoxSize`/`panelBox`/`gridCapacity` (capacidade pela área real e em `rem`). O `MenuOverlay` guarda a âncora de cada paginador na trilha de navegação e a entrega ao primeiro render da tela que volta. `.overlay-actions` virou a composição única de ações (mesma largura/altura por linha, quebra por coluna de 9rem, botão isolado intrínseco); `.btn-retro` não força mais 100%; `.btn-block` e `.btn-danger` novos; `:where(.overlay) button` com 48 px, `line-height` 1.3 e quebra de linha. Overrides substituídos removidos de `main.css`/`mobile.css`. | `ui/screens/layout.tsx`, `ui/navigation-context.ts`, `ui/menu.ts`, `styles/main.css`, `styles/mobile.css` |
| M01/M16 coach | Botões de texto com classe própria (`.practice-coach-btn`): fonte UI, altura livre ≥ 48 px, pares de largura igual; nada herda de `.hud-ctrl-btn`. | `ui/hud-controls.tsx`, `styles/touch-controls.css` |
| M02/M06 Caderno | Catálogo paginado de cartões horizontais (imagem, palavra, estado), um botão por palavra; tela própria da palavra (`showDiscoveryDetail`) com frase, Ouvir, Jogar de novo e Voltar ao caderno, que volta à mesma página e cartão. | `ui/screens/discoveries.tsx`, `scenes/menu-scene.ts` |
| M03 home | Bloco com altura intrínseca centralizado por `margin-block: auto` (nunca topo negativo); faixa do botão de tela cheia (48 × 48) descontada da área útil em retrato; pares Explorar/Corrida e Caderno/Configurações em grade `auto-fit` de 7rem; progresso no cartão do jogador; dica de teclado só com ponteiro fino e altura ≥ 640 px; regra global de texto ampliado removida. | `ui/screens/main-menu.tsx`, `styles/main.css`, `styles/mobile.css` |
| M04 oferta de treino | Par de ações de largura igual via `.overlay-actions`. | `ui/screens/practice-offer.tsx` |
| M05/M15 Configurações | Hub com seis destinos (grade 2 × 3/3 × 2, lista em retrato, páginas de três quando falta altura); telas próprias para Som e narração, Apoio para jogar (escolha em rádio + explicação completa), Acessibilidade (Texto e cores / Movimento, lado a lado ou em páginas), Controles (Ajustar toque, Treinar controles, Usar outro celular), Ajustar toque (formulário e prévia em etapas; prévia só é desenhada quando cabe no tamanho real — senão explica e sugere girar), Aplicativo (instalação com estado, tela cheia só se a API existir) e Ajuda e dados (suporte, informações aos responsáveis, zerar progresso em área separada). Cada tela tem chave própria na trilha (`settings:<seção>`); alterações seguem imediatas. Voltar da prática, da instalação, do suporte, do pareamento e do cancelamento de reset leva à seção de origem. | `ui/screens/settings-v2.tsx`, `ui/menu.ts`, `scenes/menu-scene.ts` |
| M07 mundos | Mundos → partes → lições, cada nível paginado e aberto na página da próxima lição; mundo de uma parte (alfabeto) vai direto às lições; treino livre ao lado do Voltar das lições; chips com largura pelo alvo mais longo. | `ui/screens/world-map.tsx`, `scenes/menu-scene.ts` |
| M08 personagens | Cartões compactos lado a lado com paginação para futuros personagens; ações em par; subtítulo curto. | `ui/screens/character-picker.tsx` |
| M09 resultados | `ResultLayout`: mídia ao lado do texto em paisagem baixa; resumo da jornada paginável e com chips compactos em altura curta; estrelas com texto para leitor de tela. | `ui/screens/victory.tsx`, `game-over.tsx` |
| M10 pausa/confirmação | Ações em grade de células iguais; mensagem do reset descreve exatamente o que `resetProgress` apaga (e que nome e configurações ficam). Cancelar continua com foco inicial. | `ui/screens/pause.tsx`, `confirm.tsx`, `scenes/menu-scene.ts` |
| M11 boas-vindas | Resumo curto e página "Informações aos responsáveis" (também em Ajuda e dados); voltar dela reapresenta o aviso sem registrar consentimento. Removida a afirmação "100% seguro". | `ui/screens/privacy-notice.tsx`, `scenes/menu-scene.ts` |
| M12 tela cheia/instalação | Pares por `.overlay-actions` (sem empilhar em todo retrato); passos do iOS paginados quando falta altura; ilustração decorativa some em altura curta; texto "Não é preciso instalar para jogar". | `ui/screens/fullscreen-offer.tsx`, `install-guide.tsx` |
| M13 pareamento | QR (160–220 px) ao lado das instruções em paisagem, acima em retrato; "Corrida do alfabeto" no lugar de "Speed Run". | `ui/screens/phone-pairing.tsx` |
| M14 suporte | Relatório por páginas de linhas (contando quebras), ações na mesma linha do paginador; "Copiar resumo" copia tudo; se a cópia falhar, o relatório completo aparece selecionado numa caixa rolável — exceção registrada abaixo. | `ui/screens/support-info.tsx` |
| M19 splash/atualização | Splash compacta em altura ≤ 420 px; aviso de atualização com largura máxima, quebra de linha, fonte UI e botão de 48 px. | `styles/main.css` |

### Validação

- `npm test` (921 testes, 94 arquivos), `npm run typecheck` e `npm run build`: passam. Testes novos cobrem paginação sem perder itens, âncora ao mudar capacidade, restauração de página/foco pela trilha, árvore de Configurações e seus retornos, consentimento não registrado ao ler as informações aos responsáveis e reset restrito ao toque.
- `npm run audit:ux -- --url http://localhost:5173` (`tools/ux-audit.mjs`, novo; requer `npm run dev`; `--large-text`, `--text-scale 2`, `--only`, `--viewports`): Chrome headless, 13 viewports da §10 × 34 telas/estados (o registro original dizia 35; a lista em `tools/ux-audit-page.js` tem 34 — correção de 29/09/2026), verifica `scrollHeight/scrollWidth`, alvos fora da tela, `elementFromPoint`, rótulo dentro do botão, sobreposição, alvo < 48 px e centramento da home (≤ 8 px). Resultado com texto normal: **0 problemas**. Antes das mudanças, a mesma ferramenta mediu, por exemplo, Configurações com ~1 200 px de rolagem em 360 × 640, Caderno com ~6 700 px, home 123 px fora do centro em 412 × 915 e rótulos do coach vazando das caixas (M01).
- `--text-scale 2` (texto a 200%) em 1280 × 720, 768 × 1024, 390 × 844 e 844 × 390: sem rolagem horizontal, sem corte e sem sobreposição; rolagem vertical de fallback onde necessária.

### Exceções e pendências registradas

- **Texto ampliado do app em 568 × 320 e 320 × 568**: home, Configurações (Aplicativo, Ajuda e dados, Ajustar toque, Acessibilidade, Controles), aviso inicial, informações aos responsáveis, resultados e suporte usam o contêiner vertical de fallback (18–127 px). As demais viewports da matriz passam com texto ampliado.
- **Suporte após falha de cópia**: caixa com o relatório completo rola dentro de si (dados copiáveis não são truncados).
- **Coach em janela de desktop em retrato com texto a 200%**: o painel excede a área 16:9 do jogo. Em aparelhos de toque a partida só roda em paisagem.
- **Não feito nesta entrega**: M20 (app de controle `controle.html`) não foi auditado nem alterado — **feito em 29/09/2026, §13**; M17/M18 mantidos como estavam (nenhuma medição do HUD foi alterada); `settings.tsx` legado continua no repositório (não é importado pelo `menu.ts`).
- **Lista de exceções de texto ampliado incompleta**: a revisão do doc 23 encontrou casos em 568 × 320 fora desta lista. O registro completo, com alcance conferido após rolagem, está na §13.
- **Não validado**: aparelhos reais (Safari/iOS, Chrome/Android, PWA, teclado virtual, safe areas físicas), VoiceOver/TalkBack e toque simultâneo. A emulação não substitui esses testes; não declarar conformidade WCAG integral.

## 13. Auditoria ampliada e registro de exceções (29/09/2026)

Aplicação do doc 23 §5, item 2.

### Ferramenta

`npm run audit:ux` (`tools/ux-audit.mjs`) agora audita três alvos por viewport (`--target menus,controle,flow`, padrão os três):

- **menus** — as 34 telas/estados montados pelos construtores com dados de exemplo, como antes;
- **controle** — 17 estados da página `/controle` (M20) desenhados pela própria view (`src/controle/view.ts`, via `tools/ux-audit-controle-page.js`), sem socket nem sensor;
- **flow** — o jogo real com perfil limpo, acionado pelos botões visíveis (`tools/ux-audit-flow-page.js`): primeiro acesso, home, mundos (ida e volta), as seis telas de Configurações com retorno, Controles → pareamento → volta, Caderno, uma partida real com HUD, pausa e confirmação de saída, e volta ao menu. Em retrato de toque, a partida para no aviso de orientação e a saída medida é o "Voltar ao menu" do aviso (M18). Botão não encontrado é falha (`flow-error`).

Mudanças de medição: elementos `inert` (HUD sob modal, jogo sob o aviso de orientação) e conteúdo de `<details>` fechado não contam; o aviso de orientação é medido quando ativo. Um alvo fora da tela é rolado até a vista: se fica inteiro e clicável é **nota** `offscreen-reachable` (fallback alcançável), senão é falha `offscreen`. Com `--text-scale 2`, apenas `scroll-y` e centramento viram notas — antes todo `offscreen` era descartado, o que escondia conteúdo perdido. Contêiner marcado com `data-scroll-exception` (relatório completo após falha de cópia, no suporte e no controle) gera nota `scroll-exception`, nunca aprovação silenciosa. O Canvas continua fora da medição: HUD desenhado no Canvas não é verificado por esta ferramenta.

### Resultados (Chrome headless, Vite local)

| Execução | Casos | Problemas | Notas |
| --- | ---: | ---: | --- |
| Matriz normal, 13 viewports × (34 menus + 17 controle + 30 passos de fluxo; 28 em retrato de toque) | 1041 | **0** | 13 `scroll-exception` (relatório do controle após falha de cópia) |
| Texto ampliado do app, 320 × 568 e 568 × 320 | 160 | 44 `scroll-y` (fallback vertical, lista abaixo) | 27 `offscreen-reachable`; **0 alvos inalcançáveis** |
| Texto a 200% (`--text-scale 2`), 1280 × 720, 768 × 1024, 390 × 844, 844 × 390 | 320 | 2 (`covered` no coach em 390 × 844) | 159 (fallback vertical/alcançável) |

Os dois casos do texto a 200% são a exceção já registrada na §12 (coach em janela retrato; em toque a partida só roda em paisagem). A medição antiga os escondia.

### Registro de fallback vertical com texto ampliado do app

Todos com alcance conferido: cada controle fora da vista inicial volta inteiro e clicável com rolagem do contêiner `.screen-body`/`.overlay`. Decisão: **aceitos como fallback** nesta etapa; os de até 14 px ficam como candidatos a ajuste de composição (backlog), sem reduzir alvos.

| Viewport | Tela (px de rolagem) |
| --- | --- |
| 320 × 568 | home (121; no fluxo real 108), Ajustar toque (35), suporte (24), jornada concluída (20) |
| 568 × 320 | aviso inicial (18), informações aos responsáveis (126), home (9), Acessibilidade (14), Controles (11), Ajustar toque (96), Aplicativo (75), Ajuda e dados (119), suporte (37), vitória do Explorar (48), jornada concluída (52), Caderno com muitas palavras (30), mundos (21), partes do mundo (2), lições (3) |
| Controle (texto a 125%) | 568 × 320: calibração falhou (12), pronto (10); 320 × 568: relatório após falha de cópia (76) |

A página do controle foi ajustada em vez de só registrada: centramento por `margin: auto` (com `align-items: center` o topo ficava cortado e inalcançável quando o conteúdo passava da altura), diagnóstico como tela própria com "Voltar" (uma tarefa por etapa), alvos de 48 px e composição compacta em altura ≤ 420 px.

### M20 — app de controle

Estados auditados: início, pedindo permissão, permissão negada, link inválido, calibrando, calibração falhou, conectando à sala, esperando o jogo, conexão perdida, sensor sem resposta, pronto, sessão encerrada, diagnóstico, diagnóstico com relatório, modo bolsinha (ok e com alerta) e confirmação de saída. Uma ação principal por estado; diagnóstico secundário. Sem teclado virtual nesta página (não há campo de texto). Não validado em aparelho, com leitor de tela nem com a página real conectada.

### Atualização da revalidação (docs/23 §8)

- **HUD medido.** O HUD informativo passou para DOM (docs/17 §13) e a ferramenta mede seus blocos: dentro da tela, sem sobreposição, sem palavra partida entre linhas. Quatro estados de partida com textos longos (letra, letra com erro, Explorar com dica e ilustração, corrida com cronômetro) entram no alvo `menus`; em toque + retrato são pulados (a partida mostra o aviso de orientação, medido no fluxo). O Canvas só desenha o mundo e a seta de apoio assistido.
- **Contraste medido** em todos os estados (docs/17 §13), com `--high-contrast` para a matriz com alto contraste. Animações de entrada são concluídas antes de medir.
- **Controles:** "Botões de toque na tela" (Automático / Sempre mostrar) aparece em aparelhos de ponteiro fino; em toque a tela de Controles não muda.

| Execução (ferramenta final) | Casos | Problemas | Notas |
| --- | ---: | ---: | --- |
| Matriz normal, 13 viewports | 1069 | **0** | 102 `contrast-inactive` (Anterior/Próxima desativados), 13 `scroll-exception` |
| Alto contraste, 13 viewports | 1069 | **0** | idem |
| Texto ampliado, 320 × 568 e 568 × 320 | 164 | 42 `scroll-y`, todos do registro acima | 0 alvos inalcançáveis, 0 contraste |
| Texto a 200%, 4 viewports | 328 | 2 `covered` do coach em 390 × 844 (exceção da §12) | fallback vertical/alcançável |

Exceção nova registrada: texto do navegador a 200% num celular deitado de 320 px de altura (568 × 320, fora da matriz de 200%) — o HUD ocupa a tela inteira; não há como caber texto de 32 px nessa altura. A partida continua pausável.

### Ainda pendente

Aparelhos reais (Safari/iOS, Chrome/Android, PWA, safe areas físicas, zoom do iPhone), VoiceOver/TalkBack, multitoque e rotação física (M17/M18 em aparelho).
