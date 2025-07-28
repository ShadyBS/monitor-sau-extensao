const fs = require("fs");
const path = require("path");

// Define os caminhos para os arquivos necessários
const CHANGELOG_PATH = path.join(__dirname, "..", "CHANGELOG.md");
const PACKAGE_JSON_PATH = path.join(__dirname, "..", "package.json");

// Cores para o console para melhor feedback visual
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  reset: "\x1b[0m",
};

/**
 * Retorna a data atual no formato YYYY-MM-DD.
 * @returns {string} A data formatada.
 */
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Exibe uma mensagem de erro formatada e encerra o processo.
 * @param {string} primaryMessage - A mensagem de erro principal.
 * @param {string} secondaryMessage - A mensagem de instrução ou sugestão.
 */
function exitWithError(primaryMessage, secondaryMessage) {
  console.error(`${colors.red}Erro: ${primaryMessage}${colors.reset}`);
  if (secondaryMessage) {
    console.error(`${colors.yellow}${secondaryMessage}${colors.reset}`);
  }
  process.exit(1);
}

/**
 * Função principal que executa a lógica do script.
 */
function updateChangelog() {
  try {
    // 1. Ler o package.json para obter a versão atual
    if (!fs.existsSync(PACKAGE_JSON_PATH)) {
      exitWithError("O arquivo package.json não foi encontrado.");
    }
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
    const newVersion = packageJson.version;

    if (!newVersion) {
      exitWithError("A versão não foi encontrada no package.json.");
    }

    // 2. Ler o CHANGELOG.md
    if (!fs.existsSync(CHANGELOG_PATH)) {
      exitWithError("O arquivo CHANGELOG.md não foi encontrado.");
    }
    let changelogContent = fs.readFileSync(CHANGELOG_PATH, "utf-8");

    // 3. Verificar se a versão do package.json já existe no changelog
    const versionRegex = new RegExp(`^## \\[${newVersion}\\]`, "m");
    if (versionRegex.test(changelogContent)) {
      exitWithError(
        `A versão ${newVersion} já existe no CHANGELOG.md.`,
        'Incremente a versão usando "npm run version:patch", "npm run version:minor" ou "npm run version:major" antes de continuar.'
      );
    }

    // 4. Encontrar e extrair o conteúdo da seção [Unreleased]
    const unreleasedRegex =
      /^## \[Unreleased\]([\s\S]*?)(?=^## \[\d+\.\d+\.\d+\])/m;
    const unreleasedMatch = changelogContent.match(unreleasedRegex);

    if (!unreleasedMatch || !unreleasedMatch[1] || !unreleasedMatch[1].trim()) {
      exitWithError(
        "A seção [Unreleased] não foi encontrada ou está vazia no CHANGELOG.md.",
        "Adicione as notas da versão na seção [Unreleased] antes de executar este script."
      );
    }

    const unreleasedNotes = unreleasedMatch[1].trim();

    // 5. Preparar a nova entrada de versão
    const newVersionHeader = `## [${newVersion}] - ${getCurrentDate()}`;
    const newVersionEntry = `${newVersionHeader}\n\n${unreleasedNotes}`;

    // 6. Substituir a seção [Unreleased] antiga pela nova estrutura
    // A nova estrutura contém uma seção [Unreleased] limpa, seguida pela nova entrada de versão.
    const cleanUnreleasedSection = "## [Unreleased]";
    const updatedContent = changelogContent.replace(
      unreleasedMatch[0],
      `${cleanUnreleasedSection}\n\n${newVersionEntry}`
    );

    // 7. Salvar o arquivo CHANGELOG.md atualizado
    fs.writeFileSync(CHANGELOG_PATH, updatedContent, "utf-8");

    console.log(
      `${colors.green}CHANGELOG.md foi atualizado com sucesso para a versão ${newVersion}.${colors.reset}`
    );
    console.log(
      `${colors.yellow}Por favor, revise as alterações e faça o commit do arquivo.${colors.reset}`
    );
  } catch (error) {
    exitWithError(
      `Ocorreu um erro inesperado ao processar o changelog: ${error.message}`
    );
  }
}

// Executa a função principal
updateChangelog();
