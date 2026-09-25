# Revisão de usabilidade, acessibilidade e arquitetura

Data: 24/09/2026. Diagnóstico inicial e acompanhamento da implementação.

> **Documento histórico.** O "Quintal de descobertas" (exploração livre, sem
> corações nem derrota) descrito na seção 4 foi **substituído** a partir de
> `8878d62`, `150056c` e `e6b6dfd`: hoje **Explorar** monta uma palavra por fase,
> letra por letra, com corações e portal no fim. O quintal, seus seis objetos
> interativos e as "perguntas opcionais de leitura" não existem mais. O
> comportamento vigente dos três modos e dos níveis de apoio está em
> [02 — Gameplay](02-gameplay-e-controles.md) e no README; o trabalho seguinte
> está em [15 — Plano pós-streaming](15-plano-melhorias-pos-streaming.md).

## Atualização após mudança para o clone local

O projeto foi clonado em `~/Documents/aventura-nicolas_eloa`, fora do iCloud.
A linha de base passou com 470 testes. Foram implementados:

- Placas medidas pela fonte para sílabas e palavras, com o mesmo desenho com
  e sem imagens carregadas. Letras mantêm seu suporte compacto. O marcador
  central indica a área de coleta, cuja geometria permanece a existente.
- Atualização automática quando uma versão chega ao menu; bloqueio durante
  partidas, inclusive pausadas; nova tentativa após falha de ativação;
  consulta na abertura, reconexão e retorno à aba, além de intervalo de 5 min.
- Cache imutável somente para bundles com hash; imagens e fontes de URL fixa
  passam a revalidar. Offline e saves são preservados.
- Botões de menu/HUD acessíveis por Tab, foco inicial e retorno ao Canvas;
  Enter e Espaço mantêm ativação nativa em controles, sem disparo duplicado.
  Controles de gameplay ficam inertes enquanto um menu está aberto.
- Remoção da restrição de zoom, foco visível, alvos auxiliares de pelo menos
  44 px e espaço maior entre corações e controles do HUD.
- Preferência de movimento reduzido aplicada a partículas, texto flutuante,
  parallax, flutuação de itens, brilho do portal e celebração do menu.
- Narração distingue letra, sílaba e palavra; “Speed Run” vira
  “Corrida do alfabeto” no menu inicial.

Verificação: 482 testes passaram antes do último ajuste de foco/HUD; a
validação final é registrada na entrega. Build e typecheck passaram.
Chrome: fase BOLA aberta por Enter, foco devolvido ao Canvas, capturas em
1280 × 633 e 844 × 390. Entre dois builds de produção, o novo worker ficou
`waiting` durante a partida; ao voltar ao menu, a versão nova foi carregada
com as 151 entradas de progresso fictício preservadas.

Limites: tamanho de celular emulado, sem teste em aparelho físico; cabeçalhos
Nginx alterados por inspeção, sem deploy ou inspeção da produção. O novo modo
livre e a separação arquitetural de modos continuam como propostas, descritas
abaixo. Os parágrafos sobre iCloud registram o bloqueio da análise inicial.


## Escopo e limites

Foram examinados README, configuração Vite/PWA/Nginx, renderização de itens,
cena de jogo, menus React, CSS, HTML e testes relacionados. A documentação
descreve 16 unidades e 152 lições. O usuário confirmou que o jogo deve servir
para qualquer idade. A proposta organiza apoios e dificuldade por autonomia
e familiaridade com leitura, sem restringir os modos por faixa etária.

O workspace contém arquivos `dataless` do iCloud. Diversas leituras bloquearam
e algumas terminaram em timeout. `npm test` falhou com `ETIMEDOUT` ao carregar
arquivos locais, antes de produzir resultados da suíte. Não houve inspeção
visual em navegador nem verificação dos cabeçalhos da produção. Portanto,
esta revisão não certifica funcionamento, contraste, responsividade ou WCAG.

## 1. Atualização e cache — prioridade alta

### Evidências

- `docker/nginx.conf`: a regra por extensão entrega JS, CSS, imagens e fontes
  com `expires 30d` e `Cache-Control: public, immutable`. Ela também alcança
  arquivos de `public/` com URL estável, sem hash de conteúdo.
- O servidor já define `no-cache` para `sw.js`, `registerSW.js`, manifesto e
  HTML. Logo, não basta recomendar novamente esses cabeçalhos.
- `vite.config.js`: o service worker usa precache do aplicativo e atualização
  com `registerType: 'prompt'`.
- `src/ui/pwa-update.ts`: ao descobrir uma versão enquanto o usuário já está
  no menu, apenas exibe o aviso. A aplicação automática ocorre numa futura
  entrada no menu ou ao ocultar a página fora do jogo. O teste atual confirma
  explicitamente que encontrar uma atualização no menu não recarrega.
- A consulta periódica é de 30 minutos, com consulta adicional ao retornar
  à aba. Não há consulta explícita no evento de reconexão `online`.

Esses pontos explicam caminhos que mantêm conteúdo antigo, mas não comprovam
isoladamente a causa na produção. É necessário inspecionar também proxy,
versão implantada, worker ativo/em espera e erros de instalação do precache.

### Solução proposta

1. Manter cache longo e `immutable` exclusivamente para URLs com hash de
   conteúdo. Revalidar arquivos com nomes fixos, HTML e worker.
2. Detectar nova versão na abertura, retorno ao app e reconexão, com tratamento
   de falhas que permita nova tentativa.
3. Aplicar a atualização quando estiver no menu, inclusive se ela for
   descoberta depois que o menu já abriu. Durante uma partida, adiar até sair.
4. Exibir versão/build nas configurações e uma ação “Buscar atualização”.
5. Preservar perfis e progresso. Não usar limpeza de `localStorage` como
   mecanismo de atualização.

Eliminar todo o cache retira o benefício offline. A proposta é controlar sua
validade e ativar a versão nova em momento seguro. O precache versionado e o
cache HTTP são camadas diferentes; ambos devem ser testados.

Aceite: instalar versão A, publicar B com mudanças em JS e imagem de URL fixa,
voltar ao navegador e ao PWA, verificar atualização sem apagar progresso;
repetir offline, após reconexão e durante uma partida. A partida em andamento
não pode ser interrompida. Verificar também a rota `/controle`.

Referência: https://vite-pwa-org.netlify.app/guide/periodic-sw-updates

## 2. Palavras fora dos blocos — confirmado no código

`src/render/sprites.ts`, método `drawItems`, desenha o suporte de imagem em
40 × 40 com texto de 21 px. `CanvasRenderer.worldText` chama `fillText` sem
medição ou limite. O caminho alternativo sem imagem também não mede o texto.
O modelo visual funciona para uma letra, mas não acomoda palavras.

### Solução proposta

- Letras: manter o bloco compacto.
- Sílabas e palavras: usar uma placa horizontal com largura baseada em
  `measureText`, margens internas e altura consistente.
- Preservar uma fonte legível; reduzir tamanho apenas dentro de um limite
  definido. Não cortar, adicionar reticências ou comprimir letras para caber.
- Separar limites visuais da área de coleta, deixando essa área clara. Se a
  placa inteira passar a ser coletável, atualizar colisões e espaçamento.
- Verificar se placas vizinhas se sobrepõem nos níveis gerados. Corrigir
  apenas o renderer não garante que palavras longas caibam na composição.
- Aplicar o mesmo comportamento com e sem os assets carregados.

Aceite: testar letras, sílabas, `BOLA`, palavras acentuadas e a maior palavra
do currículo, incluindo celular em paisagem. Nenhum texto cortado ou
sobreposição; coleta coerente com a representação visual.

## 3. UI e acessibilidade

### Achados concretos

- `index.html` solicita `maximum-scale=1.0, user-scalable=no`: remover a
  restrição global e controlar gestos apenas na superfície de jogo.
- `src/ui/hud-controls.tsx` usa `tabIndex={-1}` nos controles de pausa e tela
  cheia: revisar acesso via Tab e manter os atalhos existentes.
- `src/ui/screens/mount-screen.ts` fornece `blurOnClick`: remover foco
  indiscriminadamente prejudica continuidade da navegação. Transferir foco
  de maneira explícita ao abrir/fechar telas e ao voltar ao jogo.
- O CSS possui `prefers-reduced-motion`, mas os módulos de efeitos e de
  celebração em Canvas não consultam essa preferência. Aplicar a preferência
  também aos efeitos decorativos executados por JavaScript.
- `GameScene._handleWrongAnswer` narra “Essa é a letra” inclusive quando o
  conteúdo é palavra ou sílaba. Usar o tipo da lição na mensagem.
- A tela inicial expõe “Speed Run”, progresso total e várias ações. Simplificar
  a linguagem e a hierarquia para quem ainda está aprendendo a ler.

### Direção de layout

Preservar personagens e pixel art. Usar tipografia simples para instruções e
conteúdo educativo, reservando a fonte decorativa para títulos curtos.

Tela inicial proposta:

1. **Explorar** — brincar sem ordem obrigatória.
2. **Aprender** — continuar as lições guiadas.
3. **Desafios** — corrida do alfabeto e atividades com metas.

Manter personagem visível; instalação, pareamento e gestão de progresso
ficam em uma área secundária para responsáveis. Preferências úteis à criança
(som, repetir fala, pausa) continuam fáceis de alcançar.

No jogo: instrução curta, botão de repetir narração, texto e ícone como apoio
à cor. Oferecer uma opção de prática sem perda de corações. Menus devem poder
funcionar em retrato, mesmo que a partida continue em paisagem.

Priorizar alvos de toque confortáveis (proposta de 48–56 CSS px), espaçamento,
foco visível, volumes separados de música/efeitos/voz e ajuste de movimento.
Esses tamanhos são uma escolha de produto; o mínimo WCAG 2.2 AA é de 24 × 24
CSS px ou espaçamento equivalente, com exceções.

O `aria-label` no Canvas não torna objetos e objetivos internos acessíveis.
Representar instruções e feedback relevante também em DOM. Uma experiência
completa por leitor de tela requer uma forma alternativa de interação;
narração automática, isoladamente, não resolve navegação espacial.

Referência: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum

## 4. Novo modo: Quintal de descobertas

### Estado implementado (histórico — removido, ver nota no topo)

O primeiro recorte agora está disponível no menu como **Explorar o quintal**. É uma
área segura, curta e revisitada livremente. A criança anda e pula; cada
objeto responde com uma descoberta. Não há resposta errada, cronômetro,
corações, ordem obrigatória ou bloqueio por desempenho.

Exemplo: tocar a bola faz a bola quicar, revela `BOLA` e pronuncia a palavra.
Um próximo toque repete a brincadeira. Encostar na árvore faz cair folhas;
pular em uma poça cria ondas. O jogo ensina por associação e causa/efeito.

Aprender continua exigindo atenção, mas deixa de exigir uma resposta correta
a uma pergunta. Esse é o objetivo do modo livre.

### Primeiro recorte entregue

- Um cenário, com 6 objetos e sem buracos perigosos.
- Interação por aproximação/coleta ou aterrissagem, sem um novo botão.
- Palavra, imagem e voz sincronizadas.
- Intervalo entre ativações, evitando disparos contínuos por colisão.
- Política de áudio que impeça várias falas simultâneas.
- Descobertas persistidas separadamente das notas e estrelas das lições.
- Repetição livre; sair a qualquer momento, sem tela de derrota.
- Nenhuma exigência de descobrir tudo para terminar ou liberar outra área.

O próximo passo é validar com crianças e responsáveis: ela entende que pode explorar sem instrução verbal do
adulto? Repete uma interação espontaneamente? A voz acompanha a ação sem
atrasar? Consegue sair e retornar sozinha?

### Evolução de apoio e acessibilidade (histórico)

O quintal agora desenha figuras próprias em pixel art e cada objeto tem uma reação
visual diferente. O modo assistido mostra a próxima descoberta com uma seta; o padrão
mantém a exploração livre; o modo desafio acrescenta perguntas opcionais de leitura,
sem bloquear progresso. As configurações persistem volumes separados de voz, música e
efeitos, texto ampliado, alto contraste, redução de movimento e adaptações de cor.

## 5. Sugestões de novas fases

| Fase | Brincadeira | Conteúdo educativo | Tipo |
| --- | --- | --- | --- |
| Quintal das palavras | Bola quica, árvore solta folhas, casa abre a porta | Vocabulário e causa/efeito | Exploração inicial |
| Fazenda dos sons | Animais respondem ao toque e ao pulo | Nome, imagem e som dos animais | Exploração |
| Jardim das cores | Plataformas colorem flores; misturas geram outra cor | Cores e observação | Exploração |
| Lago dos números | Pedras fazem aparecer 1, 2 ou 3 peixes | Quantidade e contagem | Exploração |
| Oficina das formas | Formas encaixadas viram casa, trem ou robô | Formas e composição espacial | Exploração |
| Ponte das sílabas | Escolher BO e LA revela uma bola | Composição de palavras | Guiada, posterior |
| Trilha das rimas | Associar figuras com sons finais semelhantes | Percepção sonora | Guiada, posterior |

Começar pelo quintal. As próximas áreas podem reutilizar seu modelo de
interação, com novos conteúdos. A adequação e a dificuldade devem ser
calibradas pela familiaridade com leitura e pelas preferências de quem joga,
sem bloqueio por idade. Oferecer apoio de voz e imagem, prática sem punição e
desafios opcionais; validar a compreensão com pessoas de diferentes idades.

## 6. Arquitetura

### O que preservar

- Motor TypeScript/Canvas separado das telas React.
- Adaptadores de entrada com ações semânticas.
- Conteúdo em dados e gerador de níveis.
- Persistência por perfil e testes de regras de dependência.
- Física e controlador do personagem reutilizáveis entre modos.

Não há evidência nesta revisão de que trocar engine ou framework resolva os
problemas relatados.

### Onde evoluir

`GameScene` orquestra entrada, física, desenho, validação de respostas, vidas,
narração, persistência e regras de corrida. Isso é administrável nos modos
atuais, mas adicionar exploração como várias novas condicionais aumentaria
o acoplamento. Existem também coerções como `as unknown as GameLevel` e
`as never` na fronteira de dados e eventos, reduzindo garantias de tipos.

Antes do terceiro modo, extrair as regras de lição, corrida e exploração
para módulos pequenos. A cena mantém o ciclo de vida e coordena serviços;
cada modo decide o efeito de uma interação, seu objetivo e sua conclusão.
Reutilizar `SpeedrunRun`, evitando refazer lógica já separada.

Modelar objetos de descoberta como dados: identificador, posição, asset,
rótulo, narração, gatilho e efeito conhecido. Os dados escolhem efeitos
predefinidos; não carregam código executável. Criar persistência de
descobertas com migração do save, sem misturar descobertas com acertos.

Centralizar a medição e composição dos rótulos e fortalecer o tipo validado
de nível para diminuir casts. Os testes atuais de arquitetura verificam
imports por regex; são uma proteção útil, mas não demonstram desacoplamento
completo nem substituem testes de comportamento.

## 7. Ordem de execução e validação

1. Materializar os arquivos do iCloud e obter uma linha de base de testes,
   typecheck e build. Identificar a URL/infraestrutura efetiva da produção.
2. Corrigir atualização e geometria dos rótulos, com os cenários de aceite
   descritos acima e verificação de atualização entre dois builds.
3. Corrigir narração, zoom, foco e movimentos decorativos; validar teclado,
   toque, zoom, leitores de tela nos menus e aparelhos reais.
4. Extrair apenas as regras necessárias para o terceiro modo e implementar
   o protótipo do quintal.
5. Observar o uso pelas crianças e só então expandir as novas fases.

Para liberar a etapa 1 localmente, usar “Baixar Agora”/“Manter Baixado” na
pasta do projeto no Finder, ou trabalhar numa cópia integral fora do iCloud.
O timeout de leitura impede considerar os testes executados com sucesso.
