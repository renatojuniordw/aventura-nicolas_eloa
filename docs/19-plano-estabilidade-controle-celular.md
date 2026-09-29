# 19 — Estabilidade do controle por celular na bolsinha

Data: 28/09/2026. Status: diagnóstico local concluído. **Atualização 29/09/2026:** P0.1–P1.2 implementados e cobertos por testes automatizados (§8); a matriz de aparelhos da §5 e as três sessões reais de 30 min da §6 ainda não foram executadas, portanto o plano **não está aceito**.

## 1. Relato e conclusão

Um segundo celular foi conectado pelo QR code e colocado numa bolsinha presa à criança. Enquanto ela pulava, o controle deixava de funcionar. Há suspeita de bloqueio da tela ou atualização/recarregamento acidental.

O código tem lacunas reais de prevenção, detecção e recuperação. Não é possível atribuir a ocorrência a uma única causa sem registros do aparelho e do servidor naquele momento. “Não pula mais” também pode significar sensor parado, sala perdida ou jogo pausado, mesmo com o WebSocket conectado.

Prioridades: distinguir essas situações, pausar quando o controle não estiver operacional, recuperar o pareamento sem novo QR em quedas curtas e reduzir interações acidentais dentro da bolsinha.

A revisão foi feita sem abrir navegador, sem acesso à produção e sem pesquisa externa. Foram lidos código, documentação, testes e a implementação local instalada de Socket.IO. A cópia do documento 12 no Obsidian contém a mesma descrição de reconexão e Wake Lock; ela não comprova funcionamento no aparelho. O vault não foi alterado, respeitando o limite do AGENTS.md para tarefas que não pedem edição do Obsidian.

## 2. Causas e evidências

| Situação | Evidência no repositório | Avaliação |
| --- | --- | --- |
| Tela apaga ou página fica oculta | `WakeLockKeeper`, em `src/controle/main.ts`, pede Wake Lock no início e ao voltar à visibilidade. Falhas retornam `null` silenciosamente; não acompanha o evento `release` nem informa o estado. | Proteção incompleta confirmada. Bloqueio/suspensão como causa do episódio ainda é hipótese. Não pressupor que uma página continuará executando com a tela bloqueada. |
| Toque, arrasto ou botão físico dentro da bolsinha | `src/styles/controle.css` não tem modo protegido nem controle de overscroll. | Interação acidental é plausível, mas não foi observada. A página não consegue impedir todos os gestos do sistema ou o botão de bloqueio. |
| Socket conecta, mas sala/sensor não estão prontos | `status-message.ts` mostra “Pronto” com `listening + connected`. Não existe confirmação positiva de entrada na sala. Calibração termina por tempo, inclusive com zero amostras. | Falso estado de prontidão confirmado. |
| Sensor para, conexão continua aberta | Não há monitor de idade/frequência das amostras em `controle/main.ts`. | O jogo pode continuar correndo sem que a criança consiga comandá-lo. Falta de detecção confirmada. |
| Queda do aparelho que exibe o jogo | `PhoneViewerTransport` não expõe queda do próprio socket ao coordenador. `RoomManager.disconnect(viewer)` não avisa o celular, apesar do comentário sugerir isso. | Falha confirmada: a pausa por `peer-left` cobre queda do controle, não todos os caminhos de perda de conexão. |
| Reconexão rápida/reload do controle | `RoomManager.join` identifica ocupação por `socket.id`. Um novo socket recebe `room-full` enquanto o antigo ainda consta conectado. | Reproduzido localmente. Pode acontecer durante sobreposição de conexões; não ocorre necessariamente em todo reload. |
| Retry depois de erro | `_join()` só ocorre no evento `connect`. O botão chama `connect()` mesmo se o socket já está conectado. `roomError` não é limpo por uma confirmação de pareamento, que não existe. | Recuperação incompleta. Repetir o fluxo pode adicionar novos listeners de sensor sem remover os antigos. |
| Sala expira | TTL de 15 s após detectar ausência do viewer; 5 min após detectar ausência do controller. Ao expirar o controller, a sala é removida sem avisar o viewer ainda conectado. | A volta do controle recebe `room-not-found`; um viewer conectado não recria a sala sozinho. Reproduzido localmente. |
| Viewer retorna com controller presente | Entrada do viewer não envia snapshot de presença nem `peer-joined` referente ao controller existente. | Reproduzido localmente; ambos podem ficar com percepções diferentes da sessão. |
| Ações durante queda de rede | `sendAction()` usa `emit` comum e não verifica prontidão. Socket.IO instalado acumula mensagens offline em `sendBuffer` e o descarrega antes do callback `connect`, no qual o app faz `join`. | Risco confirmado de comandos antigos e/ou descartados antes do rejoin. O efeito final depende da ordem e do estado da sala. |
| Volta ao menu | `MenuScene.enter()` chama `phoneControl.stop()` quando ativo. | Desconexão intencional confirmada. Pode parecer uma falha ao terminar uma atividade e voltar ao menu. |
| Colisão, derrota ou tentar novamente | `GameScene.onGameOver()` abre uma tela; `restart()` troca/reinicia a cena. Não há reload nesses caminhos. | Não há evidência de que bater no jogo recarregue a página. Voltar ao menu é um caminho diferente. |
| Atualização do PWA | `vite.config.js` usa `registerType: 'prompt'`. `UpdateController.apply()` bloqueia atualização na cena `game`; `onHidden()` pode aplicá-la fora dessa cena. `/controle` não inicializa esse controlador. | Atualização automática durante a cena de jogo não é a principal suspeita pelo código atual. Pareamento no menu, outras abas e reload externo ainda precisam de validação. |
| Rede/servidor | Sala vive em memória; reiniciar o processo perde salas. Reconectar controller antes do viewer recriar sala pode gerar `room-not-found` sem nova tentativa de join. | Limitação confirmada; queda real da rede/processo no episódio não foi verificada. |

O indicador atual de latência mede viewer → servidor → viewer, apenas no pareamento. Ele não mede a saúde do sensor nem todo o caminho controle → jogo. O timeout de leitura de 3600 s na rota Socket.IO do Nginx versionado não sugere, por si só, um corte curto; a configuração efetivamente implantada não foi auditada.

## 3. Comportamento desejado

1. O adulto escaneia o QR, autoriza sensores e faz a calibração com o aparelho parado na posição de uso.
2. Só aparece “Pronto” depois de confirmar sala, presença do jogo e amostras válidas recentes. O estado da proteção de tela é mostrado separadamente; indisponibilidade exige orientação, sem alegar proteção ativa.
3. O adulto ativa “Modo bolsinha”: tela escura, sem controles acionáveis por um toque simples e sem rolagem desnecessária. A tela permanece ligada; isso não é bloqueio do sistema.
4. Se rede, sensor ou página deixarem de responder, o jogo pausa e explica o motivo conhecido. Incerteza deve aparecer como “Controle sem resposta”, sem afirmar que a tela bloqueou.
5. Ao voltar, o sistema recupera a mesma sessão quando válida, verifica sensor e pareamento e oferece “Continuar” no aparelho do jogo. Não retoma corrida automaticamente.
6. Ao trocar de fase ou voltar ao menu, o pareamento pode permanecer; os comandos de movimento ficam desarmados fora da partida.
7. “Desconectar celular” encerra explicitamente a sessão. Expiração definitiva informa os dois lados e oferece novo QR.

Limite do produto web: não prometer leitura contínua de sensores ou conectividade com tela bloqueada, aplicativo suspenso ou processo encerrado. A solução inicial é manter a página visível e recuperar a sessão após interrupção. Se funcionar com tela bloqueada for requisito obrigatório, abrir investigação específica de implementação nativa e restrições de cada sistema; empacotar com Capacitor, por si só, não comprova esse comportamento.

## 4. Plano de implementação

### P0.1 — Diagnóstico que sobrevive à interrupção

Arquivos: `src/controle/main.ts`, `src/net/signaling-socket.ts`, `src/net/phone-control-coordinator.ts`, `signaling/src/server.js`; novo módulo de diagnóstico compartilhado onde fizer sentido.

- Registrar eventos limitados em quantidade: início da página, tipo de navegação quando disponível, `visibilitychange`, `pagehide/pageshow`, online/offline, aquisição/liberação/erro de Wake Lock, connect/disconnect com motivo, join aceito/rejeitado, expiração e retomada.
- Registrar versão do build, papel do aparelho, identificador de execução, sequência e horários. Não interpretar `navigator.onLine` como comprovação de acesso ao servidor.
- Registrar idade da última amostra e frequência aproximada; não guardar fluxo bruto por padrão. O gravador de sensores existente continua opcional para investigar detecção de pulo.
- Buffer circular local com persistência periódica moderada e em transições; não depender de `unload`, que pode não ocorrer. Limitar inicialmente a 300 eventos e uma sessão anterior, com opção de apagar/exportar.
- Relatório acessível no jogo e controle após falha, com IDs de correlação não secretos. Não exportar URL completa, código de pareamento, token de retomada nem nome da criança.
- No servidor, registrar motivo real da desconexão e resultado das transições; revisar logs atuais que imprimem a sessão completa. Atualizar documento de privacidade ao implementar retenção.

Aceite: após um reload, diferenciar nova execução de uma simples reconexão e reconstruir a sequência anterior até o último evento persistido. Não prometer identificar pressão no botão físico sem evidência disponível.

### P0.2 — Estado operacional e pausa confiável

Arquivos: transportes e sessão em `src/net/`, `src/controle/status-message.ts`, `src/controle/main.ts`, `src/core/event-bus.ts`, `src/scenes/game-scene.ts` e UI de pausa.

- Separar modo selecionado, socket conectado, sala aceita, peer presente, sensor ativo e controle armado. `isActive` sozinho não representa saúde da conexão.
- Criar confirmação de `join` com snapshot autoritativo da sala, versão do protocolo, geração da sessão e presenças. Repetir join deve ser idempotente; timeout de confirmação deve produzir retry explícito, sem depender de novo `connect`.
- Limpar erros transitórios apenas após confirmação válida. Classificar sala cheia, esperando jogo retornar, sessão expirada e incompatibilidade de versão.
- Monitorar sinal de vida da aplicação, contendo estado do sensor e da página. O servidor repassa presença/saúde; o viewer mede tempo desde o último sinal recebido usando seu próprio relógio monotônico.
- Parâmetros iniciais para ensaio: sinal a cada 1 s, pausa após 3 s sem saúde válida; sensor suspeito após 1 s sem amostra válida. Ajustar com aparelhos reais e contabilizar falsos positivos. Não esperar apenas o timeout do transporte.
- Queda local do viewer também deve pausar imediatamente quando detectada. Um viewer suspenso deve revalidar saúde antes de voltar a executar frames da partida.
- Motivo próprio de pausa do controle, com “Reconectando”, “Sensor sem resposta” ou “Sessão encerrada”. Preservar pausas manuais/orientação; reconexão não as desfaz.
- Bloquear continuar/reiniciar uma partida em modo celular enquanto não operacional; permitir desativar o modo e usar toque/teclado.
- Limpar ações pendentes na perda e recuperação. Ressincronizar auto-run somente depois da confirmação de continuar.

Aceite: ausência de saúde válida pausa dentro do limite configurado enquanto o viewer executa; reconectar não faz personagem correr ou pular sozinho.

### P0.3 — Wake Lock e ciclo de vida do sensor

Extrair de `src/controle/main.ts` serviços testáveis, por exemplo `wake-lock-keeper.ts` e `motion-session.ts`.

- Wake Lock com estados explícitos: solicitando, ativo, liberado, indisponível e erro. Escutar `release`; readquirir quando visível e a sessão precisar, com tentativas limitadas e sem loop de erro.
- Tornar aquisição idempotente, impedir requisições concorrentes e liberar locks que chegarem após encerrar a sessão. Implementar `stop/dispose` e remover listeners.
- Mostrar “Tela protegida contra apagar” somente com lock confirmado; orientar o adulto quando não houver proteção. Não garantir que isso impeça bloqueio manual.
- Manter uma única assinatura `devicemotion`. Retry de pareamento não deve reinstalar captura/calibração indiscriminadamente.
- Validar amostras finitas, quantidade e duração mínima de calibração. Sem sensor, mostrar erro acionável em vez de `listening`.
- Reiniciar estado transitório do detector após lacuna/suspensão para não combinar amostras antigas com novas. Recalibrar quando necessário; revalidar permissões com gesto se o sistema exigir.
- Envio de pulos somente com página apta, sala confirmada, sensor saudável e partida armada.

Aceite: repetir start/retry/retorno 20 vezes mantém um único listener e uma única aquisição ativa; zero amostras nunca gera “Pronto”.

### P0.4 — Reconexão, retomada e expiração das salas

Arquivos: `signaling/src/room-manager.js`, `signaling/src/server.js`, `src/net/signaling-socket.ts`, transportes e sessão.

- Identidade de retomada independente de `socket.id`: servidor emite credencial aleatória por papel após primeiro pareamento. Persistir no armazenamento da aba quando possível, com expiração e sem logs. O código do QR sozinho não autoriza substituir um peer ativo.
- Reconexão autenticada substitui atomicamente o socket anterior. Invalidar ações e callbacks do socket antigo; seu `disconnect` tardio não pode remover o substituto.
- Mesmo sem queda do socket, permitir rejoin com backoff limitado, jitter e feedback. Se controller chegar antes do viewer após reinício do servidor, classificar a espera e tentar novamente dentro de uma janela definida.
- Enviar snapshot aos dois lados após qualquer join/rejoin. Avisar saída e retorno do viewer ao controller.
- Separar “sair temporariamente” de “encerrar sessão”. Encerramento explícito informa imediatamente; desconexão inesperada mantém janela de recuperação.
- Proposta inicial: 2 min de tolerância para viewer e 5 min para controller, contando da detecção de ausência, com limite absoluto de inatividade definido. Esses valores são de retenção da sala, não de tempo para pausar o jogo; validar consumo e UX antes de consolidar.
- Expiração limpa timers, índices de peers e credenciais e notifica peers conectados. Sala aguardando primeiro pareamento também deve expirar.
- Após perda da memória do servidor, não fingir retomada autenticada: na primeira entrega, informar perda da sessão e oferecer novo QR se a recuperação não for possível. Persistência de sessões fica condicionada à necessidade observada.
- Reload do controle pode preservar intenção de retomada na mesma aba; apresentar botão para reativar sensor quando necessário. Reload do jogo não deve prometer restauração da partida em andamento, que é problema separado de reconectar o controle.

Aceite: novo socket do mesmo controle recupera sessão válida sem `room-full`; outro celular continua rejeitado; eventos tardios do socket substituído não alteram a sessão nova.

### P0.5 — Comandos de pulo sem fila antiga

Arquivos: `src/net/signaling-socket.ts`, `src/net/phone-controller-transport.ts`, `src/input/phone-adapter.ts`, `signaling/src/room-manager.js`.

- Ações de movimento são efêmeras: não devem ser reenviadas depois de reconectar. Usar guarda de prontidão e emissão sem buffer, validando o comportamento na versão instalada.
- Separar comandos efêmeros de mensagens de sessão que exigem confirmação/retry.
- Acrescentar geração da sessão/armamento e sequência para rejeitar eventos de conexões anteriores e duplicatas. Não comparar relógios absolutos de dois celulares como se fossem sincronizados.
- Expirar comandos atrasados por uma política testável; se usar idade fim a fim, definir estimativa de diferença de relógios e tolerância. Nunca executar um lote de pulos acumulados ao retornar.
- Revisar contrato de pulso do `PhoneAdapter`: emissão atual só envia `pressed: true`; testar limpeza/soltura sem mudar a regra de pulo no controlador do jogador.
- Dar unsubscribe aos listeners e definir um único dono do transporte; remover o acoplamento em que desanexar input obrigatoriamente desconecta a sessão se o pareamento for preservado no menu.

Aceite: saltar durante 10 s offline não produz salto ao reconectar; somente gesto novo, depois de armar/continuar, gera ação.

### P1.1 — Modo bolsinha

Arquivos: `controle.html`, `src/styles/controle.css`, `src/controle/main.ts` e módulos de UI extraídos.

- Após validação, oferecer “Ativar modo bolsinha”, com confirmação visual de conexão, sensor e proteção de tela.
- Tela escura de baixo brilho visual, status mínimo e nenhum botão destrutivo exposto. Cor escura não reduz programaticamente o brilho do sistema.
- Desbloqueio intencional, por exemplo manter pressionado por 2 s e confirmar; oferecer alternativa acessível. Evitar botão de toque simples que reinicie o fluxo.
- Conter overscroll/pull-to-refresh onde suportado, remover seleção e gestos desnecessários apenas na superfície protegida. Preservar acessibilidade nos demais fluxos; não aplicar bloqueio global de zoom.
- Tela cheia opcional após gesto, com fallback. Nenhuma promessa de bloquear barra do navegador, navegação do sistema ou botão físico.
- Orientação breve: ajustar o aparelho na bolsinha sem pressionar botões e fazer calibração na posição de uso. Testar colocação e retirada, não apenas aparelho parado na mão.

Aceite: toques e arrastos comuns sobre a página protegida não reiniciam, desconectam ou recalibram o controle. Limitações do navegador ficam explícitas na validação por aparelho.

### P1.2 — Continuidade entre fases e atualização

Arquivos: `src/scenes/menu-scene.ts`, `src/net/phone-control-coordinator.ts`, `src/input/phone-adapter.ts`, `src/ui/pwa-update.ts`, `src/ui/screens/phone-pairing.tsx`, `vite.config.js`.

- Preservar pareamento entre fases e menu, restaurando teclado/toque no menu e desarmando pulos remotos. Desconectar somente por ação explícita, troca de sessão ou expiração.
- Exibir “Celular conectado” e acesso a diagnóstico/desconexão no menu; iniciar fase novamente exige saúde válida.
- Adiar atualização enquanto houver pareamento ativo, inclusive na tela de QR e pausas. Coordenar avisos entre abas do mesmo aparelho quando necessário; servidor sinaliza incompatibilidade de protocolo entre aparelhos.
- Oferecer atualização após encerramento da sessão. Validar `/controle` e `/controle.html`, cache antigo, recarga e retorno de background. A denylist existente do fallback deve continuar coberta.
- Corrigir comentários de `pwa-update.ts` que sugerem aplicação automática ao entrar no menu: o código atual de `_syncBanner` apenas controla o banner.

Aceite: três atividades seguidas sem novo QR; update pendente não interrompe pareamento/partida; menu continua operável com toque/teclado.

## 5. Testes necessários para implementar

### Automatizados, sem navegador

- Wake Lock recusado, ausente, liberado com página visível, retorno de visibilidade, aquisição concorrente e encerramento durante promessa pendente.
- Calibração vazia/inválida, sensor silencioso com socket conectado, retorno após lacuna, start/retry idempotentes e limpeza de listeners.
- Join confirmado/timeout, erro transitório limpo somente no sucesso, rejoin sem novo connect e conexão estabelecida sem viewer presente.
- Controller e viewer reconectam em ambas as ordens; socket antigo ainda vivo; disconnect tardio; outro celular tentando ocupar a sala; dois retries concorrentes.
- Expiração de ambos os papéis, primeiro pareamento abandonado, encerramento explícito e reinício do servidor.
- Eventos antigos/duplicados, buffer offline, gerações anteriores e descarte de pulos enquanto pausado/desarmado.
- Pausa por queda local do viewer e por saúde remota; tentativa de continuar ainda offline; pausa manual preservada; auto-run somente após retomada confirmada.
- Menu preserva conexão, restaura input local e ignora pulos; atualização pendente respeita sessão ativa.
- Integração Node com servidor e clientes Socket.IO reais para validar ordem de connect/join, buffer e substituição. Fakes unitários atuais não cobrem esse comportamento do transporte.

### Validação futura nos aparelhos, a ser realizada pelo responsável

Nenhum navegador foi aberto nesta tarefa. Esta matriz é roteiro para testes posteriores, não resultado já obtido.

| Ensaio | Resultado esperado |
| --- | --- |
| 30 min com aparelho na bolsinha, períodos de movimento e repouso | Sem perda irrecuperável ou falso “Pronto”; medir bateria e falsos alarmes. |
| Esperar o tempo de bloqueio automático | Proteção ativa mantém tela; se liberada/indisponível, aviso e pausa quando necessário. |
| Bloquear manualmente, desbloquear após 10 s e após 1 min | Pausa, recuperação da sessão válida, sensor revalidado e continuar explícito. |
| Alternar aplicativo/aba ou receber chamada | Mesmo contrato de suspensão e retomada; registrar sequência. |
| Retirar rede de cada aparelho separadamente por 5 s e 30 s | Pausa no prazo, estado coerente dos dois lados e recuperação quando a sala for válida. |
| Alternar Wi-Fi/dados móveis, quando disponível | Reconexão sem sessão duplicada e sem pulos antigos. |
| Recarregar controle durante uso | Retomada na mesma aba se credenciais disponíveis; pedir gesto para sensor quando exigido. |
| Recarregar jogo | Sem “Pronto” falso no controle; retomada ou novo pareamento com explicação, sem prometer restaurar fase. |
| Tocar e arrastar na tela dentro da bolsinha | Modo protegido não dispara ações comuns nem recalibração. |
| Derrota, tentar novamente, vitória, menu e próxima fase | Distinguir transições de jogo de desconexão; preservar pareamento conforme novo contrato. |
| Atualização pendente e reinício do servidor | Atualização adiada; perda de sala tratada com recuperação ou novo QR explícito. |
| Economia de bateria, permissão negada e Wake Lock recusado | Mensagens correspondem ao estado real, sem afirmar proteção inexistente. |

Registrar modelo, sistema, navegador/versão, modo aba/PWA, rede de cada aparelho, economia de energia, versão do jogo e relatório diagnóstico. Cobrir Android e, se fizer parte do uso, iPhone. Comparar aparelho na mão e na bolsinha para separar falha de detecção de falha de conexão.

## 6. Ordem de entrega e definição de pronto

1. **Diagnóstico e pausa:** P0.1 + P0.2; tornar a próxima ocorrência explicável e evitar corrida sem controle.
2. **Sessão confiável:** P0.3 + P0.4 + P0.5; lifecycle, retomada, recuperação e descarte de comandos antigos.
3. **Uso na bolsinha:** P1.1; proteção de interações e ensaio físico.
4. **Continuidade:** P1.2; manter pareamento e coordenar atualizações.
5. **Consolidação:** executar matriz real, ajustar tempos, atualizar docs 03, 06, 10, 11 e 12 conforme comportamento entregue. Exportação/diário no Obsidian apenas quando a tarefa envolver autorização para alterar o vault.

Considerar pronto após testes automatizados e pelo menos três sessões reais de 30 min nos aparelhos alvo, com zero perdas irrecuperáveis dentro da janela de retomada, zero comandos antigos após recuperação e zero estados “Pronto” sem os requisitos operacionais. Medir pausas falsas e corrigir qualquer padrão recorrente antes de liberar. Os limites temporais propostos precisam ser confirmados nesse ensaio.

## 7. Validação executada nesta revisão

- `npm test -- src/net/signaling-socket.test.js src/net/phone-control-coordinator.test.js src/input/phone-adapter.test.js src/controle/status-message.test.js src/controle/jump-detector.test.js src/ui/pwa-update.test.js`: **183 testes passaram, 6 arquivos**.
- `npm --prefix signaling test`: **22 testes passaram, 2 arquivos**.
- Reprodução direta em Node, com `RoomManager` e peers/timers controlados: novo socket recebe `room-full` antes de remover o antigo; saída do viewer não notifica controller; retorno do viewer não recebe snapshot; expiração do controller elimina sala e próximo join recebe `room-not-found`.
- Inspeção do Socket.IO instalado confirmou buffer offline descarregado antes do evento `connect` usado pelo app para join.
- Os testes existentes passarem não valida o cenário da bolsinha: faltam casos de ciclo de vida e integração descritos acima.
- Não houve alteração de código funcional, deploy, execução de servidor de desenvolvimento ou abertura de navegador. Não foi necessário build/typecheck para esta entrega documental. Alterações preexistentes no workspace foram preservadas.

## 8. Implementação (29/09/2026)

Contrato consolidado em [12 — Controle por celular, §11](12-controle-por-celular.md#11-estabilidade-retomada-e-modo-bolsinha-plano-19-29092026). Resumo por item:

| Item | Entregue | Arquivos principais |
| --- | --- | --- |
| P0.1 Diagnóstico | Registro circular (300 eventos, execução atual + anterior) persistido a cada 5 s e em transições (`visibility-hidden`, `pagehide`, quedas, erros de join, fim de sessão, Wake Lock liberado, mudança de saúde); tipo de navegação, versão e ID de execução; sem código, token, URL ou nome. Relatório no celular (copiar/apagar) e no suporte do jogo. No jogo só grava depois do primeiro uso do controle por celular. Logs do servidor com código mascarado e motivo real da desconexão. | `src/net/diagnostics-log.ts`, `signaling/src/room-manager.js`, `signaling/src/server.js`, docs/10 §2.1 |
| P0.2 Estado operacional | `joined` com snapshot, versão de protocolo, geração e presenças; join idempotente com timeout e retry com backoff/jitter sem novo `connect`; erro limpo só em sucesso; `waiting-room`. Sinal de vida a cada 1 s; jogo avalia a cada 500 ms (3 s sem sinal → `no-response`), sensor `stale` após 1 s, página oculta, queda do próprio jogo. Pausa uma vez, motivo na pausa, "Continuar"/"Recomeçar fase" bloqueados, "Desativar" disponível. | `src/net/signaling-socket.ts`, `src/net/phone-viewer-transport.ts`, `src/net/phone-control-coordinator.ts`, `src/scenes/game-scene.ts`, `src/ui/screens/pause.tsx`, `src/controle/status-message.ts` |
| P0.3 Wake Lock e sensor | `WakeLockKeeper` com estados, `release`, readquisição limitada, requisição única e lock tardio liberado, `dispose`. `MotionSession` com listener único, validação de amostras, calibração mínima (10 amostras, repouso plausível), reinício do detector após lacuna. "Pronto" exige sala, jogo presente e sensor. | `src/controle/wake-lock-keeper.ts`, `src/controle/motion-session.ts`, `src/controle/main.ts` |
| P0.4 Retomada | Token por papel; substituição atômica com `session-replaced`; eventos tardios ignorados; snapshot aos dois lados; saída/volta da TV avisada ao celular; `leave` explícito com ack; TTL 2 min (TV), 5 min (celular), 15 min sem pareamento; expiração notifica e limpa tokens. | `signaling/src/room-manager.js`, `src/net/signaling-socket.ts` |
| P0.5 Comandos | Envio só com sala confirmada; purga de `action`/`health` do `sendBuffer` na queda; servidor ignora socket não re-juntado; `generation` + `seq` descartam antigos e duplicados; pulos só armados (partida + saúde). `volatile` rejeitado após verificação na versão instalada (descarta pacote enquanto o anterior é escrito). `PhoneAdapter` só inscreve/desinscreve. | `src/net/action-filter.ts`, `src/input/phone-adapter.ts` |
| P1.1 Modo bolsinha | Tela preta mínima; sair com 2 s segurando + confirmação (foco em "Continuar protegido", volta sozinho em 6 s); ativação por teclado vai à confirmação; overscroll/seleção/menu de contexto contidos só ali; tela cheia opcional. | `src/controle/view.ts`, `src/styles/controle.css` |
| P1.2 Continuidade | Menu desengaja sem desconectar; partida seguinte reusa o celular; partida sem saúde abre pausada; tela de pareamento mostra a sessão existente com "Desconectar celular" e, após fim, "Gerar novo QR code"; atualização do PWA adiada com sessão ativa; comentários de `pwa-update.ts` corrigidos. | `src/scenes/menu-scene.ts`, `src/ui/screens/phone-pairing.tsx`, `src/ui/pwa-update.ts` |

**Testes automatizados** (todos os cenários da §5 “sem navegador”): `npm test` 1022 testes/100 arquivos, `npm --prefix signaling test` 39 testes, `npm run typecheck` e `npm run build` passam. Inclui integração com servidor e clientes socket.io reais (`src/net/signaling-integration.test.js`): pareamento, `room-full`, recarga com token com o socket antigo vivo, 10 pulos durante queda não entregues após reconectar (inclusive pacote que ficou no buffer), volta da TV e encerramento. O `npm --prefix signaling test` exige `npm --prefix signaling ci` antes (a pasta estava sem dependências).

Ensaio ponta a ponta em Chrome headless (jogo e controle em abas separadas, servidor de sinalização real, `devicemotion` sintético; script descartável, não versionado): 19/19 verificações — pareamento com protocolo 2, "Pronto" só após sensor, partida sem pausa, modo bolsinha, pulo entregue com `seq`/`generation`, sensor parado pausando com motivo e "Continuar" travado, liberação ao voltar, menu sem desconectar, pareamento reaberto sem novo QR, recarga do celular retomando a sessão com diagnóstico preservado e "Desconectar celular" encerrando no celular. Não substitui aparelho real: não há sensor físico, bloqueio de tela nem rede móvel.

**Decisões desta implementação:** o critério de parada da §4 P0.2 usa 3 s sem sinal; a janela de retenção da TV subiu de 15 s para 2 min, como proposto; as sessões não são persistidas no servidor (reinício → espera de 60 s e depois novo QR). Todos os tempos seguem provisórios até a matriz real.

**Pendente:** matriz de aparelhos da §5 (bolsinha 30 min, bloqueio automático e manual, troca de app, rede de cada aparelho, Wi-Fi/dados, recarga dos dois lados, toques na bolsinha, transições, atualização, economia de bateria), medição de pausas falsas, ajuste dos tempos e as três sessões reais de aceite da §6.
