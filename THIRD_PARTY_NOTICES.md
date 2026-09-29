# Avisos de terceiros

Este projeto inclui recursos de terceiros. Cada entrada registra origem, revisão, destino,
formato, modificações e licença. Os procedimentos de importação estão em
[docs/21](docs/21-plano-importacao-recursos-aventura-das-letras.md).

## Aventura das Letras

- Projeto: [samarameneses/aventura-das-letras](https://github.com/samarameneses/aventura-das-letras)
- Autoria: Copyright (c) 2026 Sa-Meneses and contributors
- Licença: MIT — texto integral em
  [`public/licenses/aventura-das-letras-MIT.txt`](public/licenses/aventura-das-letras-MIT.txt),
  distribuído junto do build em `/licenses/aventura-das-letras-MIT.txt`.
- O [aviso de terceiros original](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/THIRD_PARTY_NOTICES.md)
  declara código, conteúdo pedagógico, efeitos próprios e gráficos sob essa licença MIT.

### Efeitos sonoros

Revisão `bbcd9eb37244f54c4b011081977f254da4f62d82`, importados em 28/09/2026 sem
modificação (WAV PCM, mono, 22.050 Hz, 16 bits; mesmo formato na origem e no destino).

| Origem | Destino | Bytes | SHA-256 |
| --- | --- | --- | --- |
| [`game/audio/answer_success.wav`](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/audio/answer_success.wav) | `public/assets/audio/sfx/answer_success.wav` | 18.564 | `738b6d1c1da6272cf1896e1bbc540fabd550457db3cae677e8f14fd072466c83` |
| [`game/audio/answer_error.wav`](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/audio/answer_error.wav) | `public/assets/audio/sfx/answer_error.wav` | 12.392 | `6e6c05dc97025aec21f53899aaaa4a434de25a07514053cd395cb0af5f43b1f7` |

O volume é ajustado em tempo de execução (`src/audio/sfx-catalog.ts`); os arquivos não
foram reprocessados.

### Cenários, itens e objetos

Derivados WebP de PNG da pasta
[`game/art/`](https://github.com/samarameneses/aventura-das-letras/tree/bbcd9eb37244f54c4b011081977f254da4f62d82/game/art),
redimensionados e convertidos para WebP no commit `90d0194`.
Equivalência identificada por nome e catálogo (`src/render/asset-plan.ts`), sem comparação
pixel a pixel; a revisão exata da origem e o hash dos PNG usados não foram registrados na
época.

| Origem em `game/art/` | Destino | SHA-256 do derivado |
| --- | --- | --- |
| `garden.png` | `public/assets/backgrounds/garden-pixel-v1.webp` | `9fed0fb069bd25d31f146eb2cb047714474f3777249dee0a15109bfbb584f79d` |
| `primavera-pomar.png` | `public/assets/backgrounds/primavera-pomar-pixel-v1.webp` | `04f9408e7a493009032669ceed8688d3c280b6197aaff75e06400dacf3aacc63` |
| `primavera-lago.png` | `public/assets/backgrounds/primavera-lago-pixel-v1.webp` | `c6cd9cba5dabb7813680e07dc1877d04fe111a38a9e07eb75d4d0d91153262d3` |
| `outono-bosque.png` | `public/assets/backgrounds/outono-bosque-pixel-v1.webp` | `609caeb956a8a7f89c9969867efce6137c2dbe042630a5383629696bf66a3749` |
| `outono-vale.png` | `public/assets/backgrounds/outono-vale-pixel-v1.webp` | `fb7a2608c7e36dcaad40e405433c1e2d30e163fb7dd93a3dead90f7ea2eefe87` |
| `letter.png` | `public/assets/items/letter-carrier-pixel-v1.webp` | `e9092ebd451841a5655537f52a602fed43de96d3bd8ee664f205892373d05607` |
| `checkpoint.png` | `public/assets/objects/checkpoint-pixel-v1.webp` | `5518d72442b5e2d2dcbfce89ad6be117a268444e07cb4409fe6c3bcb7e345ba6` |
| `finish.png` | `public/assets/objects/finish-portal-pixel-v1.webp` | `aa3e6dffef1bfcd1c66f739be1042002747b31d1451bbed8a24ee177a4b25892` |

### Textura do chão

Revisão `bbcd9eb37244f54c4b011081977f254da4f62d82`, importada em 28/09/2026.

| Origem | Destino | Formato | SHA-256 |
| --- | --- | --- | --- |
| [`game/art/grass.png`](https://github.com/samarameneses/aventura-das-letras/blob/bbcd9eb37244f54c4b011081977f254da4f62d82/game/art/grass.png) | — (original, não distribuído) | PNG RGB 1254×1254, 939.893 bytes | `8148b3f45d38009305fb5d8b8d198c15d68bac620fda64e3870f7fd306b2331e` |
| derivado | `public/assets/terrain/grass-pixel-v1.webp` | WebP sem perdas 40×40, 1.580 bytes | `6aad39c779fd9e13bbf21239f01b46fa146830d181f2cbd37bd6431959bbf611` |

Modificação: redução para a resolução nativa da pixel art. O original é uma grade de
40×40 blocos ampliada (~31,35 px por bloco); o derivado toma a cor do centro de cada
bloco, após conferir que cada bloco é uniforme. Nenhuma cor foi alterada.

A arte dos personagens e retratos de Nicolas e Eloá é própria deste projeto e não faz parte
desta importação.
