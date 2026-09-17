# Controle por Celular — Plano de Implementação

*Atualizado em 17/09/2026*

Plano para adicionar um controle remoto via celular (detecção de pulo por acelerômetro) ao jogo [aventura-nicolas\_eloa](https://github.com/renatojuniordw/aventura-nicolas_eloa), reaproveitando a abstração `InputAdapter` já existente no projeto. Este documento é a referência para a implementação — cada seção descreve o que construir, onde e por quê.

## 1. Visão geral

O jogo já segue o princípio Aberto/Fechado na camada de entrada: qualquer fonte nova implementa o contrato `InputAdapter` (`attach`, `detach`, `dispose`, `onAction`) e emite ações semânticas (`Actions.JUMP`, etc.) — sem tocar em `gameplay/`, `physics/` ou `scenes/`. Isso já vale para teclado e toque, documentado em `docs/03-abstracao-de-input.md`.

O que este plano adiciona é uma terceira fonte de entrada: um celular Android preso ao corpo da criança, que detecta o gesto físico de pulo via acelerômetro (`DeviceMotionEvent`) e envia esse evento para o navegador que roda o jogo na TV.

Diferença-chave em relação ao ESP32 já previsto no doc 03: lá o transporte é Web Serial/BLE (conexão direta hardware-navegador). Aqui celular e TV estão fisicamente separados na mesma rede, então o transporte precisa ser WebSocket via um servidor de sinalização próprio, hospedado na mesma VPS que já serve o jogo.

Peças novas a construir:

1. Servidor de sinalização (Node + WebSocket) — repassa mensagens entre celular e jogo.
2. `PhoneAdapter` — novo adaptador no jogo, mesmo contrato `InputAdapter`.
3. Página do celular — nova rota que lê o sensor e detecta o pulo.
4. Fluxo de pareamento por QR code.

Peças que não mudam: `player-controller.ts`, `physics-engine.ts`, `game-scene.ts`, `level-manager.ts`, `render/*` — a mesma garantia que a seção 7.4 do doc 03 já faz para o ESP32 vale aqui.

## 2. Protocolo de mensagens

Três participantes trocam mensagens JSON curtas por WebSocket: **celular** (envia), **servidor de sinalização** (repassa), **jogo na TV** (recebe).

**Celular → servidor**, ao entrar na sala:

```json
{ "type": "join", "role": "controller", "session": "AB12CD" }
```

**Jogo (TV) → servidor**, ao entrar na sala:

```json
{ "type": "join", "role": "viewer", "session": "AB12CD" }
```

**Celular → servidor → jogo**, ao detectar o pulo (evento discreto, sem stream de sensor cru):

```json
{ "type": "action", "button": "jump", "pressed": true }
```

O servidor só repassa mensagens `action` de um `controller` para todos os `viewer` da mesma `session` — não interpreta, não guarda estado de jogo, não sabe o que é "pulo". Isso mantém a mesma separação de responsabilidade que o `InputAdapter` já exige: hardware/transporte nunca decide regra de jogo.

Nenhum dado contínuo de acelerômetro trafega pela rede — só o evento discreto `jump`. Isso reduz tráfego e a superfície de latência, e evita expor o padrão de movimento bruto da criança fora do celular dela.

## 3. Servidor de sinalização

Serviço novo, separado do jogo, rodando ao lado dele na mesma VPS.

**Stack sugerida:** Node.js + `socket.io` (não WebSocket nativo). Motivo: `socket.io` reconecta sozinho quando o celular perde WiFi, vai para background ou a tela apaga — comportamento normal em Android e que WebSocket puro exigiria reimplementar na mão.

**Responsabilidade única:** gerenciar salas (`session`) e repassar mensagens `action` de `controller` para `viewer` na mesma sala. Não guarda histórico, não processa gameplay, não toca banco de dados.

**Estrutura mínima:**

```js
io.on('connection', (socket) => {
  socket.on('join', ({ role, session }) => {
    socket.join(session);
    socket.data.role = role;
  });

  socket.on('action', (payload) => {
    if (socket.data.role !== 'controller') return; // só controller emite ação
    socket.to(socket.data.session).emit('action', payload);
  });
});
```

**Ciclo de vida da sala:** criada quando o jogo (viewer) entra com um `session` novo; expira sozinha após alguns minutos sem nenhum `controller` conectado, ou quando o `viewer` desconecta (fim da partida). Sem persistência — tudo em memória do processo Node.

## 4. `PhoneAdapter` (novo arquivo em `src/input/`)

Mesmo contrato que `KeyboardAdapter` e `TouchAdapter` já seguem — só traduz, nunca decide regra de jogo:

```ts
// src/input/phone-adapter.ts
import { InputAdapter } from './input-adapter.js';
import { Actions } from './actions.js';

const BUTTON_TO_ACTION = {
  jump: Actions.JUMP,
};

export class PhoneAdapter extends InputAdapter {
  constructor(onAction, { transport }) {
    super(onAction);
    this._transport = transport; // wrapper fino sobre o socket.io-client
  }

  attach() {
    this._transport.onMessage(({ button, pressed }) => this._handle({ button, pressed }));
    this._transport.connect();
  }

  detach() {
    this._transport.disconnect();
  }

  _handle({ button, pressed }) {
    const action = BUTTON_TO_ACTION[button];
    if (!action) return;
    this.onAction(action, { pressed, repeated: false });
  }
}
```

**Montagem em `src/main.ts`**, junto dos adaptadores existentes via `CompositeAdapter` (permite manter teclado ativo para debug, como o projeto já faz com teclado+toque):

```js
input.setAdapter(
  new CompositeAdapter(input.handleAction, [
    new KeyboardAdapter(input.handleAction),
    new TouchAdapter(input.handleAction, { buttons: touchControls.buttons }),
    new PhoneAdapter(input.handleAction, { transport: phoneTransport }),
  ]),
);
```

**Nada muda** em `player-controller.ts`, `physics-engine.ts`, `game-scene.ts` ou nos testes de gameplay — eles continuam usando `FakeAdapter`, exatamente como a seção 7.4 do doc 03 garante. O teste de arquitetura (`architecture.test.js`) deve ser estendido para confirmar que `phone-adapter.ts` também não importa de `gameplay/`, `physics/`, `scenes/` ou `render/`.

## 5. Página do celular

Nova rota leve (ex.: `/controle`), separada do bundle principal do jogo. Fluxo:

1. Lê `session` da URL (`?session=AB12CD`, vinda do QR code).
2. Pede permissão explícita de sensor com um toque do usuário — obrigatório em iOS 13+ e recomendado em Android também:

```js
if (typeof DeviceMotionEvent.requestPermission === 'function') {
  await DeviceMotionEvent.requestPermission();
}
```

3. Conecta ao servidor de sinalização com `{ type: 'join', role: 'controller', session }`.
4. Roda **calibração silenciosa** de 1-2s após o "start": lê o nível de repouso do acelerômetro naquela criança específica (posição exata em que o celular ficou preso), ajustando os thresholds em vez de usar valor fixo universal.
5. Escuta `devicemotion` e aplica a lógica de detecção de pulo (queda livre + pico):

```js
let state = 'idle';
let freefallStart = 0;
let lastJumpAt = 0;
const COOLDOWN_MS = 500; // evita pulo duplo por vibração residual do impacto

function onMotion({ accelerationIncludingGravity: a }) {
  const magnitude = Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2) / 9.81; // em g

  if (state === 'idle' && magnitude < FREEFALL_THRESHOLD) {
    state = 'freefall';
    freefallStart = Date.now();
  } else if (state === 'freefall' && magnitude > IMPACT_THRESHOLD) {
    const now = Date.now();
    if (now - freefallStart > MIN_FREEFALL_MS && now - lastJumpAt > COOLDOWN_MS) {
      socket.emit('action', { button: 'jump', pressed: true });
      lastJumpAt = now;
    }
    state = 'idle';
  } else if (state === 'freefall' && Date.now() - freefallStart > MAX_FREEFALL_MS) {
    state = 'idle'; // não foi pulo de verdade, aborta
  }
}
```

Usa a **magnitude do vetor** (não só eixo Z), porque não importa a orientação exata em que o celular ficou preso no corpo da criança.

**Requisito de infraestrutura:** `DeviceMotionEvent` só funciona em HTTPS. A VPS já tem TLS via certbot, então isso já está coberto — só confirmar que a rota `/controle` fica atrás do mesmo domínio com certificado válido.

**Compatibilidade Android vs iOS:** a API funciona nos dois, mas o pedido de permissão (`DeviceMotionEvent.requestPermission`) só existe no iOS/Safari (desde iOS 13) e precisa ser disparado **dentro de um gesto direto do usuário** — não pode acontecer sozinho ao carregar a página. Por isso a tela `/controle` precisa de um botão explícito tipo "Toque para começar" antes de qualquer leitura de sensor: no Android esse toque é redundante mas inofensivo, no iOS é obrigatório. Se a permissão for negada, o iOS geralmente exige recarregar a página para pedir de novo — não há retry programático. No iOS, qualquer navegador (Chrome, Firefox) roda sobre o motor WebKit do Safari, então o comportamento do sensor é idêntico entre eles ali.

## 6. Pareamento e segurança da sessão

**Fluxo de pareamento:**

1. Tela de start do jogo (TV) gera um `session` aleatório (ex.: 6 caracteres alfanuméricos, gerado com `crypto.randomUUID()` truncado ou biblioteca equivalente) e conecta como `viewer`.
2. A TV mostra um QR code apontando para `https://<dominio>/controle?session=<session>`.
3. A criança (ou responsável) escaneia com a câmera do Android, que abre o navegador direto na página do celular; ela conecta como `controller` na mesma sala.
4. Nenhuma digitação de IP ou código manual.

**Pontos de segurança que precisam ser resolvidos antes de ir a produção — não são opcionais:**

- `session` precisa ser suficientemente aleatório para não ser adivinhado por outra pessoa na mesma rede (ex.: WiFi de prédio/condomínio compartilhado). Um `session` curto demais (tipo 4 dígitos numéricos) é vulnerável a força bruta.
- Sala expira automaticamente após alguns minutos sem pareamento, e some quando a partida termina — senão um `session` antigo fica "aberto" indefinidamente.
- Servidor só aceita **um** `controller` por sala (rejeita uma segunda conexão com role `controller` na mesma sala já ocupada), para impedir que outro celular na mesma rede entre sem querer/de propósito na sessão de outra criança.
- Rate limiting no evento `action` por socket (ex.: máximo N mensagens/segundo) — defesa adicional independente do cooldown do lado do celular, caso o cliente seja modificado ou o evento seja disparado por outro meio.

## 7. Deploy na VPS

< projeto já empacota o jogo num contêiner Nginx não-root (`Dockerfile` + `docker-compose.yml`, `docker/nginx-vps.conf` fazendo proxy reverso com TLS via certbot). O servidor de sinalização entra como **um contêiner adicional**, não dentro do mesmo processo do jogo.

**No `docker-compose.yml`:** novo serviço (ex.: `signaling`), com `restart: unless-stopped` — mesma recoção de resiliência que os outros serviços do compose já seguem. Expor só na rede interna do compose, nunca direto na internet.

**No `docker/nginx-vps.conf`:** nova rota de proxy reverso para o WebSocket, algo como:

```nginx
location /socket.io/ {
  proxy_pass http://signaling:3001;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

Assim o `socket.io-client` do celular e do jogo conectam no mesmo domínio/porta 443 que já tem certificado válido — sem abrir porta nova exposta.

**Checklist de infra:**

- [ ] Novo `Dockerfile` (ou imagem oficial `node:XX-alpine`) para o serviço de sinalização
- [ ] Entrada no `docker-compose.yml` com `restart: unless-stopped`
- [ ] Rota de proxy no Nginx para `/socket.io/` (ou path escolhido)
- [ ] Confirmar que o certificado TLS existente cobre o path usado pelo WebSocket
- [ ] Rate limiting no Nginx para essa rota (mesma prática já usada nas demais)

## 8. Checklist de implementação (ordem sugerida)

- [ ] **Servidor de sinalização** — novo pacote Node (`socket.io`), lógica de `join`/`action` por sala (seção 3), com testes unitários de roteamento de sala isolados de HTTP real
- [ ] **Regras de segurança da sala** — geração de `session` aleatório, expiração, limite de um `controller` por sala, rate limiting (seção 6)
- [ ] **`PhoneAdapter`** em `src/input/phone-adapter.ts`, seguindo o contrato `InputAdapter` (seção 4)
- [ ] **Testes do `PhoneAdapter`** com transporte falso, no mesmo padrão de `touch-adapter.test.js`/`composite-adapter.test.js` — sem simular socket real
- [ ] **Estender `architecture.test.js`** para cobrir `phone-adapter.ts` nas mesmas regras que já valem para os outros adaptadores
- [ ] **Página `/controle`** — permissão de sensor, calibração, detecção de pulo, emissão do evento `jump` (seção 5)
- [ ] **Geração de QR code** na tela de start do jogo, apontando para `/controle?session=...` (seção 6)
- [ ] **Montagem do `CompositeAdapter`** em `main.ts` incluindo o `PhoneAdapter` (seção 4)
- [ ] **Infra**: contêiner novo no `docker-compose.yml`, rota no Nginx, validação de TLS (seção 7)
- [ ] **Teste de ponta a ponta manual**: celular real, TV/monitor real, mesma rede WiFi doméstica — medir latência percebida antes de fechar os thresholds de tolerância no gameplay
- [ ] **Documentação**: novo `docs/12-controle-por-celular.md` seguindo o mesmo padrão dos docs existentes, seguido de atualização da tabela "Como jogar" no `README.md`

Cada item corresponde a uma seção acima — nenhum deles exige mudar `player-controller.ts`, `physics-engine.ts` ou os testes de gameplay já existentes.

## 9. Movimento automático (auto-run) quando o celular está ativo

Com o modo celular ligado, o personagem deve andar sozinho para a direita — o único gesto da criança é o pulo. A solução mais consistente com a arquitetura já existente é tratar o auto-run como **mais um adaptador**, não como uma regra especial em `player-controller.ts` ou `game-scene.ts`: ele só emite uma ação semântica contínua, sem nenhum hardware por trás.

```ts
// src/input/auto-run-adapter.ts
import { InputAdapter } from './input-adapter.js';
import { Actions } from './actions.js';

/** Gera MOVE_RIGHT continuamente, sem hardware — usado no modo celular. */
export class AutoRunAdapter extends InputAdapter {
  attach() {
    this.onAction(Actions.MOVE_RIGHT, { pressed: true, repeated: false });
  }

  detach() {
    this.onAction(Actions.MOVE_RIGHT, { pressed: false, repeated: false });
  }
}
```

**Montagem no modo celular** (`main.ts`, quando a sessão é iniciada via QR code):

```js
input.setAdapter(
  new CompositeAdapter(input.handleAction, [
    new AutoRunAdapter(input.handleAction),
    new PhoneAdapter(input.handleAction, { transport: phoneTransport }),
  ]),
);
```

**Ponto crítico que precisa ser verificado antes de confiar nisso:** isso só funciona sem sobressalto se `InputManager` trata o estado "segurado" (`isActionHeld`) de forma independente por ação, e não houver outro adaptador também emitindo `MOVE_LEFT`/`MOVE_RIGHT` ao mesmo tempo. Se `KeyboardAdapter` ou `TouchAdapter` continuarem ativos junto (ex.: para debug), um `keyup` de seta solto sem querer pode zerar o held state que o `AutoRunAdapter` mantém — dependendo de como o estado é armazenado internamente (um booleano por ação, compartilhado entre fontes, versus por origem). **Recomendação:** no modo celular de produção, não inclua `KeyboardAdapter`/`TouchAdapter` emitindo `MOVE_LEFT`/`MOVE_RIGHT` no mesmo `CompositeAdapter` — isso também resolve a pergunta deixada em comentário na seção 4 sobre manter o teclado ativo: mantenha-o, se quiser, só para `JUMP` de debug, nunca para movimento lateral quando o auto-run estiver no comando.

Esse item entra no checklist da seção 8, junto da montagem do `PhoneAdapter`.

## 10. Melhorias adicionais

### Críticas — antes da primeira versão jogável

**Detecção de desconexão do celular durante a partida.** Com auto-run ligado, se o socket do `controller` cair (WiFi, app em background, tela apagada), o personagem continua correndo sozinho sem ninguém pra pular e bate no primeiro obstáculo. O jogo precisa **pausar automaticamente** ao detectar desconexão do `controller` na sala, mostrando algo tipo "celular desconectado, reconectando..." em vez de deixar rodando.

**Screen Wake Lock no celular.** A tela do Android apaga por economia de energia, o que mata o listener de `devicemotion` em vários navegadores. Sem a Screen Wake Lock API (`navigator.wakeLock.request('screen')`) na página `/controle`, o controle para de funcionar no meio da partida sem aviso.

**Feedback tátil no celular ao detectar o pulo.** `navigator.vibrate(50)` curto ao disparar o evento `jump` dá confirmação imediata de que o gesto foi captado, sem depender só do que acontece na TV.

**Thresholds ajustáveis sem rebuild.** `FREEFALL_THRESHOLD`, `IMPACT_THRESHOLD`, `MIN_FREEFALL_MS`, `COOLDOWN_MS` (seção 5) vão precisar de ajuste fino após testar com uma criança real. Um painel simples (mesmo que só visível via `?debug=1`) pra mexer neles em tempo real evita um ciclo lento de mudar código → build → testar → repetir.

### Relevantes — segunda iteração

**Testabilidade do algoritmo de detecção sem hardware.** Seguindo o padrão já usado com `FakeAdapter`: extrair a lógica de queda-livre-mais-pico como função pura, que recebe uma série de leituras (fixture gravada de um pulo real) e retorna se detectou ou não — testável sem `devicemotion` de verdade.

**Indicador de qualidade da conexão na TV.** Mostrar não só "conectado", mas um indicador simples de latência/sinal antes de começar a partida, pra diagnosticar WiFi ruim antes de a criança já estar jogando.

**Timeout no fluxo de pareamento.** Se a criança nunca escanear o QR (câmera não abre, permissão de sensor negada), a tela de start não pode ficar travada esperando — precisa de um caminho de saída de volta pro controle padrão (teclado/toque).

**Atualizar o doc 10 de privacidade/LGPD.** Adicionar uma linha explicando que o novo fluxo transmite um evento efêmero (`jump`) entre celular e TV via servidor próprio, sem persistência — mantém a transparéncia que esse doc já promete sobre o que trafega.
