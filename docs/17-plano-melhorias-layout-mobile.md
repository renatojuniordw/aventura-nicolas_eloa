# 17 — Revisão e plano de melhorias do layout mobile

Data: 28/09/2026. Status: **entregas 1–4 e 6 implementadas no código; entrega 5
parcial (HUD continua em Canvas); aceite no iPhone 17 pendente** — ver §12.

## 1. Escopo e evidências

Revisão estática do código, do `DESIGN.md`, da documentação de mobile/input e das
quatro capturas enviadas pelo usuário. Nenhum navegador foi aberto, nenhuma
emulação foi executada e o problema de zoom não foi reproduzido nesta revisão.
Os testes em aparelhos descritos abaixo são tarefas futuras.

As capturas mostram a partida, o menu em uma viewport indicada como iPhone SE
667 × 375, um detalhe dos corações sobre os botões e a Corrida do alfabeto.
O usuário também relata zoom no iPhone 17 ao manter o movimento para frente e
tocar repetidamente em pular. A versão do iOS e o modo de abertura dessa sessão
(Safari, outro navegador ou PWA instalado) ainda precisam ser registrados.

Os tamanhos das imagens anexadas não devem ser usados como medidas exatas de CSS:
as capturas podem ter sido redimensionadas. Os controles de movimento/pulo não
aparecem nelas; isso não prova que estejam ausentes no aparelho real.

Objetivo: melhorar a legibilidade, o alcance dos controles, o aproveitamento da
tela e a estabilidade dos gestos, preservando a arte e as regras do jogo.

## 2. Diagnóstico priorizado

| Prioridade | Ponto | Evidência e impacto |
| --- | --- | --- |
| P0 | Zoom involuntário durante movimento + pulo | Relato do iPhone 17; interrompe a partida. Causa exata ainda não confirmada. |
| P0 | Corações sobrepostos aos botões | Visível nas capturas e explicado pela reserva fixa do HUD em Canvas versus controles DOM em pixels CSS. |
| P1 | Menu cortado em paisagem baixa | Rodapé parcialmente visível na captura; conflito de especificidade impede a rolagem pretendida da home. |
| P1 | Grade com lacunas | Corrida ocupa meia linha, Explorar força outra linha inteira e Caderno deixa outra meia linha vazia. Aumenta a altura sem oferecer conteúdo. |
| P1 | Deformação do mundo | Código força Canvas 960 × 540 a preencher proporções diferentes de 16:9 em paisagem. |
| P1 | HUD pequeno em telas compactas | Fontes desenhadas no Canvas encolhem com o mundo; textos longos são reduzidos ainda mais. |
| P1 | Áreas seguras inconsistentes | Botões DOM usam `env(safe-area-inset-*)`; textos e corações em Canvas não compartilham essas medidas. |
| P1 | Multitoque sem rastreamento por dedo | Adaptador não mantém `pointerId` ativo por ação; precisa de testes de concorrência e perda de captura. Não é prova da causa do zoom. |
| P2 | Hierarquia visual dos botões anulada | Regra `.overlay button` vence variantes de cor; a captura mostra ações com aparência semelhante. |
| P2 | Troca de personagem duplicada | Retrato clicável e botão grande executam a mesma ação; painel ocupa bastante espaço em altura baixa. |
| P2 | Texto ampliado incompleto no DOM | Há várias fontes fixas em `px` que não acompanham o aumento do tamanho base de `html`. |
| P2 | Telas secundárias e estados especiais | Precisam de validação consistente de rolagem, foco, texto ampliado e áreas seguras; não há capturas dessas telas. |

P0 deve ser tratado primeiro. P1 corrige acesso, leitura e geometria. P2 consolida
a experiência visual e a manutenção do CSS.

## 3. Zoom no iPhone 17: investigação e correção dentro do jogo

### 3.1. Proteções que já existem

- `index.html` contém `width=device-width, initial-scale=1.0, viewport-fit=cover`.
- `src/styles/touch-controls.css` aplica `touch-action: none`,
  `-webkit-touch-callout: none` e bloqueio de seleção aos `.touch-btn`.
- `src/input/touch-adapter.ts` chama `preventDefault()` nos eventos de pressionar
  e soltar e tenta capturar o ponteiro.
- `src/styles/mobile.css` usa `touch-action: manipulation` nos botões de overlays.
- Perda de foco e aba oculta já zeram o input em `src/core/lifecycle.ts`.

Portanto, simplesmente adicionar `touch-action: none` ao botão de pulo repete uma
regra existente. É necessário verificar se a sessão afetada recebeu esse CSS e
em qual elemento cada dedo começa o gesto.

### 3.2. Hipóteses a distinguir

1. Um toque começa fora do botão, no Canvas ou no espaço entre controles, onde não
   há a mesma política de gestos. Dois dedos ou toques rápidos podem estar
   envolvidos; não assumir que todo zoom observado é exclusivamente duplo toque.
2. A sessão usa uma versão anterior dos assets, especialmente no PWA. Comparar a
   versão servida com a ativa antes de concluir que o código atual falhou.
3. O efeito percebido é redimensionamento pela barra do navegador ou mudança de
   viewport, e não zoom da página. Registrar `visualViewport.scale`, dimensões e
   deslocamento antes/depois ajuda a distinguir os casos.
4. Alguma camada sobre o controle recebe os eventos, ou o dedo escapa da área
   durante a animação `:active`. A escala visual de 0,95 merece ser verificada.

Estas são hipóteses de investigação, não diagnósticos confirmados do Safari.

### 3.3. Ajuste proposto

**Primeira etapa: completar a política de gestos somente na superfície jogável.**

- Manter `touch-action: none` nos controles e cobrir também o Canvas e os
  agrupamentos de controles durante gameplay ativo.
- Usar um estado explícito de interação, por exemplo `data-input-mode="playing"`,
  que seja atualizado ao iniciar, pausar, retomar, girar e sair da partida.
  Esse estado ainda não existe. `data-scene="game"` sozinho não basta, porque a
  pausa continua na mesma cena.
- Não aplicar `touch-action: none` indiscriminadamente a `html`, `body`, `#app`
  ou à `.game-viewport`, que também contém menus e overlays. Um descendente não
  consegue recuperar gestos que um ancestral já proibiu.
- A raiz de toque tem `pointer-events: none`: nos espaços vazios o alvo pode ser
  o Canvas. Por isso, proteger apenas `.touch-controls-root` não resolve todos
  os possíveis pontos de início de gesto.
- Para botões do HUD, avaliar `touch-action: manipulation`; eles são ações de
  clique, não controles de movimento contínuo.
- Preservar rolagem e ampliação de leitura nos menus e configurações.

Exemplo de direção para a implementação, sujeito ao teste no aparelho:

```css
/* Estado novo: somente enquanto a partida aceita movimento. */
body[data-input-mode="playing"] #game-canvas,
body[data-input-mode="playing"] .touch-controls-root,
body[data-input-mode="playing"] .touch-controls-dpad,
body[data-input-mode="playing"] .touch-btn {
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.hud-ctrl-btn {
  touch-action: manipulation;
}
```

Aplicar o estado antes do início do gesto; mudar CSS depois de o dedo encostar
não é uma estratégia confiável de cancelamento daquele gesto.

**Segunda etapa: robustecer o adaptador de toque.**

- Capturar usando `event.currentTarget`, o botão que possui o listener, em vez
  de depender do alvo interno (`event.target`).
- Rastrear `pointerId → ação` e os ponteiros ativos por ação. Emitir pressionado
  no primeiro dedo e solto somente quando o último dedo daquela ação sair.
- Manter movimento enquanto outro dedo pressiona e solta pulo repetidamente.
  Não filtrar todos os ponteiros não primários: o segundo dedo é necessário.
- Tratar `pointercancel`, `lostpointercapture`, encerramento, pausa e reset sem
  deixar ações presas nem aceitar uma liberação antiga sobre um novo toque.
- Definir explicitamente a política de arrastar para fora. Com pointer capture,
  `pointerleave` sozinho não garante liberação imediata ao cruzar o limite
  visual. Se essa for a UX desejada, conferir coordenadas durante o movimento.
- Não adicionar debounce que elimine pulos válidos. A regra de pulo continua em
  `player-controller.ts`; o adaptador só traduz entrada em ações.
- Preservar os elementos estáveis de `TouchControls`, pois o adaptador é ligado
  a eles uma vez. Não recriar botões sem atualizar os bindings.

**Terceira etapa: fallback somente se o problema continuar reproduzível.**

Se CSS, alvo e versão estiverem corretos e o iPhone ainda ampliar, avaliar um
listener nativo local de Touch Events com `{ passive: false }` para cancelar o
gesto comprovadamente problemático, apenas na superfície de jogo e enquanto ela
estiver ativa. Verificar `event.cancelable` antes de cancelar, remover listeners
ao desativar e manter Pointer Events como única fonte de ações do jogo, evitando
disparo duplicado. Um fallback desse tipo exige teste real; não é a primeira
correção nem deve bloquear toques em todo o documento.

Não usar como solução principal `user-scalable=no`, `maximum-scale=1`, bloqueio
global de `touchmove`/`gesturestart`, zoom CSS ou resets contínuos de escala.
Essas abordagens podem prejudicar leitura, menus e gestos sem resolver a causa.
Instalar como PWA ou entrar em tela cheia também não é critério de correção.

### 3.4. Reprodução e aceite

No iPhone 17 afetado, registrar versão do iOS, modo de abertura, versão do app,
orientação e estado das barras do navegador. Em diagnóstico temporário e local,
registrar alvos, `pointerId`, tipo/cancelamento de evento, CSS computado e, quando
disponível, `visualViewport.scale` e suas dimensões. Não criar telemetria remota.

- [ ] Segurar direita por 30 segundos e tocar pular pelo menos 30 vezes, em
  sequências lentas e rápidas; repetir com esquerda.
- [ ] Repetir mantendo pulo e alternando movimento; testar dois dedos no mesmo
  botão e soltar somente um deles.
- [ ] Testar bordas, espaços entre botões, arrasto para fora e toque no Canvas.
- [ ] Pausar, girar, trocar de app e voltar com um dedo anteriormente pressionado.
- [ ] Não ocorrer ampliação ou deslocamento involuntário durante os controles;
  comparar a escala inicial e final, sem exigir escala 1 se o usuário já ampliou.
- [ ] Movimento não interromper ao soltar pulo; nenhuma ação permanecer presa.
- [ ] Menus continuarem roláveis, botões funcionarem uma vez por toque e teclado
  continuar funcionando.
- [ ] Validar no Safari e no PWA instalado. Testes em jsdom não comprovam que o
  motor de gestos do iPhone deixou de ampliar a página.

Arquivos: `src/styles/touch-controls.css`, `src/styles/mobile.css`,
`src/input/touch-adapter.ts`, `src/ui/touch-controls.ts`,
`src/ui/mobile-presentation.ts`, `src/main.ts` e integração de pausa/input.

## 4. HUD: separar informação e botões sem sobreposição

### Causa no código

`src/render/hud.ts::_drawHearts()` reserva `rightMargin = 140` unidades do Canvas.
O comentário menciona dois controles, mas `src/ui/hud-controls.tsx` pode mostrar
três: ouvir, tela cheia e pausa. Em `mobile.css`, cada um tem pelo menos 48 px;
três botões e dois intervalos de 8 px ocupam 160 px CSS, antes da margem lateral.
Além disso, o Canvas escala e os botões não seguem a mesma escala.

Em uma largura exibida de 667 px, a reserva de 140 unidades equivale a cerca de
97 px CSS (`140 × 667 / 960`). Aumentar a constante para outro número fixo apenas
desloca o problema para outra viewport.

### Plano

1. Correção imediata: medir a área realmente ocupada pelos controles DOM,
   incluindo margem segura e separação, e converter para coordenadas do Canvas.
   Usar `getBoundingClientRect()` e atualizar no resize/mudança dos controles,
   sem medir a cada frame. Para coordenadas: `xCanvas = (xCSS - canvasLeft) ×
   canvas.width / canvasRect.width`; usar conversão vertical equivalente.
2. Reservar espaços também para objetivo, nome da fase, cronômetro e quadro de
   letras. Se não couber em uma linha, usar segunda linha; não apenas empurrar
   corações para cima do objetivo.
3. Evolução recomendada: colocar o HUD informativo em layout DOM responsivo,
   consumindo um snapshot do `HudModel`. Agrupar objetivo, vidas, progresso e
   ações em grid; manter o mundo e seus indicadores espaciais no Canvas.
4. Preservar a fronteira de arquitetura: motor não importa React; uma ponte
   fornece dados à UI. Atualizar cronômetro com cadência suficiente, sem
   re-renderizar toda a interface em cada frame nem anunciá-lo a leitores de
   tela continuamente. Remover o desenho duplicado ao migrar cada item.
5. Manter pausa e ouvir acessíveis. Em altura/largura muito reduzidas, mover tela
   cheia para a pausa, com instrução de saída acessível; sua ausência não pode
   deixar uma coluna vazia. O ícone de ouvir pode ser mais explícito que ♫.

Critérios: três corações distinguíveis; separação mínima proposta de 8 px CSS
entre grupos; nenhum cruzamento de retângulos; botões de pelo menos 48 × 48 px;
objetivo legível sem depender de fonte minúscula. Testar com 0–3 vidas, dois/três
botões, texto ampliado, nomes longos e todos os modos.

## 5. Menu principal: caber e permitir rolagem

### Corrigir a cascata antes de mudar espaçamentos

- `.overlay.home-screen` em `main.css` tem especificidade maior que
  `.home-screen` em `mobile.css`. Seu `overflow: hidden` vence a intenção de
  `overflow-y: auto`; o mesmo cuidado vale para padding e alinhamento.
- `.overlay button` vence `.btn-primary-gold`, `.btn-explore` e
  `.hero-change-btn` em várias propriedades. Isso explica a perda do destaque
  dourado e a fonte pixel no botão de troca, apesar das variantes declaradas.
- Consolidar base e variantes, usando seletores de baixa especificidade na
  base, por exemplo `:where(.overlay) button`, ou camadas CSS bem definidas.
  Revisar também `:hover`, `:active` e foco. Evitar resolver com vários
  `!important` e novas regras duplicadas no fim do arquivo.
- Escolher um único dono da rolagem por tela. O wrapper criado por
  `mount-screen.ts`, a home absoluta e `.overlay-root > div` precisam de uma
  cadeia de alturas coerente. Preservar o wrapper do React e seus eventos.

### Composição proposta

Em paisagem baixa, reduzir o painel do personagem e usar o espaço para ações.
Manter uma única ação visível de troca (retrato com rótulo ou botão), sem perder
nome, indicação do personagem selecionado e área de toque.

Grade sugerida, preservando a ordem visual também no DOM/foco:

```text
Personagem compacto | Próxima descoberta
                    | Começar / Continuar aventura (largura inteira)
                    | Explorar             | Corrida do alfabeto
                    | Caderno              | Configurações
                    | Progresso
```

O botão Explorar pode dispensar o subtítulo em altura muito baixa, mantendo sua
explicação em local acessível. Se os textos não couberem em duas colunas com boa
leitura, passar para uma coluna com rolagem. Não usar `grid-auto-flow: dense` para
reordenar visualmente ações sem corrigir a sequência de navegação.

Em retrato, manter personagem compacto acima das ações, uma coluna e rolagem
vertical. Revisar a margem superior fixa de 50 px e a reserva de 52 px à direita
da `.home-board`: espaço para tela cheia deve existir só quando necessário.

Critérios:

- [ ] Em 667 × 375, início e ações principais visíveis; todas as demais
  alcançáveis por uma rolagem vertical, sem corte definitivo no rodapé.
- [ ] Sem lacunas de meia linha por posicionamento implícito da grade.
- [ ] Sem rolagem horizontal em retrato estreito ou texto ampliado.
- [ ] Começar/Continuar tem destaque visual consistente; ações secundárias
  mantêm boa leitura sem competir com a principal.
- [ ] Configurações e progresso não disputam a mesma linha quando falta largura.
- [ ] Fonte simples nos textos funcionais; fonte pixel reservada a títulos curtos.

Arquivos: `src/ui/screens/main-menu.tsx`, `src/styles/main.css`,
`src/styles/mobile.css` e, se necessário, estilos do wrapper de montagem.

## 6. Viewport, proporção e áreas seguras

O mundo usa 960 × 540. A media query de paisagem em `main.css` força a viewport a
`100dvw × 100dvh`, enquanto o Canvas tem largura e altura de 100%. Assim, a imagem
pode sofrer escalas horizontal e vertical diferentes. `image-rendering: pixelated`
não corrige essa deformação.

Plano inicial: separar o shell que ocupa a tela do retângulo do mundo. Preservar
16:9 com escala uniforme e centralizar o Canvas. Aceitar faixas quando necessário;
usar nelas fundo discreto e, onde houver espaço adequado, controles. Menus devem
continuar usando a tela inteira, independentemente da proporção do mundo.

Não ampliar/cortar o mundo com `cover` se isso esconder chão, plataforma ou alvo.
Um mundo com largura lógica adaptável é alternativa futura, mas exige revisão
de câmera, geração de trechos, HUD e testes; não é um simples ajuste de CSS.

- Definir uma área útil compartilhada para HUD e controles com os quatro insets.
  Evitar contar a mesma safe area no shell, overlay e painel interno.
- Considerar o indicador inferior, recorte da câmera e os dois sentidos de
  paisagem. Não codificar offsets específicos para o nome “iPhone 17”.
- Manter `dvh` com fallback existente; testar barras expandidas/recolhidas e
  teclado virtual onde houver entrada. Não redimensionar o mundo a partir da
  escala de pinch como tentativa de combater zoom.
- Preservar pausa e liberação de input ao girar para retrato. Ao voltar, exigir
  retomada clara e evitar um pulo causado pelo toque no botão de continuar.

Critérios: círculos continuam circulares; personagem e letras não se achatam;
nenhuma parte essencial fica cortada; HUD e controles ficam dentro da área útil
em navegador e PWA, com e sem suporte à API de tela cheia.

## 7. Ergonomia, leitura e acessibilidade

### Controles de jogo

- Consolidar os tamanhos: `touch-controls.css` reduz botões sob 480 px de altura,
  mas `mobile.css`, carregado depois, redefine 56 px e 68 px. Documentar um único
  comportamento por breakpoint, em vez de depender dessa disputa.
- Adotar 56 px para direções e 68 px para pulo como ponto de partida, conforme
  `DESIGN.md`, com pelo menos 8–12 px de separação. Medir em CSS, não em pixels
  físicos da tela; não diminuir alvos para compensar falta de espaço.
- Validar alcance com dois polegares, afastamento do gesto de início do sistema e
  visão do chão/obstáculos. Se preciso, reposicionar os controles em uma faixa
  inferior própria, avaliando o tamanho restante do mundo.
- Preferir feedback de cor/borda a encolher a área tocável. Se houver animação,
  aplicá-la ao conteúdo interno mantendo o hitbox estável.
- Conferir detecção de toque (`pointer: coarse`) e mudanças de dispositivo.
  Considerar opção manual para mostrar controles em híbridos; não concluir pela
  ausência nas capturas que o detector falha no iPhone.

### Tipografia e informação

- Em 667 px de largura, 16 unidades de fonte do Canvas equivalem a cerca de
  11 px CSS; isso justifica desacoplar leitura e escala do mundo.
- Propor 16 px CSS como referência de texto funcional e 18–22 px para objetivo,
  permitindo quebra de linha ou reorganização. Evitar `_fit()` como única saída
  para textos longos e para o modo de texto ampliado.
- Trocar fontes fixas relevantes em `px` por `rem` ou tokens de escala de texto,
  incluindo botões, configurações e legenda de jornada.
- Testar objetivo, quadro de letras, feedback de acerto/erro e ilustração do
  Explorar juntos. A figura em `top: 16%` e largura percentual também precisa
  respeitar as zonas do HUD e não encobrir itens ou a trajetória de pulo.
- Preservar rótulos acessíveis dos botões; não depender de `title` em toque.
  Manter foco visível e combinações de ícone, texto e cor nos estados.
- Conferir contraste sobre fundos reais, inclusive estados inativos; usar como
  metas 4,5:1 para texto comum e 3:1 para componentes e texto grande, sem alegar
  que esses contrastes já foram medidos nesta revisão.

## 8. Telas e estados que também entram na revisão

| Tela/estado | Trabalho necessário | Critério de aceite |
| --- | --- | --- |
| Pausa e confirmações | Priorizar Continuar, organizar botões e preservar rolagem em baixa altura | Todas as ações alcançáveis; input do jogo bloqueado enquanto modal ativo |
| Configurações | Evitar cortes em selects, sliders e opções longas; dar área confortável às linhas de toggle | Alterar opções e voltar em retrato/paisagem e com texto ampliado |
| Personagens | Grade responsiva, nomes legíveis, seleção evidente e confirmação acessível | Escolher ambos os personagens sem corte ou rolagem horizontal |
| Caderno | Grade de uma coluna quando necessário e navegação de retorno acessível em listas longas | Ouvir/jogar cada cartão; estado vazio funciona; retorno não fica inacessível |
| Vitória, derrota e resumo de jornada | Quebrar cartões/botões por espaço disponível | Próxima ação e saída alcançáveis mesmo com três palavras e texto ampliado |
| Privacidade, instalação e convite de tela cheia | Textos roláveis, aceite/recusa alcançáveis e alternativa quando API falhar | Nenhuma dessas telas bloqueia o acesso por falta de altura |
| Pareamento por celular | QR code, código e ações legíveis, com saída clara | Não cortar código/QR; permitir voltar sem depender do pareamento |
| Atualização do PWA | Conferir área segura e conflito com rodapé | Banner acionável no menu e ausente durante partida conforme fluxo existente |
| Carregamento e aviso de rotação | Conteúdo centralizado na área útil; botão voltar acessível | Sem cortes em altura baixa; redução de movimento respeitada |

Esses itens são cobertura de revisão por código e tarefas de validação, não
defeitos visuais confirmados por captura. Arquivos correspondentes em
`src/ui/screens/`, `src/ui/pwa-update.ts`, `src/ui/mobile-presentation.ts` e CSS.

## 9. Sequência de implementação

| Entrega | Escopo | Dependência | Esforço relativo |
| --- | --- | --- | --- |
| 1 — Gestos e multitoque | Diagnóstico no iPhone, política local de gestos, estado de interação e adaptador robusto | Acesso ao aparelho para confirmar aceite | Médio |
| 2 — HUD sem colisões | Medidas compartilhadas, reserva dinâmica e reorganização compacta | Medidas reais do shell/Canvas | Médio |
| 3 — Menu utilizável | Cascata, dono da rolagem, grade, personagem compacto e variantes de botão | Pode começar após o diagnóstico estático | Pequeno a médio |
| 4 — Geometria e áreas seguras | Shell separado do mundo, proporção uniforme e controles posicionados | Revalidar entrega 2 após mudança de geometria | Médio |
| 5 — HUD responsivo e leitura | Migração gradual para DOM, escala de texto e Explorar | Entregas 2 e 4 | Médio a grande |
| 6 — Consistência e regressão | Telas secundárias, acessibilidade, matriz de aparelhos e documentação | Entregas anteriores | Médio |

O esforço é relativo, não estimativa em dias. Separar correções de input e de
layout em mudanças revisáveis. Não alterar física, dificuldade, conteúdo ou
persistência como efeito colateral da revisão mobile.

## 10. Validação planejada

### Matriz visual e funcional

| Ambiente | Cobertura |
| --- | --- |
| 667 × 375 e 375 × 667 CSS px | Referência da captura do SE, menu, pausa, rolagem e jogo em paisagem |
| 568 × 320 e 320 × 568 CSS px | Estresse de largura/altura baixa, sem presumir um aparelho específico |
| iPhone 17 real do relato | Multitoque/zoom, barras do Safari, ambos os sentidos de paisagem, safe areas e PWA |
| Android com toque real | Controle simultâneo, cancelamento, rolagem e regressão fora do iOS |
| Tablet em retrato/paisagem | Layout intermediário, alcance e excesso de espaçamento |
| Desktop com teclado/mouse | Navegação, foco, Canvas e ausência de controles indevidos |

Em cada ambiente aplicável, cobrir Aventura, Corrida e Explorar; início, erro,
portal, pausa e retorno ao menu. Repetir casos críticos com texto ampliado,
alto contraste e redução de movimento. Usar viewport CSS efetiva, não resolução
física anunciada do aparelho. Não exigir fullscreen para passar nos testes.

### Testes automatizados úteis para a implementação

- `src/input/touch-adapter.test.js`: dois dedos em ações diferentes, dois na
  mesma ação, cancelamento, perda de captura, reset e ciclos attach/detach.
- `src/ui/mobile-presentation.test.js` e `src/app-lifecycle.test.js`: rotação,
  pausa/retomada, bloqueio de input e liberação de ponteiros.
- `src/render/hud.test.js` e testes da nova política de layout: áreas reservadas
  com escalas diferentes, longos textos e variação de controles. Se migrar o HUD,
  manter testes de dados e adicionar cobertura de UI acessível.
- Testes existentes de telas: ações e navegação preservadas após reorganização.
- Manter `src/architecture.test.js` garantindo a separação entre UI e motor.

Ao implementar, executar `npm test`, `npm run typecheck` e `npm run build`.
jsdom não faz layout visual real nem valida gestos nativos: aprovação visual e
correção do zoom dependem da matriz manual. Automação de navegador, se adotada
futuramente, deve respeitar a autorização do usuário; não foi usada nesta tarefa.

### Definição de concluído

- [ ] Zoom involuntário não se reproduz no iPhone 17 no roteiro da seção 3.
- [ ] Corações, objetivo, ilustração, progresso e botões nunca se sobrepõem.
- [ ] Todos os menus permitem chegar a todas as ações, sem cortes definitivos.
- [ ] Mundo preserva proporção e controles mantêm tamanho confortável.
- [ ] Toque, teclado, pausa, rotação e retorno do segundo plano não deixam input preso.
- [ ] Texto ampliado e áreas seguras funcionam em todas as telas avaliadas.
- [ ] Testes, tipos e build passam; evidências de aparelho ficam registradas.
- [ ] Atualizar `docs/11-mobile-pwa-e-deploy.md`, `docs/03-abstracao-de-input.md`
  e `DESIGN.md` conforme o comportamento efetivamente entregue.

## 11. Limites desta entrega documental

Este plano registra achados verificáveis no código e separa hipóteses que exigem
aparelho. A consulta às notas de contexto do projeto no Obsidian não trouxe
diagnóstico adicional de mobile/zoom. Nenhuma nota foi alterada e a exportação
para o vault não foi executada, respeitando o limite do `AGENTS.md` para mudanças
fora do repositório sem uma tarefa que envolva o vault.

Na entrega documental original foram criados apenas o plano e sua entrada no índice.
A implementação posterior está registrada na §12.

## 12. Registro da implementação (28/09/2026)

O comportamento oficial resultante está em `docs/11` §1–1.2, `docs/03` §8 e `DESIGN.md`.

| Entrega | Implementado | Arquivos principais |
| --- | --- | --- |
| 1 — Gestos e multitoque | Estado `body[data-input-mode]` (`playing`/`ui`) via `Events.INPUT_MODE_CHANGED`; `touch-action: none` apenas em Canvas, raiz, D-pad e botões durante a partida; HUD com `manipulation`; `TouchAdapter` rastreia `pointerId → ação`, captura no `currentTarget`, trata `lostpointercapture`, solta tudo em `detach()` e em `InputManager.reset()` (`releaseHeld`); arrastar para fora mantém o botão enquanto houver capture; sem `:active` com escala | `touch-adapter.ts`, `input-adapter.ts`, `composite-adapter.ts`, `input-manager.ts`, `game-scene.ts`, `mobile-presentation.ts`, `touch-controls.css` |
| 2 — HUD sem colisões | Área útil medida (`hud-safe-area.ts`) e convertida para unidades do Canvas; corações à esquerda dos botões; segunda linha para corações e depois nome/selo; quadro de letras desce quando não cabe; safe areas em textos e seta assistida; 3 botões de 48 px | `render/hud.ts`, `ui/hud-safe-area.ts`, `main.ts`, `main.css` |
| 3 — Menu utilizável | `.overlay.home-screen` como único dono da rolagem (fundo com tinta em camada, sem `::before`); `:where(.overlay) button` devolve a hierarquia às variantes; DOM reordenado (Começar, Explorar, Corrida, Caderno, Configurações, progresso) e grade 2 colunas em paisagem baixa com `display: contents` na linha de meta; uma única ação de troca (retrato com rótulo; botão só sem retrato); reserva para tela cheia só com `.has-fullscreen`; subtítulo do Explorar visível só para leitor de tela em altura ≤ 400 px | `main-menu.tsx`, `main.css`, `mobile.css` |
| 4 — Geometria e áreas seguras | Shell em tela inteira com Canvas 16:9 uniforme e centralizado; controles e botões usam o shell e as safe areas; ilustração do Explorar abaixo das linhas do HUD | `main.css`, `mobile.css` |
| 5 — HUD responsivo e leitura | **Parcial:** fatores de legibilidade no Canvas (objetivo ≈ 18 px CSS em 667 px) e fontes do DOM em `rem`. A migração do HUD informativo para DOM **não** foi feita | `render/hud.ts`, `mobile.css`, `main.css` |
| 6 — Consistência | Tela cheia no menu de pausa (e fora do HUD em telas ≤ 340 px de altura ou ≤ 560 px de largura); ícone 🔊 para ouvir; wrapper de montagem só restringe altura; `select` das configurações sem rolagem horizontal; `device.isTouch` relido a cada partida | `pause.tsx`, `hud-controls.tsx`, `mobile.css`, `main.ts` |

Testes novos: multitoque, dedos na mesma ação, `lostpointercapture`, captura no botão,
`releaseHeld` e ciclos attach/detach (`touch-adapter.test.js`); `reset → releaseHeld`
(`input-manager.test.js`); evento de modo de input na cena (`game-scene.test.js`) e no
`body` (`mobile-presentation.test.js`); matriz 568/667/960 px × 2/3 botões × 0/1/3 vidas
× texto normal/ampliado sem cruzamento de retângulos, legibilidade e safe areas
(`hud.test.js`); conversão de medidas (`hud-safe-area.test.js`). `npm test` (789),
`npm run typecheck` e `npm run build` passam.

Verificação visual: com consentimento do pedido de aplicar o plano, foram feitas capturas
locais em Chrome headless com emulação de toque (667 × 375, 375 × 667, 568 × 320 e
874 × 402) do menu, das configurações com texto ampliado, da partida, do Explorar e da
pausa. Isso **não** substitui o aparelho.

Pendente:

- Roteiro de §3.4 no iPhone 17 real (Safari e PWA) e em Android; registrar versão do
  iOS, modo de abertura e se o zoom deixou de ocorrer. Só então avaliar o fallback de
  Touch Events da terceira etapa, que não foi implementado.
- Migração do HUD informativo para DOM (entrega 5, item 3 de §4).
- Opção manual para mostrar os controles de toque em híbridos.
- Revisão de contraste medida (4,5:1 / 3:1) e matriz completa de §10 em tablet.

