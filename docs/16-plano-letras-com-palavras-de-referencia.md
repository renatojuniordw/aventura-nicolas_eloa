# 16 — Plano: letras com palavras de referência na narração

Data: 24/09/2026. Status: implementado em 24/09/2026 (ver seção 9); audição real pendente.

## 1. Objetivo

Sempre que o jogo pedir por voz para encontrar uma letra, acrescentar uma palavra
que comece com ela. Exemplo: **“Encontre a letra A de amigo.”**

Esta entrega é somente um plano, baseado na leitura do código atual. Não houve
implementação nem validação auditiva. As palavras abaixo são uma proposta editorial
para a primeira versão, não uma avaliação pedagógica formal.

## 2. Diagnóstico do código atual

| Arquivo / ponto | Comportamento observado |
| --- | --- |
| `src/audio/speech-narrator.ts`, `speakLessonTarget` | Monta “Encontre a letra a”, “Encontre a sílaba ba” ou “Encontre a palavra bola”. Trata como letra quando `type === 'letter'` **ou** o alvo tem comprimento 1. |
| `src/scenes/game-scene.ts`, `enter` | Aventura e Corrida chamam `speakLessonTarget`; Explorar anuncia a palavra e, conforme o nível de apoio, a próxima letra. |
| `GameScene.repeatInstruction` e `_tickAssistedRepeat` | A repetição manual e a automática reutilizam a instrução; com portal aberto, a instrução passa a ser sobre o portal. |
| `GameScene._advanceSpeedrun` | Enfileira o próximo alvo com `speakLessonTarget(..., { interrupt: false })`, depois do elogio. |
| `GameScene._speakNextLetter` | Explorar usa uma frase separada: “Agora a letra…”, enfileirada com `interrupt: false`. |
| Feedback de erro em `game-scene.ts` | Usa outra frase: “Essa é a letra…. Procure…”. |
| `src/audio/speech-narrator.test.js` | Já testa o texto da instrução e a síntese simulada. A expectativa para A precisará mudar. |
| `src/content/word-bank.ts` | Banco do modo Explorar; não cobre todas as iniciais e não deve receber palavras só para completar esta funcionalidade. |

O item 2.3 de [15 — Melhorias após streaming](15-plano-melhorias-pos-streaming.md)
já trata de narração e fila no modo Explorar. Este plano complementa esse trabalho;
a implementação deve preservar a ordem das falas existente.

## 3. Escopo definido para a primeira versão

1. Enriquecer todas as instruções produzidas pelo ramo de letras de
   `speakLessonTarget`, incluindo início da fase, avanço da Corrida e repetições.
2. Aplicar nos três níveis de apoio. Não criar configuração nova para ativar a palavra.
3. Usar uma palavra fixa por letra, sem sorteio: repetir A sempre retorna “amigo”.
4. Manter a frase em uma única chamada a `speak`, evitando separar letra e palavra
   em duas falas que possam se cancelar.
5. Preservar `interrupt`, idioma, volume, mudo e tratamento de síntese indisponível.
6. Manter objetivos visuais, itens coletáveis, currículo, progresso e regras de jogo.

**Fora do escopo:** alterar “Agora a letra…” do Explorar, feedback de erro,
`speakSyllable`, elogios, anúncio da palavra completa, HUD, imagens, gravações de
áudio, serviços externos ou geração de palavras por IA durante o jogo.

Essa delimitação atende ao pedido “sempre que fala encontre a letra”. Caso se deseje
depois estender a associação a toda fala sobre letras, fazer uma tarefa separada:
no Explorar, a palavra de referência pode competir com a palavra que a criança está
montando. Não introduzir essa mudança silenciosamente nesta implementação.

## 4. Vocabulário inicial

Manter a grafia correta, inclusive acentos. Usar os exemplos abaixo como padrão.

| Letra | Palavra | Letra | Palavra |
| --- | --- | --- | --- |
| A | amigo | N | Nicolas |
| B | bola | O | ovo |
| C | casa | P | papai |
| D | dedo | Q | queijo |
| E | Eloá | R | rua |
| F | feijão | S | sol |
| G | gato | T | tio |
| H | hora | U | uva |
| I | irmão | V | vaca |
| J | janela | W | waffle |
| K | kiwi | X | xícara |
| L | lua | Y | yoga |
| M | mamãe | Z | zebra |

K, W e Y usam grafias de origem estrangeira para cobrir todo o alfabeto presente
na Corrida. Ouvir especialmente esses exemplos na voz usada pelo aparelho.
Não substituir por palavras com outra inicial, como “iogurte” para Y.

A associação é com a **letra inicial escrita**, não uma promessa de que toda letra
tem um único som. Não acrescentar explicações de fonemas; H, por exemplo, continua
associado a “helicóptero”.

## 5. Implementação proposta

### Etapa 1 — Dados de referência

Criar `src/content/letter-reference-words.json` com um objeto plano, chaves A–Z e
valores em minúsculas conforme a tabela. Assim o vocabulário fica separado da lógica
de síntese e pode ser editado como conteúdo.

Criar `src/content/letter-reference.ts` com uma função pura, por exemplo:

```ts
getLetterReferenceWord(target: string): string | undefined
```

Contrato:

- Remover espaços nas extremidades, normalizar Unicode para NFC e converter a chave
  para maiúscula ao consultar o mapa.
- Aceitar `A`, `a` e ` a ` como a mesma chave.
- Retornar `undefined` para vazio, múltiplas letras, símbolos ou chaves ausentes.
- Não remover diacríticos: `Á`, `Ã` e `Ç` não devem virar silenciosamente A e C.
  Nesta versão, eles usam a instrução sem palavra de referência.
- Não modificar `text-utils.normalize`: sua comparação sem acentos pertence à
  validação de respostas e tem uma finalidade diferente.
- Retornar a palavra com a grafia do arquivo, preservando “Eloá”, “mamãe” e “xícara”.

### Etapa 2 — Composição da fala

No ramo de letras de `SpeechNarrator.speakLessonTarget`, consultar a função e montar:

```text
Com referência: Encontre a letra a de amigo
Sem referência: Encontre a letra á
```

Manter a letra em minúscula no texto enviado à síntese, seguindo a estratégia atual
para evitar a leitura de “maiúsculo”. A capitalização usada nos exemplos deste plano
é apenas para leitura humana. Não exigir aspas faladas nem acrescentar soletração.

Preservar a regra atual de seleção do ramo (`type === 'letter' || clean.length === 1`),
o retorno booleano, o tratamento de entrada vazia e as opções recebidas.
Não associar “BA” à palavra de B mesmo que venha com `type: 'letter'`:
sem uma chave exata no mapa, manter a frase antiga sem complemento.

A importação deve ser local e leve. Não carregar o banco de palavras, embeddings
ou currículo inteiro para resolver 26 referências. Nenhuma dependência nova é necessária.

### Etapa 3 — Conferência dos caminhos de chamada

Revisar as chamadas em `game-scene.ts` para confirmar que início, repetição manual,
repetição assistida e avanço da Corrida continuam passando pelo narrador central.
Não duplicar o mapa ou a composição de texto na cena.

Em princípio, a cena não precisa de alteração funcional. Ajustar seus testes apenas
onde necessário para garantir a integração e preservar `interrupt: false` na Corrida.
Não mudar cronômetro, velocidade ou progressão para esperar a narração terminar.

## 6. Testes e critérios de aceitação

### Automatizados

- Testar a cobertura das 26 chaves A–Z, palavras não vazias e inicial correspondente
  à chave; proteger explicitamente a associação A → amigo.
- Testar consulta com caixa e espaços, entrada vazia, alvo de múltiplas letras,
  símbolo e letras acentuadas sem entrada; nunca usar a primeira letra de uma palavra
  inteira como chave implícita.
- Em `speech-narrator.test.js`, verificar “Encontre a letra a de amigo” e pelo menos
  outra letra; garantir uma única emissão por instrução.
- Manter as saídas “Encontre a sílaba ba” e “Encontre a palavra bola”, além do
  comportamento existente para alvos de um caractere e `type` omitido.
- Verificar a frase antiga como fallback para referência ausente, sem “undefined”
  nem trecho “de” vazio, e nenhuma fala para entrada vazia.
- Verificar que `{ interrupt: false }` não chama `cancel`, que o comportamento
  padrão de interrupção é preservado e que mudo/síntese indisponível não emitem fala.
- Nos testes existentes da cena, garantir encaminhamento do alvo atual no início,
  na repetição manual/assistida e no avanço da Corrida; usar os testes do narrador
  para validar o texto final, sem repetir toda a tabela em cada teste de cena.

### Audição e regressão manual

- Aventura na letra A: ouvir “Encontre a letra A de amigo”; repetir pelo botão ♫.
- Apoio assistido: esperar a repetição automática e confirmar o mesmo exemplo.
- Corrida: ouvir A e B, avançar várias letras rapidamente e conferir se a fala mais
  longa acumula instruções antigas. Preservar a fila atual; se o problema aparecer,
  registrar reprodução e propor correção específica, sem alegar que mocks validam isso.
- Ouvir especialmente H, K, W, X e Y em desktop e no celular usado para jogar.
  Se a voz pronunciar mal a letra, registrar o caso antes de introduzir nomes
  fonéticos como “bê” ou “dáblio”; essa tabela adicional não faz parte da primeira versão.
- Conferir uma fase de sílaba, uma de palavra e o modo Explorar: falas existentes
  preservadas; portal continua pedindo para correr até ele.
- Confirmar mudo e volume da voz. O mapa é local e não acrescenta requisições;
  disponibilidade de síntese offline continua dependente do ambiente existente.

Executar ao concluir a implementação:

```bash
npm test
npm run typecheck
npm run build
```

**Pronto quando:** todas as instruções “Encontre a letra…” para A–Z incluem a
referência correta; repetições são consistentes; sílabas e palavras não mudam;
testes e verificações passam. Informar separadamente quais aparelhos tiveram
audição real e o que ficou pendente de validação manual.

## 7. Documentação e entrega da implementação

Atualizar `docs/02-gameplay-e-controles.md` com a nova instrução de voz e
`docs/04-modelo-de-conteudo.md` com o local e formato do mapa. Atualizar este plano
com o resultado e as pendências reais. Seguir os limites do `AGENTS.md` para o
Obsidian: esta tarefa se restringe ao repositório; exportação e diário no vault
dependem de uma tarefa que o envolva explicitamente.

## 8. Prompt para a LLM implementadora

> Implemente o plano `docs/16-plano-letras-com-palavras-de-referencia.md`.
> Leia `AGENTS.md` e confira o código atual antes de editar. Acrescente referências
> fixas A–Z às falas de `SpeechNarrator.speakLessonTarget`, como “Encontre a letra A
> de amigo”, com conteúdo local separado da lógica, fallback e testes descritos.
> Preserve opções de fila, controles de áudio e chamadas existentes. Respeite o
> escopo definido, execute test/typecheck/build e atualize a documentação.
> Entregue um resumo dos arquivos alterados, verificações e pendências de audição
> real. Não declare como validado em aparelho o que foi testado apenas com mocks.

## 9. Resultado da implementação (24/09/2026)

Arquivos:

- `src/content/letter-reference-words.json` e `src/content/letter-reference.ts` (novos),
  com testes em `src/content/letter-reference.test.js`.
- `src/audio/speech-narrator.ts`: o ramo de letras de `speakLessonTarget` acrescenta
  “de <palavra>” quando há referência; uma única chamada a `speak`, opções preservadas.
- `src/audio/speech-narrator.test.js`: novas expectativas, fallback, `interrupt: false`,
  mudo e síntese indisponível.
- `src/scenes/game-scene.test.js`: encaminhamento do alvo no início, botão ♫, repetição
  assistida e avanço da Corrida (`interrupt: false`). A cena não mudou.
- Docs: `02-gameplay-e-controles.md` e `04-modelo-de-conteudo.md`.

Verificações: `npm test` (724 testes), `npm run typecheck` e `npm run build` passaram.

Pendente — nada foi ouvido em aparelho real; os testes usam síntese simulada:

- Audição de A–Z, com atenção a H, K, W, X e Y, em desktop e no celular usado para jogar.
- Corrida com avanço rápido: conferir se a frase mais longa acumula instruções na fila.
- Regressão auditiva de sílaba, palavra, Explorar e portal.
