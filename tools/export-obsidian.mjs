import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const defaultVaultPath =
  "/Users/renatobezerra/Library/Mobile Documents/com~apple~CloudDocs/Obsidian/My Knowledge Base";

const vaultPath = process.env.OBSIDIAN_VAULT_PATH || defaultVaultPath;
const targetDir = path.join(vaultPath, "Projetos", "Aventura Nicolas e Eloa");
const docsDir = path.join(projectRoot, "docs");

const projectFiles = [
  ["AGENTS.md", "AGENTS.md"],
  ["README.md", "README do projeto.md"],
  ["DESIGN.md", "DESIGN.md"],
  ["aventura-surpresa.md", "Aventura surpresa.md"],
];

async function copyProjectFiles() {
  await mkdir(targetDir, { recursive: true });

  for (const [sourceName, targetName] of projectFiles) {
    await cp(path.join(projectRoot, sourceName), path.join(targetDir, targetName));
  }
}

async function copyDocs() {
  const entries = await readdir(docsDir, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  for (const fileName of markdownFiles) {
    const targetName = fileName === "README.md" ? "README da documentacao.md" : fileName;
    await cp(path.join(docsDir, fileName), path.join(targetDir, targetName));
  }

  return markdownFiles;
}

function linkFor(fileName) {
  const noteName = fileName.replace(/\.md$/, "");
  return `[[${noteName}]]`;
}

function buildIndex(markdownFiles) {
  const orderedDocs = markdownFiles
    .filter((fileName) => fileName !== "README.md")
    .map((fileName) => `- ${linkFor(fileName)}`)
    .join("\n");

  const updatedAt = new Date().toISOString();

  return `# Aventura Nicolas e Eloa

Projeto: jogo educativo de alfabetizacao em plataforma 2D, com modos Explorar, Aprender e Corrida.

Fonte do projeto:
\`${projectRoot}\`

Ultima exportacao: ${updatedAt}

## Entrada rapida

- [[README do projeto]]
- [[README da documentacao]]
- [[DESIGN]]
- [[15-plano-melhorias-pos-streaming]]
- [[14-plano-app-android-capacitor]]

## Documentacao

${orderedDocs}

## Codigo e manutencao

- Comando de exportacao: \`npm run export:obsidian\`
- Para usar outro vault: \`OBSIDIAN_VAULT_PATH="/caminho/do/vault" npm run export:obsidian\`
- O codigo continua sendo a fonte principal; esta pasta e uma copia para leitura, conexoes e planejamento no Obsidian.
`;
}

async function main() {
  await copyProjectFiles();
  const markdownFiles = await copyDocs();
  await writeFile(path.join(targetDir, "Aventura Nicolas e Eloa.md"), buildIndex(markdownFiles));

  console.log(`Exported Obsidian notes to: ${targetDir}`);
  console.log(`Copied ${markdownFiles.length + projectFiles.length + 1} markdown files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
