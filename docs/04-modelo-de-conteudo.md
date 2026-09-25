# 04 — Modelo de conteúdo

Todo o conteúdo do jogo é **dado** (JSON), nunca código. Acrescentar uma letra, uma sílaba
ou uma palavra é editar um arquivo de dados — o programa não muda.

Este documento descreve os dois formatos: o **currículo** (o que se ensina) e as **fases**
(onde se joga), mais a validação que garante que os dois continuam coerentes.

---

## 1. Visão geral

```
src/content/curriculum.json          ← escrito à mão (fonte de verdade)
        │
        │  npm run generate:levels
        ▼
tools/generate-levels.mts            ← combina currículo + templates de terreno
        │
        ▼
src/content/levels/fase-*.json       ← 152 arquivos gerados (versionados)
        │
        │  level-registry.ts (import.meta.glob)
        ▼
      jogo em execução
```

O currículo diz **o que** ensinar. Os templates dizem **como** é o terreno. O gerador
junta os dois. Alterar o conteúdo é editar `curriculum.json` e rodar o gerador.

---

## 2. Currículo (`src/content/curriculum.json`)

Uma **unidade** é um agrupamento didático; uma **lição** é uma unidade × um alvo.

```jsonc
{
  "schemaVersion": 1,
  "units": [
    {
      "id": "alfabeto",              // identificador único, estável
      "title": "Alfabeto",           // aparece no menu (pt-BR)
      "order": 1,                    // ordem de exibição e de liberação
      "type": "letter",              // letter | syllable | word
      "icon": "A",                   // usado em menus
      "objectiveTemplate": "Colete a letra {target}",
      "pool": ["A", "B", "C", "..."], // cada item vira UMA lição
      "distractorPool": ["..."]      // opcional: distratores extras
    }
  ]
}
```

### Campos

| Campo | Obrigatório | Descrição |
|---|---|---|
| `id` | sim | Único no arquivo. Usado em ids de lição e de fase |
| `title` | sim | Nome em português exibido no menu |
| `order` | sim | Ordem de apresentação e de liberação |
| `type` | sim | `letter`, `syllable` ou `word` |
| `icon` | não | Texto curto mostrado em menus |
| `objectiveTemplate` | não | Texto do objetivo; `{target}` é substituído |
| `pool` | sim | Lista de alvos; cada um gera uma lição |
| `distractorPool` | não | Reserva extra de opções erradas (útil quando o `pool` é pequeno) |

### Como uma lição é derivada

Para cada item do `pool`, `curriculum-model.ts` cria uma lição:

```jsonc
{
  "id": "alfabeto-a",              // `${unitId}-${slug(target)}`
  "unitId": "alfabeto",
  "unitTitle": "Alfabeto",
  "type": "letter",
  "target": "A",                   // a resposta certa
  "variants": ["A", "a"],          // formas aceitas
  "objective": "Colete a letra A", // já com {target} substituído
  "levelId": "fase-alfabeto-a",    // arquivo de fase correspondente
  "index": 0
}
```

### Regras garantidas por testes

- `id` de unidade e de lição são **únicos**; `levelId` também.
- Alvos que só diferem por acento ganham sufixo (`VOVÔ` → `vovo`, `VOVÓ` → `vovo-2`)
  para não colidirem.
- Um distrator **nunca** normaliza para a resposta certa — ou seja, `VOVÓ` nunca aparece
  como opção errada na lição de `VOVÔ`. Isso é verificado em
  `src/content/curriculum.test.js`.
- Todo `levelId` aponta para um arquivo que existe.

---

## 3. Fase (`src/content/levels/fase-*.json`)

Exemplo real (reduzido) de `fase-alfabeto-a.json`:

```jsonc
{
  "schemaVersion": 1,
  "id": "fase-alfabeto-a",
  "name": "Planície — A",                  // pt-BR, aparece no HUD
  "tileset": "placeholder",
  "viewport": { "width": 960, "height": 540 },
  "tileSize": 32,
  "background": "#9bd3f5",
  "music": null,                           // reservado
  "playerStart": { "x": 96, "y": 406 },
  "checkpoint": { "x": 96, "y": 406 },     // onde reaparece após cair
  "camera": { "startX": 0, "maxX": 960, "smoothing": 0.12 },

  "map": {
    // Uma string por linha. '#' = sólido, '.' = vazio.
    "solid": ["....", "....", "####", "####"],
    // '=' = plataforma de mão única (passa por baixo, pousa em cima).
    "platform": ["....", "..==, ", "..."]
  },

  "items": [
    { "id": "item-alvo",    "type": "target",     "kind": "letter",
      "label": "A", "x": 384, "y": 352, "w": 32, "h": 32 },
    { "id": "item-opcao-1", "type": "distractor", "kind": "letter",
      "label": "B", "x": 1280, "y": 352, "w": 32, "h": 32 }
  ],

  "hazards": [],

  "decorations": []
}
```

### Campos

| Campo | Obrigatório | Descrição |
|---|---|---|
| `id` | sim | Único; é o `levelId` da lição |
| `name` | sim | Nome exibido no HUD (pt-BR) |
| `tileSize` | não | Padrão `32` (px por célula do mapa) |
| `viewport` | não | Padrão `960 × 540` |
| `background` | não | Cor de fundo |
| `playerStart` | sim | Onde o personagem começa |
| `checkpoint` | não | Padrão: igual a `playerStart` |
| `camera.maxX` | não | Padrão: `largura do mundo − viewport` |
| `map.solid` | sim | Linhas de terreno sólido (`#`) |
| `map.platform` | não | Linhas de plataforma de mão única (`=`) |
| `items` | sim | Precisa de **pelo menos um** `type: "target"` |
| `hazards` | não | Perigos que custam coração |
| `decorations` | não | Elementos puramente visuais |

### Como o mapa vira colisão

O `level-loader.ts` converte a grade de caracteres em **retângulos**, agrupando
sequências horizontais contíguas. As três linhas `"########"` viram **um único** retângulo
grande, em vez de 24 quadradinhos. Isso reduz o número de checagens de colisão e evita
arestas internas fantasmas.

O mundo resultante tem `largura = colunas × tileSize` e `altura = linhas × tileSize`
(a fase de exemplo: `60 × 32 = 1920 px` de largura).

### Regras garantidas por testes

- Todas as linhas de uma mesma grade têm o **mesmo comprimento**.
- `map.platform` tem a mesma largura que `map.solid`.
- Ids de itens e perigos são únicos dentro da fase.
- Nenhum item ou perigo sai dos limites do mundo.
- Existe exatamente **1 item do tipo `target`** por fase, e o validador de resposta o aceita.
- Todo distrator é **rejeitado** pelo validador daquela lição.
- A posição inicial é válida dentro do mundo.

Tudo isso roda em `src/content/curriculum.test.js` e `src/content/level-loader.test.js`.

---

## 4. Geração de fases

`tools/generate-levels.mts` monta uma fase por lição combinando:

**Templates de terreno** (alternados entre as lições):

| Template | Característica |
|---|---|
| `planicie` | Chão reto e uma plataforma suspensa |
| `degraus` | Dois patamares elevados |
| `plataformas` | Três plataformas suspensas |
| `rio` | Fenda no chão: exige um pulo para atravessar |

**Itens** (a resposta + até 3 distratores do `pool` da unidade), com a posição da resposta
variando entre as lições para que ela nunca fique sempre no mesmo lugar.

Antes de gravar, o gerador roda `loadLevel()` no resultado: se o conteúdo estiver
malformado, a geração **falha ali**, e não dentro do jogo.

```bash
npm run generate:levels
# Geradas 152 fases em src/content/levels/ (a partir de 16 unidades).
```

> As fases geradas são **versionadas** no repositório, para que o jogo funcione sem passo
> de build extra. O gerador apaga as fases antigas antes de escrever, evitando arquivos órfãos.

---

## 5. Persistência

### Documento único e versionado

Chave: `joguinho.sobrinhos.v1` (prefixo + versão do schema).

```jsonc
{
  "schemaVersion": 1,
  "activeProfileId": "p-3f9a2c81",
  "profiles": {
    "p-3f9a2c81": {
      "id": "p-3f9a2c81",
      "name": "Bia",
      "characterId": "char-lua",
      "createdAt": 1757000000000,
      "progress": {
        "letra-a": { "completed": true, "stars": 3, "mistakes": 0, "updatedAt": 1757000001000 },
        "letra-b": { "completed": true, "stars": 2, "mistakes": 1, "updatedAt": 1757000002000 }
      },
      "stats": { "correct": 42, "wrong": 5 }
    }
  },
  "updatedAt": 1757000002000
}
```

### Regras

- **Um perfil por criança.** Cada um tem progresso e estatísticas independentes.
- **Melhor resultado é mantido**: refazer uma fase pior nunca diminui as estrelas.
- **Estrelas**: 0 erros → 3, 1 erro → 2, 2+ erros → 1.
- **Liberação sequencial**: as fases concluídas mais a próxima.

### Robustez

| Situação | Comportamento |
|---|---|
| Nada salvo ainda | Documento vazio, tratado como **primeira execução** (não é erro) |
| Save de uma versão antiga (v0) | Migrado para v1 preservando nome, personagem e progresso |
| Save de uma versão **futura** | Descartado; o jogo começa do zero |
| JSON corrompido | Documento novo + cópia do original em `…v1.degraded` |
| `localStorage` indisponível | Adaptador em memória: o jogo roda, só não salva |

A escada de migração fica em `src/persistence/migration.ts`. Acrescentar uma versão nova é
acrescentar um passo à escada — de novo, Aberto/Fechado.

---

## 6. Fluxo: adicionar uma palavra nova

Nenhuma linha de código:

1. Abra `src/content/curriculum.json`.
2. Acrescente a palavra ao `pool` da unidade desejada:
   ```jsonc
   { "id": "palavras-dissilabas", "pool": ["BOLA", "CASA", "TREM", "PIPA"] }
   ```
3. Rode `npm run generate:levels`.
4. Rode `npm test` — os testes confirmam que a fase existe, tem exatamente 1 alvo e que
   os distratores são rejeitados.
5. Pronto: a lição já aparece no menu e no fluxo de liberação.

---

## 7. Palavras de referência das letras

`src/content/letter-reference-words.json` é um objeto plano com as chaves `A`–`Z` e uma
palavra fixa por letra (grafia correta, com acentos, em minúsculas): `"A": "avião"`,
`"X": "xícara"`, … `src/content/letter-reference.ts` expõe `getLetterReferenceWord(target)`,
que consulta o mapa após `trim`, NFC e maiúsculas. Letras acentuadas, símbolos e alvos com
mais de uma letra não têm entrada e retornam `undefined` — a narração usa então a frase sem
complemento. O narrador (`SpeechNarrator.speakLessonTarget`) é o único consumidor.

Trocar uma palavra é editar o JSON; os testes exigem as 26 chaves e que cada palavra comece
com a própria letra.

---

## 8. Personagens

`src/content/characters.ts` define os 4 personagens (id, nome, cores). É dado puro: o
desenho do jogador lê as cores de lá, então **acrescentar um personagem é acrescentar uma
entrada na lista**.
