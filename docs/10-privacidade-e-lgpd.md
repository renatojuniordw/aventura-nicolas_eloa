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
| Volume do som                     | Navegador, `localStorage`          | Manter a preferência de áudio         |

**O jogo não coleta:** localização, câmera, microfone, contatos, nem qualquer
identificador do aparelho. Não há conta, login, senha ou cadastro.

## 2. Nada é enviado para a internet

O jogo **não tem servidor**: não existe banco de dados, API ou serviço de
análise recebendo dados. Tudo fica no `localStorage` do navegador, neste
aparelho, e só este aparelho lê esses dados.

Desde a versão com fontes próprias (self-hosted), o jogo **não faz nenhuma
requisição a terceiros**: nem a fonte (arquivos em `/fonts`), nem imagens, nem
sons saem do próprio servidor/aparelho.

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
  da maratona) — **o nome da criança permanece**. Para remover também o nome e
  o registro de consentimento, use a limpeza de dados do site no navegador.
  > **Item em aberto:** o código já tem `ProfileStore.deleteProfile()` e a
  > remoção é coberta por teste, mas **nenhuma tela do jogo a expõe** — hoje
  > não há como apagar um perfil pela interface. Expor isso é a evolução
  > recomendada para fechar o direito de eliminação dentro do próprio jogo.
- **Portabilidade:** os dados estão em JSON legível no `localStorage` e podem
  ser copiados livremente.

## 5. Segurança

- O jogo roda 100% no lado do cliente; não há transmissão, então não há
  interceptação de dados de jogo em trânsito.
- O texto é inserido via `textContent` (nunca `innerHTML`), então nomes de
  perfil não viram código executável.
- Saves ilegíveis ou de versão futura são isolados (backup em chave separada)
  em vez de travar o jogo — ver `src/persistence/save-store.js`.

## 6. Para desenvolvedores

- Chave de armazenamento: `aventura-nicolas-eloa.v1` (ver
  `src/persistence/storage-keys.js`); versão do schema em `SCHEMA_VERSION`.
- Migrações em `src/persistence/migration.js`; o campo `parentalConsent` é
  normalizado para booleano e preservado entre versões.
- Ao adicionar qualquer dado novo ao save, atualize a tabela da seção 1 deste
  documento.
- **Regra de ouro:** nunca adicione telemetria, analytics ou qualquer
  requisição de rede sem antes atualizar este documento e o aviso no jogo.

---

*Documento criado em 2026-09-16 como parte do pipeline de engenharia (Fase 1,
achados Seg 2 e Seg 3). Revisado junto da copy de UI na Fase 5.*
