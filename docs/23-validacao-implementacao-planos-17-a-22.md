# 23 — Validação da implementação dos planos 17–22

> **Revalidação atual:** veja a §7, baseada em `c815ab3`. As §§1–5 são o diagnóstico histórico de `5cda30d`; a §6 registra as correções posteriores. Não usar a tabela da §1 como estado atual: o plano 19 recebeu implementação e M20 foi auditado, mas a revalidação encontrou lacunas adicionais.

Data: 29/09/2026. Base inspecionada: `5cda30d`, workspace inicialmente limpo.

**Conclusão: os seis planos não estão integralmente implementados nem aceitos.** Há entregas consistentes com testes, escopos explicitamente adiados e falhas ainda presentes. Testes passando não encerram os critérios de aparelho real.

Esta revisão verifica o repositório local, sem alterar código funcional, saves ou Obsidian. Não revalida o projeto externo de referência. As estratégias antigas de rolagem dos planos 17/20 foram substituídas pela paginação do plano 22; essa mudança não foi classificada como regressão por si só.

## 1. Resultado por plano

| Plano | Resultado | Evidência e pendências |
| --- | --- | --- |
| **17 — Layout mobile** | **Parcial; correções principais presentes** | `touch-adapter.ts` rastreia dedos e libera ações; `touch-controls.css` restringe gestos durante `playing`; `hud-safe-area.ts` mede controles DOM; Canvas mantém proporção; menu e tipografia foram reorganizados. Entrega 5 continua parcial: informação do HUD permanece no Canvas. Faltam aceite do zoom no iPhone 17, contraste medido e opção manual de toque em híbridos. O fallback de Touch Events era condicional e sua ausência não é defeito comprovado. |
| **18 — Experiência complementar** | **M1–M8 presentes em código; aceite parcial** | Suspensão da celebração, política sistema OU jogo, contexto de navegação, fallback de imagem, presets persistentes, prática separada do progresso, feedback por ponteiro e suporte local estão implementados e cobertos pela suíte. Permanecem ergonomia, leitor de tela, offline, desempenho e uso por crianças em aparelho. As exceções de layout com texto ampliado também afetam esta experiência. |
| **19 — Estabilidade do celular** | **Plano corretivo não implementado** | Existe a base anterior de pareamento, pausa por `peer-left`, reconexão do socket e Wake Lock simples. Não foram entregues os contratos novos de P0.1–P0.5/P1.1–P1.2: diagnóstico persistente, saúde operacional, sensor idempotente, retomada autenticada, comandos sem fila antiga, bolsinha e continuidade. Defeitos confirmados abaixo. |
| **20 — Melhorias da referência** | **Primeiro recorte implementado; restante proposto** | Mapa de mundos, 20 palavras temáticas e dicas progressivas presentes. L2 parcial (dica separada; sem Monta-sílabas/etapas novas); L3 parcial, ampliado pelo plano 21 (fundos por mundo). F3–F5, Monta-sílabas, corridas temáticas, associação, memória, poderes, gamepad e recompensas/resumo para responsáveis não estão entregues. Imagens das palavras novas foram explicitamente retiradas do recorte: não atende à proposta integral de F1, mas corresponde à adaptação registrada na §12. |
| **21 — Importação** | **Recorte das §9–10 implementado; validação prática pendente** | Dois WAV, catálogo/ganhos, reprodução por resposta, limpeza, licença, créditos, dez palavras, segmentações, textura e fundos presentes. Hashes dos três derivados conferem com o registro; build inclui WAV/textura no precache e a licença na distribuição. Mecânicas de lava/poderes e seus testes continuam dependentes do plano 20; `speed.png` foi corretamente adiado. Audição, desbloqueio no dispositivo, offline real, pronúncia e custo visual não estão aprovados. |
| **22 — Auditoria UX** | **Implementação ampla, mas conclusão integral não demonstrada** | Coach, home, configurações em telas próprias, caderno/mapa paginados, resultados e navegação presentes. M20 (app controlador) segue sem entrega de auditoria; M17/M18 não receberam a validação integrada exigida. Há exceções ampliadas de rolagem e limites na ferramenta visual. Não cabe afirmar que todos os P0/P1 estão encerrados. |

## 2. Achados prioritários

### Alta — “Pronto” sem sensor e sem confirmação operacional (19/P0.2–P0.3)

Em `src/controle/main.ts:257`, a calibração termina por tempo e muda para `listening` mesmo com zero amostras. `src/controle/status-message.ts` combina isso apenas com `connected` para mostrar “Pronto”. Não exige confirmação da sala, presença do viewer ou amostras recentes. Durante o uso, tampouco existe heartbeat de saúde do sensor.

`PhoneViewerTransport.onUnpaired()` (`src/net/phone-viewer-transport.ts:35`) assina somente `peer-left`; a queda do próprio socket do viewer não chega por esse caminho. O coordenador pausa por esse evento, mas não implementa a revalidação operacional e o bloqueio de continuar previstos no plano.

### Alta — Retomada de sala ainda falha (19/P0.4)

`signaling/src/room-manager.js` identifica o controller pelo socket, sem credencial de retomada. Um novo socket antes da remoção do antigo recebe `room-full`. O viewer pode ser substituído, mas um `disconnect` tardio do viewer anterior limpa `room.viewer` mesmo depois da substituição.

Reprodução nesta revisão, com `RoomManager`, peers sintéticos e timers controlados: parear viewer/controller → tentar controller novo = `room-full`; substituir viewer → desconectar viewer antigo → enviar ação = nenhum evento entregue ao viewer novo. Isso reproduz a transição do gerenciador; não equivale ao teste de integração com Socket.IO real solicitado no plano.

### Alta — Sensor e comandos não têm o ciclo de vida previsto (19/P0.3–P0.5)

Cada `start()` acrescenta um listener anônimo de `devicemotion` (`src/controle/main.ts:276`) sem remover o anterior. Retry por erro de sala pode repetir essa instalação. `WakeLockKeeper` não tem estados públicos, tratamento de `release`, proteção contra aquisições concorrentes ou `dispose`.

`SignalingSocket.sendAction()` usa `emit` comum, sem guarda de prontidão, sequência, geração ou expiração (`src/net/signaling-socket.ts`). Portanto o contrato de descarte de comandos antigos não está implementado. Não foi realizado ensaio fim a fim de dez segundos offline nesta revisão.

### Alta — Voltar ao menu desconecta; atualização ignora pareamento (19/P1.2)

`src/scenes/menu-scene.ts:58` chama `phoneControl.stop()` ao entrar no menu. Isso contraria a continuidade sem novo QR pedida no plano 19. `src/ui/pwa-update.ts:50` aplica atualização pendente ao ocultar a página fora da cena `game`, sem consultar uma sessão de pareamento ativa. A tela de QR fica no menu e continua exposta a essa interrupção.

### Média — Texto ampliado exige mais exceções do que as documentadas (22/M02, M06, M07)

Com `--large-text` em 320×568 e 568×320, a ferramenta encontrou **33 alertas em 19 dos 68 casos**. São 19 alertas de rolagem vertical e 14 de controles inicialmente fora da viewport; não são 33 defeitos independentes.

A maioria corresponde ao fallback vertical já declarado na §12 do plano 22. Entretanto, em **568×320** também aparecem Caderno com muitas palavras (**30 px**), mundos (**21 px**), unidades (**2 px**) e lições (**3 px**), ausentes daquela lista de exceções. A captura do Caderno confirma que o cartão não aparece inteiro no estado inicial. `.screen-body` permite rolagem (`src/styles/mobile.css:45`), portanto isso não comprova perda definitiva de conteúdo; comprova que ainda se precisa rolar e que o registro de exceções está incompleto. É necessário conferir alcance após rolagem e decidir entre ajustar composição ou aceitar/documentar cada fallback.

### Média — A auditoria visual não cobre todo o aceite (22/§10)

`tools/ux-audit-page.js` monta telas isoladas com dados de exemplo e callbacks inertes. Não percorre o fluxo real de cada ação, todas as páginas, troca de perfil ou retorno de navegação. Remove o aviso de orientação e não mede os elementos desenhados dentro do Canvas. Não inclui o app controlador, estados reais de atualização nem uma matriz de presets durante gameplay.

Em `tools/ux-audit.mjs:203`, `--text-scale 2` remove **todos** os alertas `offscreen`, além de `scroll-y` e centralização. Isso não distingue fallback vertical alcançável de conteúdo fora da tela sem recuperação. Um resultado zero nesse modo não comprova “sem corte”. O teste usa tamanho de fonte da raiz; não substitui todos os modos de zoom/reflow do navegador.

O código atual tem **34 telas/estados**, enquanto o registro do plano 22 menciona 35. A diferença deve ser corrigida no registro de cobertura.

## 3. Conferência dos itens do plano 18

| Item | Evidência local |
| --- | --- |
| M1 | `celebration-canvas.ts`: IntersectionObserver, visibilidade da página, no máximo um RAF, cancelamento e quadro estático. |
| M2 | `motion-policy.ts` e integração em `main.ts`: preferência efetiva compartilhada por celebração, sprites e efeitos. |
| M3 | `navigation-context.ts`, `menu.ts`, `layout.tsx`: foco, scroll e âncora de página; testes de ida/volta. |
| M4 | `word-picture.tsx`: loading/ready/unavailable e no máximo uma nova tentativa por montagem após retorno da rede. |
| M5 | `touch-layout-store.ts`, `touch-controls.ts`, `settings-v2.tsx`: presets por dispositivo e aplicação adiada enquanto há botão mantido. |
| M6 | `practice-scene.ts`, `controls-practice.ts`: área segura, etapas semânticas, sair/repetir e armazenamento separado. |
| M7 | `TouchAdapter.onHeldChange` ligado a `TouchControls.setHeld` em `main.ts`; ações e apresentação seguem os mesmos ponteiros. |
| M8 | `support-info.ts`, `frame-stats.ts` e tela de suporte: coleta local, medição opcional e cópia/fallback. Não confundir com o diagnóstico persistente de conexão ainda pedido pelo plano 19. |

## 4. Verificações executadas

- `npm test`: **921 testes, 94 arquivos, todos passaram**. Avisos de mídia não implementada no jsdom reforçam que isso não é audição real.
- `npm --prefix signaling test`: **22 testes, 2 arquivos, todos passaram**.
- `npm run typecheck`: passou.
- `npm run build`: passou; aviso de chunk acima de 500 kB. Service worker: 71 entradas no precache.
- SHA-256 e tamanho dos WAV/textura conferidos contra `THIRD_PARTY_NOTICES.md`; licença distribuída idêntica à local.
- Auditoria Chrome headless normal: **34 estados × 13 viewports = 442 casos, zero alertas** nas verificações da ferramenta, com os limites de cobertura descritos acima.
- Auditoria com texto ampliado: 34 estados × 2 viewports = **68 casos, 33 alertas**, conforme classificação acima.
- Inspeção visual das capturas da home normal em 667×375 e Caderno ampliado em 568×320.

Comandos reproduzíveis, com Vite local em execução:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
npm run audit:ux -- --url http://127.0.0.1:5173 --out /tmp/aventura-audit-normal
npm run audit:ux -- --url http://127.0.0.1:5173 --large-text --viewports 320x568,568x320 --out /tmp/aventura-audit-large
```

Relatórios JSON e capturas desta sessão ficam nas duas pastas temporárias acima; não são fixtures versionadas. A auditoria usa perfil temporário e não altera saves reais. Não foram realizados testes físicos, VoiceOver/TalkBack, audição, offline de produção ou integração de rede com dois aparelhos.

## 5. Ordem recomendada para concluir

1. Implementar plano 19: saúde/pausa, sensor e Wake Lock, retomada e descarte de comandos; depois bolsinha e continuidade.
2. Concluir M20 e o aceite integrado de HUD/orientação do plano 22; ampliar o teste visual para navegação e estados reais, corrigir o filtro de `offscreen` e registrar todos os fallbacks.
3. Executar os roteiros de aparelho dos planos 17/18/21/22, especialmente zoom no iPhone, multitoque, safe areas, áudio e offline.
4. Tratar as expansões do plano 20 como backlog separado, sem confundir o primeiro recorte entregue com o plano inteiro concluído.

O critério de até três escolhas do mapa no plano 20 também precisa ser reconciliado com o plano 22: a navegação atual é home → mundo → unidade → lição, quatro ativações antes de jogar, além de eventuais mudanças de página. É uma alteração de UX documentada pelo plano posterior, não evidência de cumprimento do limite anterior.

## 6. Aplicação desta revisão (29/09/2026)

Seguiu a ordem da §5. O que foi possível fazer sem aparelho real está feito; o restante continua pendente e não foi declarado aceito.

### Item 1 — plano 19: implementado, não aceito

Todos os achados da §2 marcados como Alta foram corrigidos em código e cobertos por testes (detalhes em [19 §8](19-plano-estabilidade-controle-celular.md#8-implementação-29092026) e [12 §11](12-controle-por-celular.md#11-estabilidade-retomada-e-modo-bolsinha-plano-19-29092026)):

| Achado da §2 | Situação |
| --- | --- |
| "Pronto" sem sensor e sem confirmação (P0.2–P0.3) | Calibração com zero/poucas amostras falha; "Pronto" exige `joined`, jogo presente e amostra recente; sinal de vida a cada 1 s; o jogo pausa sem sinal por 3 s, com sensor parado, página oculta ou queda do próprio socket. |
| Retomada de sala (P0.4) | Token por papel; controle novo com token substitui o antigo sem `room-full`; `disconnect` tardio do viewer substituído não limpa o novo. A reprodução da §2 virou teste (`room-manager.test.js`) e há integração com socket.io real. |
| Ciclo de vida do sensor e comandos (P0.3–P0.5) | Um único `devicemotion`; `WakeLockKeeper` com estados, `release`, requisição única e `dispose`; comandos só com sala confirmada, purga do buffer na queda, `generation`/`seq` no jogo. Ensaio de 10 pulos durante queda: nenhum entregue após reconectar (teste de integração). |
| Menu desconecta; atualização ignora pareamento (P1.2) | Menu desarma sem desconectar; atualização adiada com sessão ativa. |

Duas descobertas durante a implementação, verificadas na versão instalada (socket.io 4.8.3): o emissor `volatile` descarta um pacote enquanto o anterior ainda é escrito (perderia pulos seguidos), por isso não foi usado; e o servidor descarta eventos que chegam junto com a desconexão, por isso `leave` espera ack antes de fechar o socket.

### Item 2 — auditoria visual: ampliada; M20 feito; exceções registradas

- Filtro de `offscreen` corrigido: alvo fora da tela é rolado até a vista e classificado como alcançável (nota) ou perdido (falha); o modo `--text-scale 2` não descarta mais alvos perdidos.
- Cobertura nova: 17 estados do app controlador (M20) e 30 passos de navegação real no jogo (Configurações completas com retornos, mundos, Caderno, pareamento, partida, pausa, saída). Canvas continua fora da medição.
- Resultado: matriz normal com 1041 casos e **0 problemas**; texto ampliado com 44 contêineres em fallback vertical e **0 alvos inalcançáveis**; texto a 200% com 2 casos, ambos exceção já registrada. Lista completa e decisão por tela em [22 §13](22-auditoria-ux-mobile-e-plano-de-implementacao.md#13-auditoria-ampliada-e-registro-de-exceções-29092026). A contagem de telas do plano 22 foi corrigida para 34.
- A página do controle tinha um defeito real encontrado pela auditoria: com o conteúdo mais alto que a tela, o topo ficava cortado e inalcançável. Corrigido.

### Itens 3 e 4 — não executáveis nesta sessão

- Roteiros de aparelho dos planos 17/18/19/21/22 (zoom no iPhone, multitoque, safe areas, áudio, offline, bolsinha, bloqueio de tela, rede de cada aparelho, VoiceOver/TalkBack): **não realizados**. Continuam necessários para aceitar os planos.
- Plano 20: expansões seguem como backlog separado; nada foi alterado. A divergência do limite de três escolhas do mapa (§5) continua sem decisão.

### Verificações desta aplicação

`npm test` (1022 testes, 100 arquivos), `npm --prefix signaling test` (39 testes, após `npm --prefix signaling ci`), `npm run typecheck` e `npm run build` passaram. Auditorias com `npm run dev` local, relatórios em pasta temporária (não versionados).

Ensaio ponta a ponta em Chrome headless (jogo e controle em abas separadas, servidor de sinalização real, `devicemotion` sintético; script descartável, não versionado): 19/19 verificações — pareamento com protocolo 2, "Pronto" só após sensor, partida sem pausa, modo bolsinha, pulo entregue com `seq`/`generation`, sensor parado pausando com motivo e "Continuar" travado, liberação ao voltar, menu sem desconectar, pareamento reaberto sem novo QR, recarga do celular retomando a sessão com diagnóstico preservado e "Desconectar celular" encerrando no celular. Não substitui aparelho real: não há sensor físico, bloqueio de tela nem rede móvel.

## 7. Revalidação do estado atual (29/09/2026)

Base: `c815ab3`, workspace inicialmente limpo. Revisão de implementação, contratos e testes; sem alteração funcional, de saves ou do vault. Esta seção substitui as conclusões de estado das §§1–6 quando houver divergência.

**Conclusão: não é correto declarar os seis planos integralmente implementados da forma prevista.** Há entregas funcionais extensas, escopos adiados e quatro lacunas reproduzíveis no plano 19. A aprovação automatizada não substitui os aceites físicos.

### Situação por plano

| Plano | Situação atual | O que impede o encerramento |
| --- | --- | --- |
| 17 | Parcial | Gestos por ponteiro, liberação de input, proporção do Canvas, safe areas e reorganização dos menus presentes. HUD informativo ainda em Canvas; opção manual de toque em híbridos ausente; contraste medido e roteiro do zoom no iPhone/Safari/PWA pendentes. |
| 18 | M1–M8 presentes; aceite pendente | Animação suspensa, política de movimento, contexto de navegação, fallback de imagens, presets, prática, feedback e suporte conferidos em código/testes. Faltam ergonomia, leitor de tela, desempenho e compreensão da prática em aparelho/crianças. |
| 19 | Implementação ampla, porém incompleta/incorreta em casos de retomada | Saúde operacional, diagnóstico, sensor único, Wake Lock, retomada, modo bolsinha e continuidade existem. Corrigir os quatro achados abaixo e executar as três sessões reais de 30 minutos antes de aceitar. |
| 20 | Primeiro recorte entregue | Mundos, palavras temáticas e dicas presentes; L2/L3 parciais. Monta-sílabas, terrenos novos, duração configurável, revisão de erros, outras modalidades, poderes e recompensas continuam propostos. O mapa de mundo com várias unidades exige quatro ativações desde a home, divergindo do limite original de três; fluxo definido pelo plano 22. |
| 21 | Recorte das §§9–10 entregue | WAV, catálogo/ganhos, dez palavras, segmentações, textura e fundos conferidos. Hashes locais coincidem com os créditos. Faltam audição, pronúncia, offline de produção e desempenho/aparência em aparelho. Lava/poderes e testes correspondentes dependem das expansões do plano 20. |
| 22 | Implementação ampla; aceite parcial | Configurações divididas, paginação, coach, ações, resultados, navegação e M20 presentes. Fallbacks de texto ampliado documentados; Canvas, presets durante gameplay, rotação física e leitores de tela não estão integralmente cobertos pela auditoria. |

### Achados atuais do plano 19

**Alta — saúde da conexão anterior é reaproveitada após substituição (P0.2/P0.3).** Em `src/net/phone-viewer-transport.ts`, `applySnapshot` atualiza a geração do filtro, mas `_setController(true)` retorna cedo se a presença já era verdadeira. Assim, `_lastHealth` da geração anterior permanece. `evaluatePhoneLink` não confere a geração desse sinal. Reprodução com o transporte real e socket simulado: snapshot da geração 1 → saúde `ok` da geração 1 → snapshot da geração 2 com controller presente, sem nova saúde → resultado `operational: true`. Na substituição autenticada de um socket ainda vivo, o jogo pode continuar ou permitir continuar usando o sensor anterior como evidência, até novo sinal/timeout. Invalidar saúde ao mudar geração e exigir sinal da geração vigente; cobrir substituição sem `peer-left` intermediário.

**Alta — token expira durante sessão ativa (P0.4).** `src/net/signaling-socket.ts:100–134` usa dez minutos desde `savedAt`; o timestamp só é atualizado quando um `joined` entrega token. Saúde e atividade não o renovam. Reprodução com relógio e sessionStorage controlados: escrever token em t=0 e ler em t=600001 ms retorna `null`, embora a sala possa continuar ativa no servidor. Se ocorrer reload/reconexão sobreposta ao socket anterior após esse período, a retomada perde a credencial e `RoomManager.join` retorna `room-full`. Isso compromete justamente as sessões de 30 minutos previstas no aceite. Alinhar validade local à sessão ativa/janela de recuperação e testar retomada após mais de dez minutos. Não foi necessário esperar dez minutos de relógio real para reproduzir a expiração.

**Média — join repetido não é idempotente (P0.2/P0.4).** `signaling/src/room-manager.js:148–156` incrementa a geração em todo join do controller, recria seus contadores e troca o token se a repetição não o inclui. Reprodução com `RoomManager`: mesmo socket/sala/payload duas vezes sem token → geração 1/token A e depois geração 2/token B. O teste existente chamado “is idempotent” verifica apenas `{ ok: true }`, sem comparar geração/credencial. Um retry por confirmação perdida pode invalidar mensagens ainda em trânsito; confirmar idempotência preservando identidade, geração e credencial do socket já associado.

**Média — não há expiração de comandos atrasados na mesma conexão (P0.5).** `src/net/action-filter.ts:30–36` verifica geração e ordem, mas não idade nem geração de armamento. `StampedAction` não carrega prazo/época de armamento; `RoomManager.action` apenas carimba a geração atual. A purga de `sendBuffer` resolve um caminho de reconexão, não atraso em trânsito sem troca de conexão. Um comando ainda não visto, de geração atual e sequência crescente, é aceito independentemente do tempo decorrido. Se chegar depois de retomar/entrar em outra partida, pode virar pulo antigo. Falta a política testável de expiração pedida no plano, sem presumir relógios sincronizados. Inspeção e reprodução do filtro confirmam a ausência; não foi feito ensaio de latência real entre aparelhos.

As reproduções acima executaram os módulos locais via `node --import ./tools/register-ts-hook.mjs --input-type=module`, com peers/socket, armazenamento e relógio controlados. Não comprovam frequência de ocorrência em produção. Não foram corrigidas nesta tarefa de validação.

### Verificações desta revalidação

- `npm test`: **1022 testes em 100 arquivos passaram**, incluindo integração com sockets locais; execução com permissão de rede local. A primeira tentativa no sandbox não foi usada como resultado de aprovação.
- `npm --prefix signaling test`: **39 testes em 2 arquivos passaram**.
- `npm run typecheck`: passou.
- `npm run build`: passou; **71 entradas no precache**, aviso de chunk acima de 500 kB.
- SHA-256 dos dois WAV e da textura: idênticos a `THIRD_PARTY_NOTICES.md`.
- Texto ampliado em 320×568 e 568×320: **160 estados, 42 alertas `scroll-y`, 27 notas `offscreen-reachable` e 2 notas `scroll-exception`**. Nenhum `offscreen` inalcançável reportado. São ocorrências por estado/contêiner, não 42 defeitos independentes. Captura do Caderno em 568×320 inspecionada: o cartão não cabe inteiro na vista inicial. Resultado reproduz a necessidade de fallback, com contagem ligeiramente diferente da execução histórica (44 alertas). Relatório e capturas: `/tmp/aventura-revalidation-large/`.
- Texto a 200% em 1280×720, 768×1024, 390×844 e 844×390: **320 estados, 2 problemas `covered`, 159 notas**. Reproduz os casos históricos do coach (`coach-step` e `coach-done`) em 390×844: “Pular introdução” e “Continuar” cobertos. Captura do segundo inspecionada. É montagem isolada em retrato; no fluxo real de toque a prática exige paisagem. Não foi classificado como falha nova de gameplay mobile, mas permanece limitação do layout. Relatório e capturas: `/tmp/aventura-revalidation-200/`.
- Matriz normal completa, 13 viewports e alvos `menus,controle,flow`: **1041 estados, 0 problemas, 13 notas `scroll-exception`** do relatório do controle após falha de cópia. Relatório e capturas: `/tmp/aventura-revalidation-normal/`.

Limites: auditoria em Chrome headless/Vite local, sem acesso a aparelhos físicos ou produção. Os testes de telas isoladas usam dados de exemplo, e o fluxo real cobre um subconjunto de estados. `elementFromPoint` no centro do alvo e medidas de overflow não comprovam, sozinhos, visibilidade integral de todo conteúdo/foco; tampouco medem texto desenhado no Canvas. Não houve nova validação de offline, audição, VoiceOver/TalkBack, zoom físico do iPhone ou rede móvel. As referências externas e sua procedência remota não foram reavaliadas; os hashes foram comparados ao registro local.

Prioridade: corrigir os casos de saúde/retomada/comandos do plano 19, concluir as pendências funcionais assumidas do plano 17 e executar os roteiros físicos. As expansões do plano 20 continuam backlog, sem confundi-las com o recorte já entregue.
