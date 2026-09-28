# 18 — Plano complementar de experiência mobile

Data: 28/09/2026. Status: **implementado em código e testes automatizados (§13); validação em aparelho pendente**.

## 1. Objetivo e relação com o plano anterior

O [plano 17](17-plano-melhorias-layout-mobile.md) cobre zoom involuntário, colisões
do HUD, rolagem, proporção do Canvas, áreas seguras e legibilidade. Este documento
complementa aquele trabalho com melhorias de conforto, aprendizado dos controles,
navegação, carregamento e custo de renderização.

A análise foi feita por leitura do código, sem abrir navegador, executar emulação
ou testar no iPhone. As propostas de produto abaixo não são falhas comprovadas por
teste com crianças. Os achados de implementação estão identificados separadamente.
Existem alterações de implementação no workspace: conferir seu estado antes de
iniciar cada tarefa e não reaplicar automaticamente o diagnóstico do plano 17.

Recomendação: concluir as correções críticas do plano 17 antes de adicionar opções
novas. Personalização não deve compensar um layout padrão que ainda esteja quebrado.

## 2. Prioridades

| ID | Melhoria | Motivo | Prioridade |
| --- | --- | --- | --- |
| M1 | Parar animações decorativas invisíveis | Evitar trabalho contínuo sem benefício visual | Alta |
| M2 | Unificar redução de movimento | Fazer a preferência do jogo alcançar animações em Canvas | Alta |
| M3 | Preservar contexto ao voltar de uma tela | Evitar perder posição, foco e cartão selecionado | Alta |
| M4 | Recuperação visual de imagens indisponíveis | Manter instruções compreensíveis quando um recurso falhar | Alta |
| M5 | Controles ajustáveis por alcance | Atender mãos, pegadas e aparelhos diferentes | Média |
| M6 | Introdução prática aos controles | Explicar movimento, pulo e escuta sem depender de leitura longa | Média |
| M7 | Feedback visual do toque sustentado | Mostrar com clareza qual comando está sendo mantido | Média |
| M8 | Diagnóstico local da sessão | Facilitar investigar problemas específicos de aparelhos e versões | Média |

Alta significa próxima etapa complementar; não substitui a prioridade máxima do
zoom e das sobreposições descritos no plano 17. Não há estimativas em dias sem
implementar e medir no aparelho.

## 3. M1 — Suspender animações que não estão visíveis

### Evidência

`src/ui/screens/celebration-canvas.ts` agenda `requestAnimationFrame()`
continuamente. `main-menu.tsx` monta esse componente quando o personagem tem o
sprite de celebração. `mobile.css` esconde `.hero-animation-stage` em retrato e
paisagem baixa, mas esconder por CSS não desmonta o componente nem chama `stop()`.

O helper também continua desenhando o frame estático quando a preferência de
movimento reduzido do sistema está ativa. Isso confirma trabalho desnecessário;
não permite afirmar quanto de bateria ou aquecimento ele causa sem medição.

### Trabalho

1. Dar ao componente um estado explícito de atividade. Não montar a animação
   quando sua apresentação estiver oculta, ou suspendê-la quando ficar invisível.
2. Suspender ao ocultar a página e retomar somente se a animação ainda fizer parte
   da tela visível. Usar uma estratégia de visibilidade consistente com os
   breakpoints; não duplicar condições divergentes entre CSS e JavaScript.
3. Desenhar apenas uma imagem estática quando animações estiverem desativadas.
   Se a imagem ainda estiver carregando, desenhá-la ao concluir a carga.
4. Limpar listeners, observadores e callbacks na desmontagem. Garantir que uma
   retomada não crie dois ciclos simultâneos.
5. Medir outros custos antes de otimizar: `backdrop-filter` dos painéis e render
   contínuo da cena de menu são candidatos, não gargalos já demonstrados.

**Aceite:** nenhum callback decorativo recorrente enquanto o elemento estiver
oculto; uma única animação após retomar; aparência preservada quando visível.
Comparar contagem de desenhos e tempo de renderização na mesma sessão/aparelho.
Não mudar o passo da física para economizar renderização.

**Arquivos:** `src/ui/screens/celebration-canvas.ts`,
`src/ui/screens/main-menu.tsx`, testes do helper e estilos relacionados.

## 4. M2 — Uma política consistente de redução de movimento

### Evidência

`ExperienceSettingsStore.apply()` grava `data-motion` no documento. O CSS usa
essa preferência para reduzir animações CSS. O helper da celebração consulta
diretamente `prefers-reduced-motion`, mas não recebe a opção selecionada dentro do
jogo. Portanto, ativar “Reduzir movimentos e flashes” no jogo não controla esse
helper pelo mesmo caminho.

### Trabalho

- Definir a regra efetiva: reduzir movimento se o sistema solicitar **ou** se o
  usuário ativar a opção no jogo. Explicar essa combinação nas configurações.
- Centralizar essa resolução e fornecer o resultado à UI e aos efeitos, mantendo
  o motor independente de React e de consultas dispersas ao DOM.
- Responder à mudança da configuração e da preferência do sistema sem recarregar.
- Revisar celebração, splash e transições decorativas. Preservar animações que
  comunicam movimento necessário à partida, eliminando tremores/flashes e
  deslocamentos puramente decorativos conforme a política existente.
- Fornecer imagem estática e texto de sucesso quando a celebração for reduzida.

**Aceite:** testar as quatro combinações entre preferência do sistema e do jogo;
o resultado deve ser consistente em CSS e Canvas. A mudança não altera colisões,
velocidade, duração do pulo nem o tempo da Corrida.

**Arquivos:** `src/persistence/experience-settings-store.ts`,
`src/ui/screens/settings-v2.tsx`, `src/ui/screens/celebration-canvas.ts`,
`src/styles/mobile.css` e consumidores de redução de movimento.

## 5. M3 — Voltar para onde a pessoa estava

### Evidência

`MenuOverlay._mount()` desmonta a tela anterior e escolhe o foco pela classe
`.btn-primary-gold` ou pelo primeiro controle. Não há nessa classe um contrato
de restauração da posição de rolagem ou do elemento que abriu a tela seguinte.
`hide()` devolve foco ao Canvas, o que já é adequado ao retorno à partida.

### Trabalho

1. Registrar contexto de navegação por tela: identificador estável do controle de
   origem, item selecionado e rolagem do contêiner correto.
2. Ao retornar do Caderno, Configurações ou seleção de personagem, restaurar esse
   contexto se ainda existir. Caso contrário, focar o título ou a ação principal.
3. Permitir que cada tela declare seu foco inicial semanticamente, sem depender
   do nome de uma classe de cor. Em confirmação destrutiva, preferir Cancelar.
4. Dar semântica de diálogo apenas às telas modais, com nome acessível e foco
   contido no modal. A home continua sendo uma tela, não um diálogo.
5. Preservar o bloqueio `inert` já aplicado aos controles de gameplay. Conferir
   também outros elementos externos que possam receber foco, como atualização
   do PWA, sem esconder avisos essenciais.
6. Guardar contexto transitório em memória, separado do progresso pedagógico.
   Não persistir coordenadas de rolagem de uma orientação para outra sem ajuste.

**Aceite:** abrir um cartão no meio do Caderno e voltar sem perder a posição;
abrir Configurações pela home rolada e retornar à ação de origem; foco nunca
permanecer em nó removido. Conferir teclado e leitor de tela no aparelho.
Isso melhora navegação acessível, mas não equivale a tornar toda a partida em
Canvas plenamente operável sem visão.

**Arquivos:** `src/ui/menu.ts`, `src/ui/screens/mount-screen.ts`, telas de menu,
testes de navegação e overlays.

## 6. M4 — Imagens ausentes e carregamento compreensível

### Evidência

O boot já permite fallback para formas provisórias e registra falha de preload.
`AssetManager` remove solicitações pendentes ao terminar, permitindo nova
tentativa futura. Entretanto, `WordPicture` renderiza uma imagem sem tratamento
próprio de erro; a experiência visual desse caso não está definida no componente.

### Trabalho

- Criar fallback local para a ilustração da palavra: manter o espaço reservado,
  mostrar o nome legível e preservar a ação de ouvir. Evitar ícone de imagem
  quebrada como única resposta e não depender de outra imagem remota para falhar.
- Diferenciar “carregando”, “indisponível” e “pronto” onde isso ajuda a pessoa.
  Não bloquear a partida por uma ilustração decorativa nem exibir erro técnico
  sobre a área de jogo.
- Permitir nova tentativa limitada quando fizer sentido, sem ciclos infinitos de
  `onError` e sem recriar requisições a cada render.
- Auditar a splash: se a barra for apenas decorativa, usar indicação de atividade
  em vez de apresentá-la como porcentagem real de download. Só mostrar progresso
  numérico se ele corresponder a recursos efetivamente acompanhados.
- No Caderno extenso, avaliar carregamento adiado de imagens fora da tela,
  preservando dimensões e priorizando as primeiras imagens visíveis. Medir o
  ganho antes de adicionar virtualização de lista.
- Não afirmar que o app está pronto para uso offline apenas porque há conexão ou
  um service worker registrado; vincular qualquer novo indicador a uma condição
  verificável de preparação do conteúdo necessário.

**Aceite:** simular erro e lentidão de imagens; título, ações e altura dos cartões
permanecem estáveis. Primeira visita sem rede apresenta orientação compreensível;
uma sessão já preparada continua usando seus recursos locais. Testar essas
condições futuramente, sem apagar dados reais do jogador para reproduzi-las.

**Arquivos:** `src/ui/screens/word-picture.tsx`, `src/ui/screens/discoveries.tsx`,
`src/core/asset-manager.ts`, `src/scenes/boot-scene.ts`, splash em `index.html`,
`src/main.ts` e estilos correspondentes.

## 7. M5 — Ajustar os controles ao alcance das mãos

### Oportunidade de produto

Os botões atuais têm posições e tamanhos definidos em CSS. Após estabilizar o
layout padrão do plano 17, oferecer poucos ajustes pode acomodar diferentes
pegadas sem obrigar todas as pessoas a usar o mesmo posicionamento.

### Trabalho

- Criar seção “Controles de toque” em Configurações, com prévia interativa segura.
- Oferecer inicialmente três ajustes: tamanho padrão/maior, pulo à direita/à
  esquerda e afastamento das bordas em poucos níveis. Ao trocar o lado, manter
  a ordem lógica esquerda/direita dos direcionais.
- Restringir posições à área segura e impedir sobreposição entre botões ou com
  ações essenciais. O menor tamanho mantém os mínimos definidos no plano 17.
- Aplicar alterações sem recriar elementos ligados ao `TouchAdapter` e sem
  deslocar controles durante um gesto ativo. A prévia não movimenta o personagem.
- Salvar por dispositivo, pois tamanho de tela e pegada não fazem parte do
  progresso da criança. Validar valores e fornecer “Restaurar padrão”.
- Começar com presets. Arrastar livremente botões exige regras adicionais de
  colisão e recuperação e fica fora desta primeira entrega.

**Aceite:** testar presets com mãos pequenas e grandes, em ambos os sentidos de
paisagem. Rotação não produz botões fora da tela; restaurar padrão é imediato;
configurações antigas continuam legíveis pelo armazenamento.

**Arquivos:** `src/ui/screens/settings-v2.tsx`, `src/ui/touch-controls.ts`,
`src/styles/touch-controls.css` e armazenamento de preferências do dispositivo.

## 8. M6 — Aprender os controles jogando

### Oportunidade de produto

A ajuda do rodapé do menu indica toques para escolher/brincar e é escondida em
telas baixas. Isso não ensina a combinação de segurar direção e tocar pulo nem
que segurar pulo altera sua altura. Uma introdução opcional pode reduzir tentativas
frustradas sem adicionar mais instruções permanentes ao HUD.

### Trabalho

1. Oferecer “Experimentar controles” no primeiro uso com toque e nas Configurações.
2. Usar uma área curta e segura, sem perda de corações ou contagem da Corrida.
3. Mostrar uma etapa por vez: segurar direção, tocar pulo e combinar os dois.
   Apresentar pulo sustentado como dica posterior, não exigência inicial.
4. Usar animação discreta do gesto, texto curto e narração opcional. Respeitar
   movimento reduzido e permitir pular a introdução em qualquer etapa.
5. Avançar por ações semânticas recebidas, não por um cronômetro que pressiona a
   criança. Não alterar o `TouchAdapter` para conter lógica de tutorial.
6. Guardar conclusão separadamente de lições e estrelas; permitir repetir.

**Aceite:** entrar, pular e repetir a introdução sem alterar progresso, recordes
ou nível de apoio; gestos reais acionam as etapas; nenhuma dica cobre o botão que
precisa ser pressionado. Validar se a criança entende antes de tornar o fluxo
mais proeminente no primeiro uso.

**Arquivos:** nova tela/fluxo de prática em `src/ui/` e `src/scenes/`, ações em
`src/input/actions.ts` consumidas pelo fluxo, preferências e narração existentes.
É a maior mudança de produto deste plano; implementar por último se o restante
da experiência ainda exigir correções.

## 9. M7 — Mostrar o comando que está sendo mantido

### Trabalho

- Derivar o estado visual de pressionado do mesmo conjunto de ponteiros ativos
  usado pelo input, após a correção de multitoque do plano 17.
- Usar borda/preenchimento e leve alteração interna do ícone sem mudar o hitbox.
  `:active` isolado não deve ser a única indicação de um comando sustentado.
- Ao cancelar, pausar ou perder captura, limpar estado visual e ação juntos.
- Diferenciar “dedo no botão de pulo” de “pulo realizado”: uma animação do botão
  não pode prometer que o personagem pulou se a regra de gameplay não permitiu.
- Manter retorno visual e sonoro independentemente de vibração. O projeto já
  oferece fallback silencioso quando a API de vibração não está disponível;
  não prometer vibração universal no iPhone.
- Não usar `aria-pressed` de alternância para representar incorretamente um
  botão momentâneo; manter nome de ação acessível e sem anúncios a cada frame.

**Aceite:** segurar direção e tocar pulo mostra estados independentes; soltar um
dedo não apaga o estado do outro; nenhum botão fica visualmente preso após pausa.

**Arquivos:** `src/ui/touch-controls.ts`, `src/input/touch-adapter.ts`, camada de
ligação em `src/main.ts` e estilos. Manter apresentação e regras de jogo separadas.

## 10. M8 — Diagnóstico local para problemas específicos

### Trabalho

Criar opção secundária “Informações para suporte”, fora do HUD infantil, contendo:

- Versão/build do app e identificação da versão ativa dos recursos quando viável.
- Modo navegador/PWA, dimensões CSS da viewport, orientação e escala visual quando
  a API estiver disponível.
- Detecção de toque, estado de interação e presets ativos.
- Resumo local de tempos de frame somente quando diagnóstico for ativado.

Permitir copiar um resumo textual por ação explícita. Não coletar nomes de
crianças, progresso, áudio ou histórico de gestos por padrão; não enviar dados
automaticamente a um servidor. Informações de implementação ficam restritas a
essa tela de suporte, sem ocupar a experiência normal de jogo.

**Aceite:** o resumo permite comparar versão e viewport de duas sessões; não
contém dados pessoais; desativar diagnóstico encerra seus observadores. Falha da
API de cópia oferece texto selecionável, inclusive com o bloqueio global de
seleção existente no CSS.

**Arquivos:** nova tela em `src/ui/screens/`, Configurações, integração de build
em `vite.config.js` se necessária e APIs já usadas pela apresentação mobile.

## 11. Ordem de entrega e validação

| Etapa | Itens | Dependência |
| --- | --- | --- |
| A | M1 + M2 | Pode avançar sem esperar personalização dos controles |
| B | M3 + M4 | Coordenar com as mudanças de rolagem do plano 17 |
| C | M7 + M8 | Usar o estado de input e o diagnóstico estabilizados no plano 17 |
| D | M5 | Layout padrão e áreas seguras já aprovados |
| E | M6 | Controles estáveis e validação da necessidade da introdução |

Para cada etapa de implementação, executar testes pertinentes, `npm test`,
`npm run typecheck` e `npm run build`. Cobrir especialmente:

- Animação visível/oculta, desmontagem, retomada e preferência de movimento.
- Navegação de ida/volta, restauração de foco e conteúdo que mudou entre telas.
- Falha de imagem, nova tentativa e fallback sem mudança brusca de layout.
- Persistência de presets, valores inválidos e compatibilidade com saves antigos.
- Tutorial sem efeitos sobre progresso e input visual sincronizado ao input real.

Usar a matriz de aparelhos do plano 17 na validação futura, acrescentando:

- Sessão contínua de 10 minutos para comparar fluidez e custo de renderização;
  registrar condições iguais, sem apresentar aquecimento percebido como medição
  precisa de bateria.
- Navegação pelo Caderno longo, retorno à posição anterior e imagens indisponíveis.
- Voz desligada, leitor de tela ativo e redução de movimento pelo sistema/jogo.
- Presets de controles e prática com pessoas que ainda não conhecem o jogo.

Não executar automação de navegador durante esta tarefa documental. Atualizar
`DESIGN.md` e a documentação funcional somente conforme as decisões forem
implementadas e verificadas. Exportação/edição do Obsidian não faz parte desta
entrega.

## 12. Critério de conclusão

Marcado quando coberto por código e teste automatizado; a última linha continua
aberta até a validação na matriz de aparelhos.

- [x] Animações ocultas e estáticas não mantêm ciclos decorativos desnecessários.
- [x] Redução de movimento funciona de forma consistente entre sistema, CSS e Canvas.
- [x] Retornar de telas preserva contexto e foco de maneira previsível.
- [x] Falhas de imagens mantêm conteúdo e ações utilizáveis.
- [x] Personalização respeita área segura e pode ser revertida facilmente.
- [x] Introdução é opcional, repetível e não interfere na progressão.
- [x] Feedback de toque reflete o estado real dos controles.
- [x] Diagnóstico é local, opcional e suficiente para comparar sessões.
- [ ] Verificações automatizadas passam e os casos relevantes são validados em aparelho.
      (`npm test`, `npm run typecheck` e `npm run build` passam; aparelho pendente.)

## 13. Registro de implementação (28/09/2026)

Sem automação de navegador nem teste em aparelho nesta etapa; nenhuma medição de
bateria, aquecimento ou tempo de renderização foi feita.

**M1 — `src/ui/screens/celebration-canvas.ts`.** O helper mantém no máximo um ciclo
`requestAnimationFrame` e só enquanto a página está visível (`visibilitychange`), o
canvas está de fato na tela (`IntersectionObserver`, então o `display: none` dos
breakpoints em `mobile.css` é a única fonte de verdade) e o movimento não está
reduzido. Com movimento reduzido desenha um único quadro estático, inclusive quando a
imagem termina de carregar depois. `stop()` cancela o quadro e remove listener e
observador; o componente em `main-menu.tsx` também remove o canvas. `backdrop-filter` e
a cena de menu não foram alterados (continuam candidatos a medir).

**M2 — `src/ui/motion-policy.ts`.** `createMotionPolicy()` resolve "sistema **ou**
jogo" e notifica mudanças das duas fontes sem recarregar; `ExperienceSettingsStore`
ganhou `subscribe()`. `main.ts` usa a mesma política para sprites, efeitos, cena e a
celebração (`game.motion`). O CSS segue a mesma regra pelos dois seletores existentes
(media query e `html[data-motion="reduced"]`). Configurações explica a combinação e
avisa quando o aparelho já pede menos movimento. A splash não finge mais porcentagem:
virou indicador de atividade, estático com movimento reduzido. Física, pulo e tempos
da Corrida não mudaram.

**M3 — `src/ui/menu.ts` + `src/ui/navigation-context.ts`.** Cada tela tem uma chave;
ao sair, o `MenuOverlay` guarda em memória o último controle usado (foco ou toque, pois
o iOS não foca botões ao tocar) e a rolagem de cada contêiner. Voltar para uma tela que
está no caminho (Configurações → Início, Guia → Configurações, uma tela que se
re-renderiza, como um toggle de Configurações ou a escolha de personagem) restaura os
dois; abrir uma tela de novo pelo caminho normal começa do topo. `hide()` esquece o
caminho. O foco inicial é declarado com `data-autofocus` (sem depender de
`.btn-primary-gold`); ids estáveis com `data-nav-id` onde o texto do botão muda. Telas
modais recebem `role="dialog"`, `aria-modal` e nome pelo título; o foco que escapa é
devolvido ao modal via `focusin` (a regra de arquitetura mantém `keydown` só em
`src/input/`), mas o aviso de atualização do PWA continua alcançável. Confirmações
destrutivas começam em Cancelar: a da pausa e a nova confirmação de "Zerar progresso"
(`screens/confirm.tsx`), que antes apagava sem perguntar. Não há tela de detalhe de
cartão no Caderno; o aceite equivalente é voltar ao Caderno (por outra tela) no mesmo
cartão e posição.

**M4 — `src/ui/screens/word-picture.tsx`.** Estados `loading`/`ready`/`unavailable`
no mesmo espaço reservado; indisponível mostra a palavra (sem ícone quebrado) e as
ações do cartão continuam. Nova tentativa só quando o navegador sinaliza `online`, no
máximo uma, sem nova requisição por render. No Caderno, as 4 primeiras imagens carregam
já e as demais usam `loading="lazy"` com dimensões preservadas; virtualização não foi
necessária sem medição. Primeira visita sem rede não foi alterada: sem service worker a
página nem carrega, e com ele o boot já cai nas formas provisórias.

**M5 — presets.** Ver `docs/11` §1: `TouchLayoutStore`, `TouchControls.applyLayout()`,
variáveis CSS em `touch-controls.css` e a seção "Controles de toque" com prévia.

**M6 — prática.** Ver `docs/11` §1: cena `practice`, `ControlsPractice` e
`ControlsPracticeStore`. Continua a recomendação: validar com crianças antes de
deixar a oferta mais proeminente.

**M7 — feedback sustentado.** `TouchAdapter` ganhou `onHeldChange`; `TouchControls`
aplica `.is-held` (ver `docs/03` §8).

**M8 — Informações para suporte.** Configurações → "Informações para suporte"
(`screens/support-info.tsx`, `src/ui/support-info.ts`): versão, commit e data do build
(injetados por `define` em `vite.config.js`), modo navegador/PWA, service worker,
viewport CSS, área visível e zoom (`visualViewport`), densidade, orientação, toque,
modo de interação, cena, presets, movimento reduzido, idioma e user agent. Sem nomes,
progresso, áudio ou gestos. "Medir fluidez" liga `createFrameSampler()`
(`src/ui/frame-stats.ts`, janela de ~10 s, média/p95/quadros > 33 ms) e segue medindo
durante as fases até ser desligado, o que cancela seu único quadro. "Copiar resumo"
usa a área de transferência e, se falhar, seleciona o texto, que é selecionável apesar
do bloqueio global.

**Pendências.** Validar em aparelho conforme §11 (sessão de 10 min, Caderno longo,
leitor de tela, presets com mãos diferentes, prática com quem não conhece o jogo).
Exportação para o Obsidian não foi executada.
