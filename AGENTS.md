# Instrucoes para agentes LLM

Este projeto pode ser usado junto com um vault do Obsidian. Use este arquivo como contrato de trabalho ao abrir o projeto em uma LLM/coding agent.

## Fonte de verdade

- O codigo, testes e documentacao versionada vivem neste repositorio.
- A pasta `docs/` e a fonte oficial para arquitetura, gameplay, planos e decisoes tecnicas ja consolidadas.
- O Obsidian e a camada de trabalho: notas de raciocinio, decisoes em andamento, backlog pessoal, diario de implementacao e conexoes entre ideias.
- Nao trate uma nota do Obsidian como mais atual que o codigo sem verificar os arquivos do repositorio.

## Vault do Obsidian

Vault padrao:

```text
/Users/renatobezerra/Library/Mobile Documents/com~apple~CloudDocs/Obsidian/My Knowledge Base
```

Pasta exportada do projeto:

```text
Projetos/Aventura Nicolas e Eloa
```

Comando para atualizar a copia dos documentos no Obsidian:

```bash
npm run export:obsidian
```

## Como interagir com o Obsidian

Ao trabalhar com o projeto:

1. Leia primeiro os arquivos relevantes do repositorio, especialmente `README.md`, `DESIGN.md`, `docs/README.md` e o documento especifico da tarefa.
2. Use o Obsidian para registrar contexto que nao deve virar codigo imediatamente: duvidas, decisoes, hipoteses, diario de progresso, ideias futuras e resumo de conversas.
3. Se uma decisao tecnica ficar consolidada, atualize a documentacao em `docs/` e depois rode `npm run export:obsidian`.
4. Se a informacao for apenas pessoal, exploratoria ou temporaria, mantenha somente no Obsidian.
5. Nao copie codigo-fonte inteiro para o Obsidian; prefira links, nomes de arquivos, trechos curtos e resumos.

## Sugestao de notas no Obsidian

- `Aventura Nicolas e Eloa.md`: indice principal.
- `Diario - Aventura Nicolas e Eloa.md`: registro cronologico do que foi feito e decidido.
- `Backlog - Aventura Nicolas e Eloa.md`: lista de proximas tarefas.
- `Decisoes - Aventura Nicolas e Eloa.md`: decisoes importantes, com data e motivacao.
- `Perguntas - Aventura Nicolas e Eloa.md`: pontos a confirmar com testes, aparelho real ou pesquisa externa.

## Rotina recomendada

Antes de uma mudanca:

- Identifique o documento tecnico relacionado.
- Confira se existe nota do Obsidian com contexto adicional.
- Transforme a intencao em uma tarefa pequena e verificavel.

Depois de uma mudanca:

- Rode verificacoes pertinentes, como `npm test`, `npm run typecheck` e `npm run build`.
- Atualize `docs/` quando o comportamento oficial mudar.
- Rode `npm run export:obsidian`.
- Registre no diario do Obsidian o que mudou, quais comandos passaram e o que ficou pendente.

## Limites importantes

- Nao altere arquivos do Obsidian sem o usuario pedir ou sem ficar claro que a tarefa envolve o vault.
- Nao apague notas do Obsidian automaticamente.
- Nao use o Obsidian para substituir testes, documentacao versionada ou controle de versao.
- Ao encontrar divergencia entre codigo, docs e Obsidian, aponte a divergencia e priorize verificar o codigo.
