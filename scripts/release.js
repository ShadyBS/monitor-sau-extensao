#!/usr/bin/env node

/**
 * Script de Release para Monitor SAU Extension
 * Automatiza o processo de release no GitHub com validações de segurança
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { ExtensionBuilder } = require('./build.js');
const { VersionManager } = require('./version.js');

class ReleaseError extends Error {
  constructor(message, code = 'RELEASE_ERROR') {
    super(message);
    this.name = 'ReleaseError';
    this.code = code;
  }
}

class ReleaseManager {
  constructor() {
    this.rootDir = process.cwd();
    this.distDir = path.join(this.rootDir, '.dist');
    this.changelogPath = path.join(this.rootDir, 'CHANGELOG.md');
  }

  /**
   * Valida se o ambiente está pronto para release
   */
  async validateEnvironment() {
    console.log('🔍 Validando ambiente de release...');
    
    // Verifica se está em um repositório Git
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    } catch (error) {
      throw new ReleaseError(
        'Não está em um repositório Git',
        'NOT_GIT_REPO'
      );
    }
    
    // Verifica se há mudanças não commitadas
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        throw new ReleaseError(
          'Há mudanças não commitadas. Faça commit antes do release.',
          'UNCOMMITTED_CHANGES'
        );
      }
    } catch (error) {
      if (error instanceof ReleaseError) throw error;
      throw new ReleaseError(
        'Erro ao verificar status do Git',
        'GIT_STATUS_ERROR'
      );
    }
    
    // Verifica se GitHub CLI está instalado
    try {
      execSync('gh --version', { stdio: 'ignore' });
    } catch (error) {
      throw new ReleaseError(
        'GitHub CLI (gh) não está instalado. Instale em: https://cli.github.com/',
        'GH_CLI_NOT_FOUND'
      );
    }
    
    // Verifica se está autenticado no GitHub
    try {
      execSync('gh auth status', { stdio: 'ignore' });
    } catch (error) {
      throw new ReleaseError(
        'Não está autenticado no GitHub. Execute: gh auth login',
        'GH_NOT_AUTHENTICATED'
      );
    }
    
    console.log('✅ Ambiente validado');
  }

  /**
   * Valida se o CHANGELOG foi atualizado
   */
  async validateChangelog() {
    console.log('🔍 Validando CHANGELOG...');
    
    try {
      const changelogContent = await fs.readFile(this.changelogPath, 'utf8');
      
      // Verifica se há seção [Unreleased] com conteúdo
      const unreleasedMatch = changelogContent.match(/## \[Unreleased\](.*?)(?=## \[|$)/s);
      
      if (!unreleasedMatch) {
        throw new ReleaseError(
          'Seção [Unreleased] não encontrada no CHANGELOG.md',
          'NO_UNRELEASED_SECTION'
        );
      }
      
      const unreleasedContent = unreleasedMatch[1].trim();
      
      // Verifica se há conteúdo além dos cabeçalhos padrão
      const hasContent = unreleasedContent.includes('### Added') ||
                        unreleasedContent.includes('### Changed') ||
                        unreleasedContent.includes('### Fixed') ||
                        unreleasedContent.includes('### Removed');
      
      if (!hasContent || unreleasedContent.length < 50) {
        throw new ReleaseError(
          'CHANGELOG.md não foi atualizado com as mudanças desta versão',
          'CHANGELOG_NOT_UPDATED'
        );
      }
      
      console.log('✅ CHANGELOG validado');
      return unreleasedContent;
      
    } catch (error) {
      if (error instanceof ReleaseError) throw error;
      throw new ReleaseError(
        `Erro ao validar CHANGELOG: ${error.message}`,
        'CHANGELOG_READ_ERROR'
      );
    }
  }

  /**
   * Atualiza CHANGELOG movendo [Unreleased] para versão específica
   */
  async updateChangelog(version) {
    console.log('📝 Atualizando CHANGELOG...');
    
    try {
      const changelogContent = await fs.readFile(this.changelogPath, 'utf8');
      const today = new Date().toISOString().split('T')[0];
      
      // Substitui [Unreleased] pela versão e data
      const updatedContent = changelogContent.replace(
        /## \[Unreleased\]/,
        `## [Unreleased]\n\n## [${version}] - ${today}`
      );
      
      await fs.writeFile(this.changelogPath, updatedContent, 'utf8');
      console.log('✅ CHANGELOG atualizado');
      
    } catch (error) {
      throw new ReleaseError(
        `Erro ao atualizar CHANGELOG: ${error.message}`,
        'CHANGELOG_UPDATE_ERROR'
      );
    }
  }

  /**
   * Extrai notas de release do CHANGELOG
   */
  async extractReleaseNotes(version) {
    try {
      const changelogContent = await fs.readFile(this.changelogPath, 'utf8');
      
      // Procura pela seção da versão
      const versionRegex = new RegExp(`## \\[${version}\\] - \\d{4}-\\d{2}-\\d{2}(.*?)(?=## \\[|$)`, 's');
      const match = changelogContent.match(versionRegex);
      
      if (!match) {
        return `Release ${version}\n\nVeja CHANGELOG.md para detalhes das mudanças.`;
      }
      
      return match[1].trim();
      
    } catch (error) {
      console.warn('⚠️  Não foi possível extrair notas de release do CHANGELOG');
      return `Release ${version}\n\nVeja CHANGELOG.md para detalhes das mudanças.`;
    }
  }

  /**
   * Cria tag Git
   */
  async createGitTag(version) {
    console.log(`🏷️  Criando tag v${version}...`);
    
    try {
      execSync(`git add .`, { stdio: 'ignore' });
      execSync(`git commit -m "chore(release): v${version}"`, { stdio: 'ignore' });
      execSync(`git tag -a v${version} -m "Release v${version}"`, { stdio: 'ignore' });
      
      console.log('✅ Tag criada');
      
    } catch (error) {
      throw new ReleaseError(
        `Erro ao criar tag Git: ${error.message}`,
        'GIT_TAG_ERROR'
      );
    }
  }

  /**
   * Faz push das mudanças e tags
   */
  async pushChanges() {
    console.log('📤 Fazendo push das mudanças...');
    
    try {
      execSync('git push', { stdio: 'ignore' });
      execSync('git push --tags', { stdio: 'ignore' });
      
      console.log('✅ Mudanças enviadas');
      
    } catch (error) {
      throw new ReleaseError(
        `Erro ao fazer push: ${error.message}`,
        'GIT_PUSH_ERROR'
      );
    }
  }

  /**
   * Cria release no GitHub
   */
  async createGitHubRelease(version, releaseNotes, zipFiles) {
    console.log('🚀 Criando release no GitHub...');
    
    try {
      // Prepara comando do GitHub CLI
      const releaseNotesFile = path.join(this.distDir, 'release-notes.md');
      await fs.writeFile(releaseNotesFile, releaseNotes, 'utf8');
      
      // Verifica se o release já existe
      let releaseExists = false;
      try {
        execSync(`gh release view v${version}`, { stdio: 'ignore' });
        releaseExists = true;
        console.log('ℹ️  Release já existe, atualizando...');
      } catch (error) {
        // Release não existe, será criado
      }
      
      if (releaseExists) {
        // Atualiza release existente apenas com assets
        console.log('📎 Adicionando assets ao release existente...');
        for (const zipFile of zipFiles) {
          try {
            execSync(`gh release upload v${version} "${zipFile.zipPath}" --clobber`, { stdio: 'inherit' });
          } catch (error) {
            console.warn(`⚠️  Falha ao fazer upload de ${zipFile.zipName}: ${error.message}`);
          }
        }
      } else {
        // Cria novo release
        console.log('🆕 Criando novo release...');
        
        // Primeiro cria o release sem assets para permitir que GitHub Actions também faça upload
        let command = `gh release create v${version} --title "v${version}" --notes-file "${releaseNotesFile}"`;
        execSync(command, { stdio: 'inherit' });
        
        // Opcionalmente adiciona os assets (GitHub Actions pode fazer isso também)
        console.log('📎 Assets serão adicionados pelo GitHub Actions...');
        console.log('   (ou execute: gh release upload v' + version + ' <arquivo>)');
      }
      
      // Remove arquivo temporário
      await fs.unlink(releaseNotesFile);
      
      console.log('✅ Release processado no GitHub');
      
    } catch (error) {
      throw new ReleaseError(
        `Erro ao criar release no GitHub: ${error.message}`,
        'GITHUB_RELEASE_ERROR'
      );
    }
  }

  /**
   * Executa processo completo de release
   */
  async release(options = {}) {
    try {
      console.log('🚀 Iniciando processo de release...\n');
      
      // Validações iniciais
      await this.validateEnvironment();
      
      // Obtém versão atual
      const versionManager = new VersionManager();
      const currentVersion = await versionManager.getCurrentVersion();
      
      console.log(`📦 Versão para release: v${currentVersion}\n`);
      
      // Valida CHANGELOG
      await this.validateChangelog();
      
      // Limpa e constrói
      console.log('🧹 Limpando diretório de distribuição...');
      await fs.rm(this.distDir, { recursive: true, force: true });
      
      const builder = new ExtensionBuilder();
      const zipFiles = await builder.build();
      
      // Atualiza CHANGELOG
      await this.updateChangelog(currentVersion);
      
      // Extrai notas de release
      const releaseNotes = await this.extractReleaseNotes(currentVersion);
      
      // Confirma com o usuário (em ambiente interativo)
      if (process.stdin.isTTY && !options.autoConfirm) {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        console.log('\n📋 Resumo do Release:');
        console.log(`   Versão: v${currentVersion}`);
        console.log(`   Arquivos: ${zipFiles.map(f => f.zipName).join(', ')}`);
        console.log('\n📝 Notas de Release:');
        console.log(releaseNotes.split('\n').map(line => `   ${line}`).join('\n'));
        
        const answer = await new Promise(resolve => {
          rl.question('\nConfirma o release? (y/N): ', resolve);
        });
        
        rl.close();
        
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('❌ Release cancelado pelo usuário');
          return null;
        }
      }
      
      // Cria tag e faz push
      await this.createGitTag(currentVersion);
      await this.pushChanges();
      
      // Cria release no GitHub
      await this.createGitHubRelease(currentVersion, releaseNotes, zipFiles);
      
      console.log('\n🎉 Release concluído com sucesso!');
      console.log(`\n🔗 Acesse: https://github.com/yourusername/monitor-sau-extensao/releases/tag/v${currentVersion}`);
      
      return {
        version: currentVersion,
        zipFiles,
        releaseNotes
      };
      
    } catch (error) {
      console.error('\n❌ Erro durante o release:');
      console.error(`   ${error.message}`);
      
      if (error.code) {
        console.error(`   Código: ${error.code}`);
      }
      
      console.error('\n🔧 Possíveis soluções:');
      
      switch (error.code) {
        case 'NOT_GIT_REPO':
          console.error('   - Execute git init para inicializar repositório');
          break;
        case 'UNCOMMITTED_CHANGES':
          console.error('   - Execute git add . && git commit -m "suas mudanças"');
          break;
        case 'GH_CLI_NOT_FOUND':
          console.error('   - Instale GitHub CLI: https://cli.github.com/');
          break;
        case 'GH_NOT_AUTHENTICATED':
          console.error('   - Execute gh auth login');
          break;
        case 'CHANGELOG_NOT_UPDATED':
          console.error('   - Atualize CHANGELOG.md com as mudanças desta versão');
          break;
      }
      
      process.exit(1);
    }
  }
}

// Execução principal
async function main() {
  const args = process.argv.slice(2);
  const autoConfirm = args.includes('--auto-confirm') || args.includes('-y');
  
  const releaseManager = new ReleaseManager();
  await releaseManager.release({ autoConfirm });
}

// Executa apenas se chamado diretamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erro fatal:', error.message);
    process.exit(1);
  });
}

module.exports = { ReleaseManager, ReleaseError };