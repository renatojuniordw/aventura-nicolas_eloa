# 11 — Mobile, PWA e deploy

Este documento reúne três coisas que não cabiam nos outros: como o jogo funciona em
celular/tablet, como ele é instalado e roda offline como PWA, e como ele é publicado em
produção (Docker + Nginx). Para a arquitetura da abstração de input em si (por que o
toque não quebra a regra do teclado), ver
[03 — Abstração de input §8](03-abstracao-de-input.md#8-um-segundo-adaptador-já-em-produção-o-toque).

O roteiro de planejamento original (com o raciocínio passo a passo da adaptação) está em
[`MOBILE_PLAN.md`](../MOBILE_PLAN.md), na raiz do projeto — este documento aqui é a
referência do **estado atual**, já implementado.

---

## 1. Controles de toque

Em dispositivos com `matchMedia('(pointer: coarse)')` verdadeiro, três botões fixos
aparecem na tela: ◀, ▶ e pulo. Eles são desenhados por `src/ui/touch-controls.ts` e
traduzidos em ações semânticas pelo `TouchAdapter` (`src/input/touch-adapter.ts`), que
implementa o mesmo contrato `InputAdapter` do teclado.

- Usa **Pointer Events**, não Touch Events — os mesmos botões respondem a dedo, mouse ou
  caneta.
- `pointerleave`/`pointercancel` soltam o botão, então arrastar o dedo para fora nunca
  deixa uma ação "presa".
- Teclado e toque ficam **ativos ao mesmo tempo** via `CompositeAdapter`
  (`src/input/composite-adapter.ts`) — útil num notebook conversível com tela de toque.
- A detecção de toque só decide se os botões **aparecem**; a lógica de jogo nunca sabe de
  onde veio a ação, e o `TouchAdapter` continua registrado mesmo em desktop.

O jogo é **paisagem apenas**: em telas de toque no modo retrato, um aviso ("Gire o
celular para jogar") cobre a tela — ver `.orientation-warning` em `index.html` e
`src/styles/touch-controls.css`. Isso casa com `orientation: 'landscape'` no manifest do
PWA (seção 2) e com o viewport fixo de 16:9 do jogo (`VIEWPORT` em `core/config.ts`).

O layout escala com `clamp()`/unidades de viewport para caber em telas de qualquer
tamanho sem cortar a área de jogo (`src/styles/main.css`).

---

## 2. PWA (instalável, offline)

Configurado em `vite.config.js` via `vite-plugin-pwa`:

```js
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Aventura do Nicolas&Eloá',
    short_name: 'Nicolas&Eloá',
    lang: 'pt-BR',
    display: 'standalone',
    orientation: 'landscape',
    icons: [ /* 192x192 e 512x512, maskable */ ],
  },
  workbox: { /* ver estratégia de cache abaixo */ },
})
```

- **Instalável**: "Adicionar à tela inicial" no Android/desktop; no iOS, que ignora o
  manifest para isso, `index.html` traz as duas tags que cobrem o caso
  (`apple-mobile-web-app-capable`, `apple-touch-icon`).
- **Ícones**: gerados por `tools/generate-pwa-icons.mjs` — um script sem dependência de
  biblioteca de imagem (mesma filosofia do `generate-levels`), que desenha um "A" em
  pixel art sobre o dourado do tema e grava PNGs manualmente. Rodar de novo com
  `npm run generate:pwa-icons`.

### Estratégia de cache offline (Workbox)

O jogo tem dois tipos de asset com necessidades bem diferentes:

| O quê | Tamanho | Estratégia |
|---|---|---|
| App shell: JS, CSS, HTML, as ~152 fases (inlined no bundle pelo `level-registry.ts`) | pequeno | **Precache** no install — `globPatterns: ['**/*.{js,css,html,svg,png,woff2}']` |
| Arte de produção (`public/assets/`: personagens, cenários, itens) | ~22 MB | **CacheFirst sob demanda** — só baixa quando uma fase realmente usa aquele arquivo |

```js
globIgnores: ['assets/backgrounds/**', 'assets/characters/**', /* ... */],
runtimeCaching: [{
  urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
  handler: 'CacheFirst',
  options: { cacheName: 'game-assets', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 } },
}],
```

Resultado prático: o **primeiro install é leve** (não força os 22 MB de arte), e depois
de **uma sessão normal de jogo**, o suficiente da arte usada já está em cache — o jogo
fica jogável offline sem downloads pesados forçados.

> Isso não muda a política de privacidade: o cache do service worker é local ao
> navegador, não é um servidor adicional nem envia nada para fora — ver
> [10 — Privacidade e LGPD](10-privacidade-e-lgpd.md).

---

## 3. Build e deploy em produção

`npm run build` gera `dist/` (app + service worker do PWA). Em produção isso roda dentro
de um contêiner Docker servido por Nginx.

### Dockerfile (multi-stage)

```
Stage 1 (build):    node:22-alpine        → npm ci && npm run build
Stage 2 (runtime):  nginxinc/nginx-unprivileged:1.27-alpine
                     → só copia dist/ + docker/nginx.conf
                     → roda como usuário não-root "nginx", porta 8080
                     → HEALTHCHECK via wget
```

Só o `dist/` estático vai para a imagem final — nada de `node_modules`, código-fonte ou
ferramentas de build sobrevive ao segundo estágio.

### Nginx do contêiner (`docker/nginx.conf`)

- Cabeçalhos de segurança: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy` (bloqueia geolocalização, câmera, microfone) e
  uma **Content-Security-Policy** estrita (`default-src 'self'; script-src 'self'; ...
  object-src 'none'; frame-ancestors 'none'`).
- `server_tokens off` (esconde a versão do Nginx), gzip para texto/JS/CSS/SVG.
- Cache agressivo e imutável (30 dias) para assets com hash; fallback de SPA
  (`try_files ... /index.html`) para as demais rotas.
- Nega qualquer arquivo que comece com `.` (dotfiles).

### `docker-compose.yml` — hardening do contêiner

| Medida | Efeito |
|---|---|
| `"127.0.0.1:65000:8080"` | Só acessível pela própria máquina — o Nginx da VPS é quem fica público |
| `user: nginx` | Roda sem root |
| `cap_drop: ALL` + `no-new-privileges:true` | Remove capacidades Linux desnecessárias |
| `read_only: true` + `tmpfs` (`/var/cache/nginx`, `/var/run`, `/tmp`) | Sistema de arquivos raiz imutável |
| Limites de CPU/memória/PIDs (`0.5 CPU`, `128M`, `100 pids`) | Contém um processo descontrolado |
| `healthcheck` | Reinicia o contêiner se o Nginx parar de responder |

### Nginx da VPS — proxy reverso (`docker/nginx-vps.conf`)

Fora do Docker, um Nginx na própria VPS recebe o tráfego público e repassa para o
contêiner em `127.0.0.1:65000`:

- **Rate limiting**: `limit_req_zone ... rate=10r/s` com `burst=20`.
- Encaminha `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` para o contêiner.
- Nega dotfiles; limita upload a `1m` (o jogo não recebe upload de usuário).
- **HTTPS não vem configurado no repositório** — o comentário no próprio arquivo documenta
  o passo: `sudo certbot --nginx -d game.unificando.com.br`, que reescreve o arquivo para
  redirecionar HTTP→HTTPS automaticamente. Isso é um item em aberto, não um bug: é uma
  decisão de deploy tomada no servidor, fora do controle de versão.

Arquitetura de produção, resumida:

```
navegador → Nginx da VPS (TLS quando configurado, rate limit)
          → 127.0.0.1:65000 → contêiner Docker "jogo" → Nginx do contêiner (headers, cache, SPA)
          → arquivos estáticos de dist/ (index.html + controle.html)

celular   → Nginx da VPS, mesmo domínio/porta 443, location /socket.io/
          → 127.0.0.1:65001 → contêiner Docker "signaling" (Node + socket.io)
```

### `signaling` — servidor de sinalização (docs/12-controle-por-celular.md)

Segundo serviço no `docker-compose.yml`, contêiner separado do jogo (não compartilha
processo nem memória): repassa o evento `jump` entre o celular e a TV, sem tocar em
gameplay, sem persistência e sem banco de dados (ver `signaling/src/room-manager.js`).

| Medida | Efeito |
|---|---|
| `"127.0.0.1:65001:3001"` | Mesmo padrão do contêiner `jogo`: só a Nginx da VPS o alcança |
| `user: node` + `cap_drop: ALL` + `read_only: true` | Mesmo hardening do contêiner `jogo` |
| Limites menores (`0.25 CPU`, `96M`) | Só encaminha mensagens JSON pequenas, precisa de bem menos |
| `location /socket.io/` no Nginx da VPS | Mesmo domínio/porta 443 do jogo — nenhuma porta nova exposta |
| `limit_req_zone ... rate=20r/s` dedicado | Rate limit próprio, mais apertado que o do jogo (§2.1 do doc 10) |

### Comandos

O jeito recomendado de publicar é `./deploy.sh` (raiz do projeto): ele builda com
`--no-cache`, sobe os dois serviços com `--force-recreate` e marca a imagem com a tag do
commit atual (`IMAGE_TAG`, lida por `docker-compose.yml` como
`image: joguinho-sobrinhos:${IMAGE_TAG:-latest}`). Isso existe porque, sem uma tag amarrada
ao commit, um `docker compose up -d` esquecido de `--build` reaproveita silenciosamente a
imagem `:latest` já existente em disco — mesmo depois de `git pull` com commits novos — e o
site fica servindo o bundle antigo (foi exatamente o que causou o menu de configurações e a
rota `/controle` não aparecerem depois de um deploy).

```bash
./deploy.sh                      # build --no-cache + up --force-recreate, tag = commit atual
docker compose logs -f jogo      # acompanha os logs do jogo
docker compose logs -f signaling # acompanha os logs do servidor de sinalização
docker compose down              # derruba os dois serviços
```

Se preferir rodar manualmente (sem o script), force sempre rebuild e recriação:

```bash
docker compose build --no-cache
docker compose up -d --force-recreate --remove-orphans
```

---

## 4. Checklist ao mexer nesta área

- [ ] Mudou os controles de toque? Atualize `docs/02` (tabela de controles) e
      `docs/03` (seção do `TouchAdapter`).
- [ ] Mudou o manifest ou a estratégia de cache do PWA? Rode `npm run build` e teste a
      instalação/offline manualmente — não há teste automático para isso.
- [ ] Mudou o `Dockerfile`, `docker-compose.yml` ou `docker/*.conf`? Rode
      `docker compose up --build` localmente antes de publicar, e revise os cabeçalhos de
      segurança com `curl -I`.
- [ ] Adicionou uma rota de rede nova (analytics, API)? Atualize a CSP em
      `docker/nginx.conf` **e** [10 — Privacidade e LGPD](10-privacidade-e-lgpd.md) — a
      regra de ouro do projeto é não enviar nada para fora sem documentar antes.
