# Privacidade e LGPD — Aventura do Nicolas&Eloá

> **Para os responsáveis:** este documento explica, em linguagem simples, quais
> dados o jogo guarda, onde ficam e como apagar. O jogo foi feito para crianças
> pequenas, então a regra é uma só: **nada sai do aparelho**.

---

## 1. Quais dados o jogo guarda

| Dado                              | Onde fica                          | Para quê serve                        |
| --------------------------------- | ---------------------------------- | ------------------------------------- |
| Nome da criança (perfil)          | Navegador, `localStorage`          | Identificar o jogador no menu         |
| Personagem escolhido              | Navegador, `localStorage`          | Mostrar o herói certo na tela inicial |
| Progresso (fases concluídas)      | Navegador, `localStorage`          | Continuar de onde parou               |
| Consentimento do responsável      | Navegador, `localStorage`          | Lembrar que o aviso foi aceito        |
| Respostas recentes por lição e última alternativa confundida | Navegador, `localStorage` | Escolher revisões e dicas |
| Descobertas realizadas | Navegador, `localStorage` | Registrar as palavras exploradas e sílabas formadas |
| Volume do som                     | Navegador, `localStorage`          | Manter a preferência de áudio         |

**O jogo não coleta:** localização, câmera, microfone, contatos, nem qualquer
identificador do aparelho. Não há conta, login, senha ou cadastro.

## 2. Nada é enviado para a internet

O jogo **não tem servidor de dados**: não existe banco de dados, API ou
serviço de análise recebendo dados. Tudo fica no `localStorage` do navegador,
neste aparelho, e só este aparelho lê esses dados.

Desde a versão com fontes próprias (self-hosted), o jogo **não faz nenhuma
requisição a terceiros**: nem a fonte (arquivos em `/fonts`), nem imagens, nem
sons saem do próprio servidor/aparelho. Isso vale também para a versão
instalável como PWA: o cache offline (service worker/Workbox) guarda cópias
locais dos próprios arquivos do jogo no navegador — não é um servidor
adicional nem envia nada para fora. Ver
[11 — Mobile, PWA e deploy](11-mobile-pwa-e-deploy.md).

### 2.1. Exceção: Controle por celular (opcional, desligado por padrão)

Quem ativar o **Controle por celular** (ver
[12 — Controle por celular](12-controle-por-celular.md)) liga, só durante
aquela partida, uma conexão WebSocket entre o celular e a TV, passando por um
servidor de sinalização próprio (na mesma VPS do jogo — nenhum terceiro).
Isso é a única exceção à regra "nada sai do aparelho" deste documento, e por
isso vale destacar exatamente o que trafega:

- **O que trafega:** o evento `{"pulou": true}` (`action: jump`), disparado uma
  vez por pulo detectado, e um segundo tipo de mensagem sem conteúdo nenhum —
  um carimbo de tempo que a TV manda e o servidor só ecoa de volta
  (`ping-check`/`pong-check`), usado só para mostrar "conexão boa/ruim" na
  tela de pareamento. Nenhum dado contínuo do acelerômetro sai do celular — a
  leitura bruta do sensor nunca deixa o aparelho da criança.
- **O que não trafega:** nome, perfil, progresso, localização ou qualquer
  outro dado do save — o servidor de sinalização não tem acesso a nada disso,
  só repassa a palavra "pulo" (e o carimbo de tempo do teste de latência)
  entre os dois navegadores.
- **Sem persistência:** o servidor guarda a sala (`session`) só na memória do
  processo Node enquanto a partida dura; nada é escrito em disco ou banco de
  dados. A sala sobrevive só a uma queda breve de conexão (até 5 min do lado
  do celular, até 15s do lado da TV — ver docs/12 §6) e é apagada de vez
  quando a partida realmente termina.
- **Sessão efêmera e aleatória:** o código de pareamento (`session`) é gerado
  na hora, só existe enquanto a partida está aberta, e só um celular pode
  parear por sala.
- **Opt-in:** o recurso só liga se alguém tocar em "Controle por celular" no
  menu; o jogo funciona inteiro, por padrão, sem abrir nenhuma conexão de
  rede — exatamente como descrito no resto deste documento.

## 3. Consentimento parental (LGPD, arts. 8º e 14)

Na primeira execução, antes de criar qualquer perfil, o jogo mostra um aviso
aos responsáveis explicando que o nome e o progresso ficam só no aparelho. O
jogo só continua depois da confirmação ("Entendi, pode começar"). A resposta
fica registrada no próprio save (`parentalConsent: true`) e o aviso não
aparece de novo — nem mesmo se os perfis forem apagados.

## 4. Direitos dos titulares (LGPD, art. 18)

- **Acesso:** todo o conteúdo guardado pode ser visto no próprio jogo (menu,
  fases concluídas) ou inspecionando a chave `joguinho.sobrinhos.v1` no
  `localStorage` do navegador.
- **Correção:** o nome do perfil pode ser alterado no jogo.
- **Eliminação:** a opção **"Zerar progresso"** no menu apaga o progresso e as
  estatísticas do perfil ativo (fases concluídas, acertos, erros e melhor tempo
  da maratona, respostas recentes por lição e descobertas) — **o nome da criança permanece**. Para remover também o nome e
  o registro de consentimento, use a limpeza de dados do site no navegador.
  > **Item em aberto:** o código já tem `ProfileStore.deleteProfile()` e a
  > remoção é coberta por teste, mas **nenhuma tela do jogo a expõe** — hoje
  > não há como apagar um perfil pela interface. Expor isso é a evolução
  > recomendada para fechar o direito de eliminação dentro do próprio jogo.
- **Portabilidade:** os dados estão em JSON legível no `localStorage` e podem
  ser copiados livremente.

## 5. Segurança

- O jogo roda 100% no lado do cliente; não há transmissão, então não há
  interceptação de dados de jogo em trânsito — exceto durante o Controle por
  celular (§2.1), cujo único dado em trânsito é o evento efêmero `jump`.
- O texto é inserido via `textContent` (nunca `innerHTML`), então nomes de
  perfil não viram código executável.
- Saves ilegíveis ou de versão futura são isolados (backup em chave separada)
  em vez de travar o jogo — ver `src/persistence/save-store.ts`.
- O Nginx de produção envia uma Content-Security-Policy estrita
  (`default-src 'self'`, sem `script-src` externo) — ver
  [11 — Mobile, PWA e deploy](11-mobile-pwa-e-deploy.md).

## 6. Para desenvolvedores

- Chave de armazenamento: `joguinho.sobrinhos.v1` (ver
  `src/persistence/storage-keys.ts` e `STORAGE.keyPrefix` em
  `src/core/config.ts`); versão do schema em `SCHEMA_VERSION`.
- Migrações em `src/persistence/migration.ts`; o campo `parentalConsent` é
  normalizado para booleano e preservado entre versões.
- Ao adicionar qualquer dado novo ao save, atualize a tabela da seção 1 deste
  documento.
- **Regra de ouro:** nunca adicione telemetria, analytics ou qualquer
  requisição de rede sem antes atualizar este documento e o aviso no jogo.

---

*Documento criado em 2026-09-16 como parte do pipeline de engenharia (Fase 1,
achados Seg 2 e Seg 3). Revisado junto da copy de UI na Fase 5, em 2026-09-17
para corrigir a chave de armazenamento e cobrir o cache offline do PWA,
novamente em 2026-09-17 para cobrir o Controle por celular (§2.1), e uma
terceira vez no mesmo dia para incluir o teste de latência (`ping-check`) e a
janela de reconexão da TV.*
