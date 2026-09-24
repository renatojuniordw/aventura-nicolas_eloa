# 14 — Plano: app Android (e depois iOS) em um projeto novo

## Contexto e decisões

O jogo atual é um platformer educativo de alfabetização em português. Ele roda em um engine próprio em TypeScript com Canvas 2D (960x540), menus em React 19 (DOM) e Vite 8. Já é uma PWA offline, com controles de toque, safe-areas e persistência em localStorage. Não tem backend, exceto o recurso opcional de "celular como controle" (socket.io).

Decisões tomadas:

1. **O projeto atual não será alterado.** Ele continua como a versão web/PWA.
2. **O app será um projeto novo (repositório separado).**
3. **Tecnologia: Capacitor** (o app empacota o jogo web numa WebView nativa). O React Native fica como plano B (ver abaixo).
4. **Android primeiro; iOS depois com o mesmo código.**
5. **Versão 1 via TWA:** publicar a PWA atual no Android com Bubblewrap enquanto o app Capacitor é construído (ver "Versão 1 rápida").
6. **"Celular como controle" fica fora do app**; continua só na versão web.
7. **Voz:** gravar áudio para as falas antes da publicação, em vez de depender do `speechSynthesis`.
8. **Play Store:** abrir a conta de desenvolvedor e iniciar o teste fechado cedo, junto com a versão 1.

## React Native é a melhor opção?

Para este jogo, não. O React Native não tem `<canvas>` nem DOM. O render (`src/render`), as telas (`src/ui/screens/*.tsx`), o CSS e os controles de toque por DOM teriam que ser reescritos. Só a lógica pura (`gameplay`, `physics`, `content`, ~150 níveis) sobreviveria.

| Opção | Reaproveita o código atual | Android + iOS | Desempenho | Esforço | Comentário |
|---|---|---|---|---|---|
| **Capacitor (escolhida)** | Quase tudo | Sim | Bom para 2D simples (WebView) | Baixo | Menor caminho até a loja; plugins nativos disponíveis |
| **React Native + Skia** | Só lógica pura | Sim | Melhor (render nativo) | Alto | Vale se a WebView ficar lenta ou se quiser UI 100% nativa |
| **Expo + WebView local** | Quase tudo | Sim | Igual ao Capacitor | Baixo | Na prática equivale ao Capacitor, com mais camadas |
| **TWA (Bubblewrap)** | Tudo | Só Android | Igual à PWA | Muito baixo | Publica a PWA já hospedada em HTTPS; sem plugins nativos |
| **Flutter + Flame** | Nada | Sim | Bom | Alto | Reescrita completa em Dart |
| **Godot / Unity** | Só conteúdo (níveis, arte) | Sim | Bom | Alto | Faria sentido se o jogo fosse começar do zero |

**Quando trocar para React Native + Skia:** só se, depois de medir em aparelhos reais (Fase 2), o FPS na WebView for insuficiente em Androids de entrada. Nesse caso o caminho é trazer `gameplay`, `physics` e `content` para um pacote compartilhado, reescrever o render com `@shopify/react-native-skia` e refazer as telas em RN. Não recomendo começar por aí sem essa medição: não medi o desempenho atual, então esta recomendação é uma estimativa, não um resultado.

## Como o projeto novo se relaciona com o atual

Como o repositório atual não pode ser mexido, o novo nasce como **cópia do código-fonte web** em um commit/tag marcado (por exemplo `app-base-v1`). A partir daí os dois evoluem separados.

- Vantagem: o web continua estável e o app pode ter ajustes próprios (canvas com `devicePixelRatio`, plugins, sem service worker).
- Custo: correções de gameplay e conteúdo precisam ser levadas de um lado para o outro. Para reduzir isso, manter `src/gameplay`, `src/physics` e `src/content` sem dependência de plataforma (hoje já são separados de `render` e `ui`) e sincronizar por `git cherry-pick`, ou por `git subtree` se a frequência de mudanças justificar.
- Alternativa se a divergência incomodar: mais tarde, extrair esses três módulos em um pacote npm privado usado pelos dois projetos. Isso exigiria mexer no projeto atual, então fica fora do escopo agora.

Estrutura sugerida do novo repositório:

```
aventura-app/
  src/                  # cópia do src atual, com adaptações do app
  public/
  android/              # gerado pelo Capacitor (versionar)
  capacitor.config.ts
  vite.config.ts        # sem vite-plugin-pwa no build do app
  docs/                 # este plano + decisões do app
```

Não levar para o app: `signaling/`, `docker/`, `deploy.sh`, `controle.html` (ver item "Celular como controle" abaixo).

## Versão 1 rápida: TWA (em paralelo às demais fases)

O PWA atual já existe e é hospedado pelo `docker/`, então dá para publicá-lo no Android sem alterar o projeto atual.

1. Confirmar que o PWA está em HTTPS, em domínio próprio, com manifest válido. O agente de exploração notou que os ícones 192/512 estão marcados `any maskable` juntos e que faltam ícone monochrome e screenshots; corrigir isso exigiria mexer no projeto atual, então decida se aceita o ícone como está ou se abre uma exceção só para esse ajuste.
2. Gerar o projeto Android com Bubblewrap e configurar o Digital Asset Links (`assetlinks.json` no domínio).
3. Criar a conta de desenvolvedor Google Play e o app no Play Console.
4. Conferir na documentação atual do Play Console os requisitos de conta nova (contas pessoais novas podem exigir teste fechado com número mínimo de testadores por um período antes da produção) e o nível mínimo de API alvo. Não conferi esses requisitos aqui e eles mudam com frequência.
5. Preencher política de privacidade, Data Safety e Families Policy (mesmo trabalho da Fase 3) e iniciar o **teste fechado** com esta versão. O período de teste corre enquanto o app Capacitor é feito.
6. Limitações aceitas: sem plugins nativos, sem iOS, depende do domínio no ar. Quando o app Capacitor estiver pronto, ele substitui esta versão na mesma ficha da loja (mesmo `applicationId`, se planejado desde já).

## Fase 0 — Criar o projeto e validar a base

1. Criar o repositório novo e copiar `src/`, `public/`, `index.html` e a configuração do Vite/TypeScript/Vitest do commit escolhido.
2. Remover `vite-plugin-pwa`, `pwa-install`, `pwa-update` e o registro do service worker (o APK já carrega os assets localmente).
3. Rodar `npm run typecheck && npm test && npm run build` e conferir que o jogo abre no navegador.
4. Remover o que é só do web: `socket.io-client`, `src/net`, `src/controle`, `qrcode` (ou deixar desligado; ver decisão abaixo).

## Fase 1 — Ajustes de mobile no código copiado

Nada disso é aplicado no projeto atual.

1. **Canvas nítido e proporção correta:** aplicar `devicePixelRatio` e escala com letterbox/inteira no lugar do stretch atual em landscape (evita distorção em telas 20:9).
2. **Hover:** envolver as regras `:hover` de `main.css` em `@media (hover: hover)`.
3. **Fluxo só por toque:** confirmar que todas as telas (`src/ui/screens/*.tsx`) podem ser concluídas sem teclado; sliders de 32px passam para ≥44px.
4. **Multi-toque:** testar em aparelho real segurar ▶ e tocar pulo (`TouchAdapter`, `pointerleave`).
5. **Wake lock:** manter a tela ligada durante o jogo.
6. **Fala pt-BR com áudio gravado:** a voz do `speechSynthesis` (`src/audio/speech-narrator.ts`) varia entre aparelhos. Gravar (ou gerar com uma ferramenta de voz) os áudios das letras, sílabas e palavras e registrá-los no `AudioManager`, que hoje não tem nenhum arquivo cadastrado. Manter o `speechSynthesis` só como fallback. Concluir antes da Fase 3.
7. **Peso do bundle:** carregar `embeddings-data` sob demanda, para reduzir o APK e o tempo de abertura.

## Fase 2 — Capacitor + Android

1. `npm i @capacitor/core @capacitor/cli @capacitor/android`; `npx cap init` (`appId` do tipo `br.com.aventura.nicoleloa`, `webDir: dist`); `npx cap add android`.
2. Script: `build:android` = `vite build && cap sync android`.
3. Plugins: `@capacitor/screen-orientation` (landscape travado, no lugar de `tryLockLandscape`), `@capacitor/haptics` (adaptar `src/input/haptics.ts`), `@capacitor/app` (botão voltar e ciclo de vida: pausar ao ir para segundo plano), `@capacitor/status-bar`, `@capacitor/splash-screen`.
4. Manifest Android: `screenOrientation="sensorLandscape"`, modo imersivo, ícone adaptativo (foreground, background, monochrome) e splash.
5. **Persistência:** migrar o `StorageAdapter` para `@capacitor/preferences`, para o progresso não sumir se o Android limpar o storage da WebView. Reaproveitar `src/persistence/migration` para importar dados do localStorage.
6. Testar em emulador e em aparelho real (`npx cap run android`).

## Fase 3 — Qualidade e publicação

1. Testar em pelo menos 3 aparelhos (baixo, médio, alto desempenho) e medir FPS via `chrome://inspect`. **Esta medição decide se o plano B (React Native + Skia) é necessário.**
2. Ajustes de desempenho se preciso: menos repaints do DOM sobre o canvas, `will-change`.
3. **Público infantil:** política Google Play Families, política de privacidade (adaptar `docs/10-privacidade-e-lgpd.md` do projeto atual), formulário Data Safety, sem anúncios nem analytics não declarados.
4. Keystore e assinatura, gerar AAB, trilha de teste interno e depois produção.
5. Reaproveitar a conta, a ficha da loja e os testadores da versão 1 (TWA). Reconferir o nível mínimo de API alvo exigido no momento do envio.

## Fase 4 — iOS e outras plataformas

- **iOS:** `@capacitor/ios`. Exige Mac, Xcode e conta Apple Developer paga. Revisar `speechSynthesis`, safe-areas e áudio no WebKit.
- **Desktop/tablets/Chromebooks:** continuar usando a PWA do projeto atual.

## Decisão: "celular como controle" fica fora do app

Esse modo usa um segundo celular como controle via socket.io e um servidor de signaling (`signaling/`). No app nativo ele perde sentido, porque o próprio aparelho já tem toque. Ele continua só na versão web. Consequências: `signaling/`, `src/net`, `src/controle`, `socket.io-client` e `qrcode` não vão para o repositório novo, e a política de privacidade do app não precisa declarar esse uso de rede. Se a decisão mudar, será preciso hospedar o signaling em HTTPS e declarar o uso de rede.

## Dicas extras

- Guardar as decisões deste plano em um ADR curto no repositório novo, para o histórico do motivo de não ter usado React Native.

## Riscos

- Desempenho de Canvas 2D + DOM em Androids antigos (mitigado pela medição da Fase 3).
- Voz pt-BR indisponível em alguns aparelhos.
- Revisão mais rígida da Play Store para apps infantis.
- Divergência entre o app e o web ao longo do tempo (mitigada mantendo o núcleo de gameplay separado).
- Perda de dados do localStorage (mitigada com Preferences).

## Verificação

- Após cada fase: `npm run typecheck && npm test`.
- `npm run build && npx cap sync android && npx cap run android` em emulador e aparelho real.
- Checklist manual: landscape travado, multi-toque, botão voltar, retomada após segundo plano, funcionamento offline, salvar/carregar progresso, voz pt-BR.
