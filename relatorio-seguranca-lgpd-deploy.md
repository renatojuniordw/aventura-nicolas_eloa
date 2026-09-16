# Relatório de Auditoria — Segurança, LGPD e Deploy

**Projeto:** Aventura do Nicolas&Eloá (`/Users/renatobezerra/Developer/Joguinho Sobrinhos`)
**Data:** 2026-09-16 · **HEAD:** `c628f02` · **Modo:** estritamente read-only (nenhum arquivo alterado além deste relatório)
**Prompt oficial:** `@unificando/prompts` id `auditoria-seguranca` — PROMPT 1 (seções 1–4) + PROMPT 2 (seções 5–9)

## Resumo Executivo

- **Itens avaliados:** 34 (PROMPT 1) + 5 módulos (PROMPT 2) · **Aplicáveis:** 22 · **Não aplicáveis:** 9 · **Não verificáveis no repositório:** 8
- **Distribuição por severidade (achados únicos, sem dupla contagem de referências cruzadas):** Crítico **0** · Alto **4** · Médio **5** · Baixo **3**
- **Conclusão em uma frase:** app estático sem backend, sem autenticação e sem exfiltração de dados — superfície de ataque mínima e nenhum segredo vazado — mas **inapto para publicar como produto infantil** até resolver os 4 Altos: CSP do nginx quebra o Google Fonts declarado no HTML, ausência de consentimento parental e de política de privacidade para dados de menores, e TLS/HSTS indefinido no ambiente de deploy.

## ETAPA 0 — Auto-detecção de contexto (somente leitura)

| Item | Detecção | Evidência |
|---|---|---|
| Front-end | JS puro (ES modules) + Vite 8, Canvas 2D + overlays DOM, sem framework | `package.json:1-18`, `index.html:34` |
| Back-end | **Inexistente** — bundle estático, zero `fetch`/`WebSocket`/`XMLHttpRequest` no `src/` | Grep `fetch\|XMLHttpRequest\|WebSocket` em `src/` → sem matches |
| Auth/sessão | **Inexistente** — sem login, token ou cookie | Sem matches para `password\|Bearer \|cookie` em `src/` (só falsos positivos em `server_tokens`/`tokenX`) |
| Deploy/infra | `Dockerfile` multi-stage (Node 22 → `nginxinc/nginx-unprivileged:1.27-alpine`), `docker-compose.yml`, `docker/nginx.conf` | `Dockerfile:1-31`, `docker-compose.yml:1-47`, `docker/nginx.conf:1-40` |
| Dados pessoais | **Sim — de menores**: nome da criança + progresso + personagem em `localStorage` | `src/persistence/profile-store.js:27-42`, `src/scenes/menu-scene.js:28` |
| Terceiros em runtime | Google Fonts via CDN (`fonts.googleapis.com`, `fonts.gstatic.com`) | `index.html:11-16` |
| CI/CD | Ausente (sem `.github/`, sem outro provedor) | `ls .github` → inexistente; `git ls-files` sem configs de CI |
| Segredos esperados | Nenhum (sem backend/API) | `git ls-files` sem `.env`; `.gitignore` cobre `node_modules/`, `dist/` |

## ETAPA 0.5 — Gate de aplicabilidade

| Item | Aplicável? | Justificativa breve |
|---|---|---|
| CSP / headers de segurança | Sim | nginx serve o app; headers definidos em `docker/nginx.conf:9-13` |
| XSS / sanitização de output | Sim | Overlays DOM renderizam nome do perfil digitável |
| Armazenamento local de dados | Sim | Nome de criança em `localStorage` |
| Dependências (supply chain) | Sim | 100 pacotes no lockfile; imagem base nginx/node |
| Segredos hardcoded / `.env` | Sim (verificação) | Deve ser provado ausente, não presumido |
| Google Fonts (privacidade/offline) | Sim | CDN de terceiro em `index.html:11-16` |
| LGPD — consentimento parental, política, eliminação, retenção, segurança | Sim | Dado pessoal de menor, ainda que só local |
| LGPD — encarregado (DPO), registro de operações, relatório de impacto | Não | Projeto familiar sem tratamento em escala ou operação comercial |
| Back-end: SQLi, RLS, auth server-side, CORS, rate limiting em API | Não | Sem backend, banco ou API |
| Cookies / banner de cookies | Não | App não usa cookies nem rastreamento |
| TLS/HSTS efetivo, WAF/CDN/DDoS, backup, monitoramento | Incerto → Não verificável | Dependem do ambiente de hospedagem, fora do repositório |
| CI / scan de imagem | Sim | Ausência é verificável no repositório |
| Bomba de custo (IA, e-mail/SMS, queries) | Não | Sem endpoint pago ou com custo por chamada |
| Uploads de arquivo | Não | Sem input de arquivo em `src/` |

---

## 1. Segurança Front-End

### F1 — Content-Security-Policy do nginx bloqueia o Google Fonts declarado no HTML
- Aplicável: Sim — CSP definida em `docker/nginx.conf:13`, fontes carregadas em `index.html:11-16`
- Status: Não conforme · Severidade: **Alto**
- Evidência: `docker/nginx.conf:13` (`style-src 'self' 'unsafe-inline'` sem `fonts.googleapis.com`; sem diretiva `font-src`, logo `default-src 'self'` bloqueia `fonts.gstatic.com`) vs `index.html:14`
- Problema: com a CSP atual o navegador bloqueia o CSS e os woff2 do Google Fonts; o jogo cai para fontes de fallback e gera erros de CSP no console. É quebra funcional em produção, não só endurecimento.
- Sugestão de correção: ou remover a dependência de CDN (auto-hospedar o woff2 de Silkscreen em `public/assets/fonts/` e declarar `@font-face` local — elimina também o achado F2), ou estender a CSP com `style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;`.

### F2 — Google Fonts envia IP do visitante para terceiro e quebra offline
- Aplicável: Sim — CDN de terceiro sem necessidade funcional estrita
- Status: Parcialmente conforme · Severidade: **Médio**
- Evidência: `index.html:11-16`; fallback local existe em `src/styles/main.css:17` (`"Trebuchet MS", monospace`)
- Problema: cada carregamento transmite IP (dado pessoal) ao Google, inclusive de crianças, sem informação ao responsável (ponte com LGPD art. 33); em rede sem internet ou com o CDN fora do ar, a tipografia degrada.
- Sugestão de correção: auto-hospedar a fonte (mesma correção de F1) e documentar a decisão.

### F3 — Nome da criança em `localStorage` sem criptografia
- Aplicável: Sim — dado pessoal de menor (regra anti-falso-positivo: nome de criança é dado sensível para este fim)
- Status: Não conforme · Severidade: **Médio** (não Alto: dado nunca sai do dispositivo, sem vetor XSS identificado — ver M4 — e sem transmissão; o risco exige acesso físico ao dispositivo ou XSS futuro)
- Evidência: `src/persistence/profile-store.js:27-42` (grava `name`), `src/core/config.js:67-70` (chave `joguinho.sobrinhos.v1`), `src/persistence/local-storage-adapter.js:22-29` (texto puro)
- Problema: qualquer script executado na origem lê o nome; não há segregação nem cifragem.
- Sugestão de correção: para app local familiar, priorizar minimização (apelido opcional, ver L5) em vez de criptografia performática; se cifrar, usar WebCrypto com chave derivada de PIN do responsável, documentando que não protege contra XSS.

### F4 — `innerHTML` isolado e sanitizado; restante do DOM usa `textContent`
- Aplicável: Sim — nome do perfil é user-controlled e chega ao DOM
- Status: Conforme
- Evidência: `src/ui/dom.js:2-4,19,39` (sempre `textContent`/`createTextNode`); único `innerHTML` em `src/ui/pixel-logo.js:73`, com escape em `src/ui/pixel-logo.js:6-13,25-26`
- Problema: nenhum atual. Nota: `createPixelLogoSvg(customRows)` aceita linhas arbitrárias; chamadores atuais passam só strings estáticas (`src/ui/screens/main-menu.js:87`) — manter o escape se o parâmetro for exposto a input futuro.

### F5 — Sourcemap publicado junto ao bundle de produção
- Aplicável: Sim
- Status: Não conforme · Severidade: **Baixo**
- Evidência: `vite.config.js:13` (`sourcemap: true`); `dist/assets/index-BiHFf4ju.js.map` presente no `dist/` que é copiado para a imagem (`Dockerfile:21`)
- Problema: expõe código-fonte original a qualquer visitante; facilita engenharia reversa (sem dado sensível no código, logo impacto baixo).
- Sugestão de correção: desativar `sourcemap` no build de produção ou gerar `hidden` sem publicar o `.map`.

### F6 — Sem links externos, sem `target=_blank`, sem `postMessage`
- Aplicável: Sim (verificação) · Status: Conforme · Evidência: grep por `<a |target=|rel=` em `src/` + `index.html` → só `<link>` de fonte/CSS

### F7 — Sem `eval`, `new Function`, `document.write` ou execução remota
- Aplicável: Sim (verificação) · Status: Conforme · Evidência: grep em `src/` e `tools/` → sem matches (único `fetch` é build-time em `tools/import-remote-assets.mjs:45`)

## 2. Segurança Back-End

Sem backend, banco, API ou sessão server-side — todos os itens clássicos (injeção SQL/NoSQL, RLS, autenticação/autorização server-side, CORS com credenciais, rate limiting de API, gestão de segredos de servidor) são **Não aplicáveis**, com a justificativa única: bundle estático sem endpoint próprio; evidência negativa pelos greps da Etapa 0 (zero `fetch`/rotas em `src/`, zero segredos em arquivos versionados — ver seção 5). Registro item a item omitido por redundância; nenhum item de back-end foi "esquecido" — a categoria inteira não existe neste projeto.

## 3. LGPD Específico

Critério: Lei 13.709/2018. Dado em escopo: **nome de criança** (art. 14 exige rigor redobrado) + perfil de progresso, ainda que 100% locais.

### L1 — Sem consentimento parental verificável para coleta de dado de menor
- Aplicável: Sim · Status: Não conforme · Severidade: **Alto**
- Evidência: `src/scenes/menu-scene.js:28,82` (cria perfil `createProfile('Nicolas', …)` sem qualquer tela de consentimento); `src/persistence/profile-store.js:27-42`
- Problema: art. 8º c/c art. 14, §1º — tratamento de dado de criança exige consentimento específico e em destaque de um dos pais/responsável. O app coleta o nome sem esse passo.
- Sugestão de correção: primeira execução exibe tela do responsável (consentimento destacado + link à política) antes de criar perfil; sem aceite, rodar em modo anônimo (sem nome).

### L2 — Sem política de privacidade / informações do art. 9º
- Aplicável: Sim · Status: Não conforme · Severidade: **Alto**
- Evidência: busca por `*privac*`, `*termos*`, `*license*` (fora de `node_modules`/`.git`) → vazio; grep por `privacidade|LGPD|consentimento` → só `pipeline-state.md:30`
- Problema: arts. 9º e 14, §2º (informação clara ao responsável: finalidade, armazenamento local, direitos). Ausência é risco legal direto ao publicar.
- Sugestão de correção: adicionar tela/documento "Privacidade" (onde ficam os dados — só neste dispositivo; como apagar; contato do responsável pelo app) linkada no menu e no consentimento de L1.

### L3 — Direito de eliminação existe no código, mas sem acesso na interface
- Aplicável: Sim · Status: Parcialmente conforme · Severidade: **Médio**
- Evidência: `deleteProfile` implementado em `src/persistence/profile-store.js:70-77` e `SaveStore.clear` em `src/persistence/save-store.js:55-59`, porém grep mostra **zero chamadores na UI**; o botão "Zerar progresso" (`src/scenes/menu-scene.js:66-70`) chama só `resetProgress`, que **mantém o nome**
- Problema: art. 18, VI — o titular (responsável) não tem caminho na interface para apagar o dado.
- Sugestão de correção: botão "Apagar perfil/dados" (com confirmação) ligado a `deleteProfile`/`clear`, documentado na política (L2).

### L4 — Sem prazo/política de retenção; dado persiste indefinidamente
- Aplicável: Sim · Status: Parcialmente conforme · Severidade: **Médio**
- Evidência: nenhuma expiração ou limpeza em `src/persistence/*`; art. 16 exige eliminação após a finalidade
- Problema: perfis de crianças acumulam para sempre no dispositivo sem informação ao responsável.
- Sugestão de correção: declarar na política (L2) que dados ficam só no dispositivo até exclusão manual + oferecer a exclusão (L3).

### L5 — Minimização: nome livre de até 24 caracteres + nome real padrão
- Aplicável: Sim · Status: Parcialmente conforme · Severidade: **Baixo**
- Evidência: `src/persistence/profile-store.js:80-83` (limite 24, sem restrição de conteúdo); `src/scenes/menu-scene.js:28,32` (perfil padrão chamado "Nicolas"); personagem `src/content/characters.js:9` ("Nicolas Gomes")
- Problema: art. 6º, VII e art. 14 — o jogo funciona sem nome real; o padrão grava nome de criança real sem ação do usuário.
- Sugestão de correção: perfil padrão anônimo ("Jogador 1") e campo de apelido opcional com orientação ao responsável para não usar nome completo.

### L6 — Segurança técnica do tratamento (art. 46)
- Aplicável: Sim · Status: Parcialmente conforme · Severidade: **Médio** — já reportado como F3; sem duplicata de severidade
- Evidência: ver F3. Atenuantes: `normalizeDocument` (`src/persistence/migration.js:95-124`) e `migrate` (`:23-53`) sanitizam documento corrompido/adulterado sem quebrar o app.

### L7 — Transferência internacional pelo Google Fonts (art. 33)
- Aplicável: Sim · Status: Parcialmente conforme · Severidade: **Médio** — causa-raiz já reportada em F2
- Evidência: `index.html:11-16`. O app em si não transfere nada (sem backend); a transferência é navegador→Google. Correção única: auto-hospedar a fonte.

### L8 — Compartilhamento com terceiros / cookies / rastreamento
- Aplicável: Sim (verificação) · Status: Conforme · Evidência: sem `fetch` em runtime, sem cookies, sem analytics no bundle

### L9 — Encarregado (DPO), registro de operações, relatório de impacto
- Aplicável: **Não** — projeto familiar, sem operação comercial, sem tratamento em larga escala ou alto risco sistêmico · Justificativa registrada conforme o prompt

## 4. Checklist de Deploy

### D1 — Imagem Docker endurecida
- Aplicável: Sim · Status: Conforme
- Evidência: `Dockerfile:15,25` (usuário `nginx` não-root), `docker-compose.yml:25-33` (`no-new-privileges`, `cap_drop: ALL`, `read_only: true`, tmpfs), `:13-22` (cpu/mem/pids), `:35-46` (healthcheck + rotação de logs), `.dockerignore:1-17` (exclui `.git`, `docs`, `*.md`, `.agents`)
- Nota Baixo: tags base flutuantes (`node:22-alpine`, `nginx-unprivileged:1.27-alpine`) — fixar digest para builds reproduzíveis e imunes a troca de tag.

### D2 — Headers de segurança do nginx
- Aplicável: Sim · Status: Parcialmente conforme (2 ressalvas, sem dupla contagem)
- Evidência: `docker/nginx.conf:9-16` — `nosniff`, `DENY` + `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, `server_tokens off` conformes; ressalvas: CSP quebra Fonts (F1, Alto) e ausência de HSTS (D3, Alto)
- Nota: `add_header … always` dentro de `location` (`:26`, `:33`) sobrescreve os headers do bloco `server` naquelas rotas — incluir os headers de segurança também nos blocos `location` ou usar `more_set_headers`.

### D3 — HTTPS/HSTS não definidos em nenhuma camada do repositório
- Aplicável: Sim · Status: Não conforme · Severidade: **Alto** (condicional: se o deploy for apenas LAN local sem TLS, rebaixar para Não aplicável; se for público via HTTP, mantém-se Alto)
- Evidência: `docker/nginx.conf` escuta só `:8080` sem bloco TLS; `docker-compose.yml:9-10` publica `65000:8080` sem proxy TLS
- Problema: em produção pública, tráfego sem TLS expõe integridade do bundle; sem HSTS, downgrade é possível.
- Sugestão de correção: terminar TLS num reverse proxy (ou documentar que a hospedagem o faz) e adicionar `Strict-Transport-Security "max-age=31536000; includeSubDomains"`.

### D4 — Porta 65000 publicada sem autenticação
- Aplicável: Sim · Status: Conforme (com nota) — jogo estático público não tem área restrita; nada no servidor lê/escreve dado. Nota: restringir bind a interface/localhost quando for uso familiar local.

### D5 — Cache e fallback SPA corretos
- Aplicável: Sim · Status: Conforme · Evidência: `docker/nginx.conf:24-34` (imutável 30d p/ assets com hash; `no-cache` no entrypoint), `:37-39` (nega dotfiles)

### D6 — Sem CI, sem scan de dependências/imagem
- Aplicável: Sim · Status: Não conforme · Severidade: **Médio**
- Evidência: sem `.github/`; `npm audit --offline` local retornou `found 0 vulnerabilities` (base offline pode estar desatualizada — ver "não consegui checar")
- Problema: imagem e lockfile evoluem sem verificação automatizada.
- Sugestão de correção: workflow mínimo (install → test → build → `npm audit` + scan da imagem) antes de publicar.

### D7 — Backup / monitoramento / WAF / CDN / DDoS
- Aplicável: Parcialmente → **Não verificável no repositório** (ver seção consolidada). Backup de dados do usuário é Não aplicável por arquitetura (dados vivem no dispositivo, não no servidor).

---

## Itens Não Verificáveis no Repositório

| # | Item | Onde verificar |
|---|---|---|
| NV1 | TLS efetivo e HSTS no ambiente público (D3) | Painel da hospedagem / reverse proxy; `curl -sI https://<host>` |
| NV2 | WAF / CDN / proteção DDoS e rate limiting de borda | Painel do provedor de hospedagem |
| NV3 | Monitoramento, logs centralizados e alerta de indisponibilidade | Provedor / stack de observabilidade |
| NV4 | Histórico de segredos além do grep (scanner dedicado) | Rodar `gitleaks detect --source .` ou `trufflehog git file://.` localmente (comandos na seção 5) |
| NV5 | Base de advisories atualizada (`npm audit` online) | `npm audit` com rede + `npm audit signatures` no CI (D6) |
| NV6 | Headers/CSP efetivamente servidos (incluindo sobrescrita por `location`, nota de D2) | Inspecionar resposta real do deploy após correção de F1 |

---

## PROMPT 2 — Módulos de Ataque (read-only)

### ETAPA 0 — Reconhecimento ofensivo

| Superfície | Resultado |
|---|---|
| Rotas/endpoints (método + sessão server-side) | **Zero** — app 100% client-side; nenhuma rota, nenhum método, nenhuma sessão |
| Modelo de dados | `localStorage`: `joguinho.sobrinhos.v1` (documento versionado de perfis) + `joguinho.sobrinhos.audio.v1`; sem RLS/banco — isolamento é por origem do navegador |
| Integrações pagas (IA, e-mail, SMS, pagamento) | **Zero** |
| Uploads | **Zero** — sem `<input type=file>`, sem `FormData` |
| Fluxo de dado sensível | Teclado → `normalizeName` → `localStorage` → `textContent` no DOM. Nunca sai do dispositivo |

### ETAPA 0.5 — Gate de módulos

| Módulo | Aplicável? | Justificativa breve |
|---|---|---|
| 1 — Secrets | **Adaptar** | Sem backend/`.env`, mas verificação real no estado atual + histórico git foi executada |
| 2 — Autenticação | **Não** | Sem login, sessão, reset de senha ou rota sensível |
| 3 — Banco de dados | **Adaptar** | Sem SGBD; adaptado ao "banco" real: `localStorage` por origem, sem isolamento entre perfis locais (by design familiar) |
| 4 — Input/Injeção | **Sim (parcial)** | Nome do perfil + SVG do logo + `JSON.parse` de save local |
| 5 — Bomba de custo | **Não** | Sem endpoint pago, com custo por chamada ou envio; Fonts é gratuito e client-side |

## 5. Secrets e Credenciais

Varredura real executada (read-only): `git grep` por `api[_-]?key|secret|passwd|password|token|Bearer |private[_-]?key|BEGIN .*PRIVATE KEY|sk_live|sk_test|ghp_|xox[baprs]-` em arquivos versionados (excluído `package-lock.json`) retornou **apenas falsos positivos** (`server_tokens off` em `docker/nginx.conf:16`; `tokenX/tokenY` variáveis de desenho em `src/render/sprites.js:210-225`). `git log --all --full-history -- .env` → vazio; `git log -S 'AKIA'` → vazio; `.env` não versionado; `dist/` e `node_modules/` não versionados (`git ls-files` confirma).

| arquivo:linha | o que vazou | como o atacante encontra | severidade | correção |
|---|---|---|---|---|
| — | Nada encontrado nos arquivos versionados nem no histórico consultado | — | — | Manter verificação no CI (D6) |

### Lista de Rotação
Vazia — nenhuma credencial comprometida ou sob suspeita. Nada a revogar.

### Verificações Manuais de Histórico (git)
Executadas nesta auditoria: `git log --all --full-history --oneline -- .env '.env*' '*.pem' '*.key'` (vazio); `git log --all -p -S 'AKIA'` (vazio); `git grep` de padrões acima (só falsos positivos). Histórico completo disponível (17 commits, clone não-shallow — verificado via `.git/shallow` ausente). Pendente para o mantenedor, com scanner dedicado:
- `gitleaks detect --source . -v`
- `trufflehog git file://. --only-verified`
- `git log --all -p -S 'sk_live' -S 'ghp_' -S 'xox' --oneline | head`

## 6. Autenticação e Sessão
**Não aplicável** — sem login, sessão, cookie, token, reset de senha ou rota que leia/mute dado de usuário remoto. Matriz de rotas vazia por inexistência de superfície. Nenhum achado.

## 7. Banco de Dados — Acesso entre Usuários
Adaptação registrada: o "banco" é o `localStorage` da origem; **não há isolamento entre perfis no mesmo dispositivo por desenho** (app familiar compartilhado — `ProfileStore` lê `doc.profiles` inteiro em `src/persistence/profile-store.js:14-25`). Sem usuário remoto, queries adversariais entre contas são **Não aplicáveis**. Achado positivo: documento adulterado manualmente (via DevTools) é neutralizado por `migrate`/`normalizeDocument` sem crash (`src/persistence/migration.js:23-53,95-124`) — **Conforme**, sem severidade.

## 8. Input e Injeção
- **XSS via nome do perfil: Conforme.** Todo texto user-controlled chega ao DOM por `textContent`/`createTextNode` (`src/ui/dom.js:19,39`); único `innerHTML` sanitizado por `escapeXml` (`src/ui/pixel-logo.js:6-13,73`). Sem `v-html`/`dangerouslySetInnerHTML` (sem framework), sem `href="javascript:"` (sem `<a>`).
- **Prototipagem/poluição via save local: Conforme.** `parse` rejeita não-objetos (`migration.js:86-92`); `normalizeDocument` reconstrói forma com tipos forçados (`:95-124`).
- **SQL/NoSQL/exec/uploads: Não aplicável** — sem banco, sem `eval`/`child_process`, sem upload.
- Nota Baixo (sem severidade formal): `normalizeName` trunca em 24 chars na escrita (`profile-store.js:80-83`) mas `normalizeDocument` na leitura só faz trim/fallback (`migration.js:103`) — inconsistência inofensiva hoje (render é `textContent`), apenas documentar se o nome for exibido em novo contexto.

## 9. Exposição de Custo
**Não aplicável** — sem rotas de IA/LLM, login/signup/reset, envio de e-mail/SMS, queries ou medição de uso. Único consumo externo é o Google Fonts (gratuito, client-side, sem chave). Nenhum achado.
