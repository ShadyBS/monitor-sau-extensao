#!/usr/bin/env node

/**
 * Script de Build para Monitor SAU Extension
 * Gera ZIPs otimizados para Chrome e Firefox
 */

const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const { execSync } = require('child_process');

// Configurações
const CONFIG = {
  distDir: '.dist',
  sourceFiles: [
    'background.js',
    'content.js',
    'interceptor.js',
    'logger.js',
    'sanitizer.js',
    'tooltip-system.js',
    'config-manager.js',
    'popup.html',
    'popup.js',
    'popup.css',
    'options.html',
    'options.js',
    'options.css',
    'help.html',
    'help.js',
    'help.css',
    'notification-ui.css',
    'css-variables.css',
    'styles.css',
    'icons/',
    'README.md',
    'CHANGELOG.md'
  ],
  browsers: {
    chrome: {
      manifest: 'manifest.json',
      zipName: 'monitor-sau-chrome.zip'
    },
    firefox: {
      manifest: 'manifest-firefox.json',
      zipName: 'monitor-sau-firefox.zip'
    }
  }
};

class BuildError extends Error {
  constructor(message, code = 'BUILD_ERROR') {
    super(message);
    this.name = 'BuildError';
    this.code = code;
  }
}

class ExtensionBuilder {
  constructor() {
    this.rootDir = process.cwd();
    this.distDir = path.join(this.rootDir, CONFIG.distDir);
  }

  /**
   * Valida se todos os arquivos necessários existem
   */
  async validateSourceFiles() {
    console.log('🔍 Validando arquivos de origem...');
    
    const missingFiles = [];
    
    for (const file of CONFIG.sourceFiles) {
      const filePath = path.join(this.rootDir, file);
      try {
        await fs.access(filePath);
      } catch (error) {
        missingFiles.push(file);
      }
    }
    
    if (missingFiles.length > 0) {
      throw new BuildError(
        `Arquivos obrigatórios não encontrados: ${missingFiles.join(', ')}`,
        'MISSING_FILES'
      );
    }
    
    console.log('✅ Todos os arquivos de origem encontrados');
  }

  /**
   * Valida manifests
   */
  async validateManifests() {
    console.log('🔍 Validando manifests...');
    
    for (const [browser, config] of Object.entries(CONFIG.browsers)) {
      const manifestPath = path.join(this.rootDir, config.manifest);
      
      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestContent);
        
        // Validações básicas
        if (!manifest.name || !manifest.version || !manifest.description) {
          throw new BuildError(
            `Manifest ${config.manifest} está incompleto`,
            'INVALID_MANIFEST'
          );
        }
        
        // Validação específica do Firefox
        if (browser === 'firefox' && !manifest.browser_specific_settings?.gecko?.id) {
          throw new BuildError(
            'Manifest do Firefox deve ter browser_specific_settings.gecko.id',
            'INVALID_FIREFOX_MANIFEST'
          );
        }
        
        console.log(`✅ Manifest ${config.manifest} válido (v${manifest.version})`);
        
      } catch (error) {
        if (error instanceof BuildError) throw error;
        throw new BuildError(
          `Erro ao validar manifest ${config.manifest}: ${error.message}`,
          'MANIFEST_PARSE_ERROR'
        );
      }
    }
  }

  /**
   * Limpa e cria diretório de distribuição
   */
  async prepareDist() {
    console.log('🧹 Preparando diretório de distribuição...');
    
    try {
      // Remove diretório existente
      await fs.rm(this.distDir, { recursive: true, force: true });
      
      // Cria novo diretório
      await fs.mkdir(this.distDir, { recursive: true });
      
      console.log('✅ Diretório .dist preparado');
    } catch (error) {
      throw new BuildError(
        `Erro ao preparar diretório de distribuição: ${error.message}`,
        'DIST_PREP_ERROR'
      );
    }
  }

  /**
   * Copia arquivos para um diretório temporário
   */
  async copyFiles(tempDir, browser) {
    console.log(`📁 Copiando arquivos para ${browser}...`);
    
    try {
      await fs.mkdir(tempDir, { recursive: true });
      
      // Copia arquivos de origem
      for (const file of CONFIG.sourceFiles) {
        const sourcePath = path.join(this.rootDir, file);
        const destPath = path.join(tempDir, file);
        
        const stat = await fs.stat(sourcePath);
        
        if (stat.isDirectory()) {
          // Copia diretório recursivamente
          await this.copyDirectory(sourcePath, destPath);
        } else {
          // Copia arquivo
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.copyFile(sourcePath, destPath);
        }
      }
      
      // Copia manifest específico do browser
      const manifestSource = path.join(this.rootDir, CONFIG.browsers[browser].manifest);
      const manifestDest = path.join(tempDir, 'manifest.json');
      await fs.copyFile(manifestSource, manifestDest);
      
      console.log(`✅ Arquivos copiados para ${browser}`);
      
    } catch (error) {
      throw new BuildError(
        `Erro ao copiar arquivos para ${browser}: ${error.message}`,
        'COPY_ERROR'
      );
    }
  }

  /**
   * Copia diretório recursivamente
   */
  async copyDirectory(source, dest) {
    await fs.mkdir(dest, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  /**
   * Cria ZIP para um browser específico
   */
  async createZip(browser) {
    console.log(`📦 Criando ZIP para ${browser}...`);
    
    const tempDir = path.join(this.distDir, `temp-${browser}`);
    const zipPath = path.join(this.distDir, CONFIG.browsers[browser].zipName);
    
    try {
      // Copia arquivos para diretório temporário
      await this.copyFiles(tempDir, browser);
      
      // Cria ZIP
      await this.createArchive(tempDir, zipPath);
      
      // Remove diretório temporário
      await fs.rm(tempDir, { recursive: true, force: true });
      
      // Verifica tamanho do ZIP
      const stats = await fs.stat(zipPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      console.log(`✅ ZIP criado: ${CONFIG.browsers[browser].zipName} (${sizeMB} MB)`);
      
      return {
        browser,
        zipPath,
        zipName: CONFIG.browsers[browser].zipName,
        size: stats.size,
        sizeMB
      };
      
    } catch (error) {
      // Limpa diretório temporário em caso de erro
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      
      throw new BuildError(
        `Erro ao criar ZIP para ${browser}: ${error.message}`,
        'ZIP_ERROR'
      );
    }
  }

  /**
   * Cria arquivo ZIP usando archiver
   */
  async createArchive(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Máxima compressão
      });

      output.on('close', () => {
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  /**
   * Executa build para browsers específicos ou todos
   */
  async build(browsers = null) {
    try {
      console.log('🚀 Iniciando build da extensão...\n');
      
      // Validações
      await this.validateSourceFiles();
      await this.validateManifests();
      
      // Prepara diretório
      await this.prepareDist();
      
      // Determina quais browsers buildar
      const targetBrowsers = browsers || Object.keys(CONFIG.browsers);
      
      const results = [];
      
      // Cria ZIPs para cada browser
      for (const browser of targetBrowsers) {
        if (!CONFIG.browsers[browser]) {
          throw new BuildError(
            `Browser não suportado: ${browser}`,
            'UNSUPPORTED_BROWSER'
          );
        }
        
        const result = await this.createZip(browser);
        results.push(result);
      }
      
      // Resumo
      console.log('\n🎉 Build concluído com sucesso!');
      console.log('\n📊 Resumo:');
      
      for (const result of results) {
        console.log(`  ${result.browser}: ${result.zipName} (${result.sizeMB} MB)`);
      }
      
      return results;
      
    } catch (error) {
      console.error('\n❌ Erro durante o build:');
      console.error(`   ${error.message}`);
      
      if (error.code) {
        console.error(`   Código: ${error.code}`);
      }
      
      process.exit(1);
    }
  }
}

// Execução principal
async function main() {
  const args = process.argv.slice(2);
  const browserArg = args.find(arg => arg.startsWith('--browser='));
  
  let browsers = null;
  
  if (browserArg) {
    const browser = browserArg.split('=')[1];
    browsers = [browser];
  }
  
  const builder = new ExtensionBuilder();
  await builder.build(browsers);
}

// Executa apenas se chamado diretamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erro fatal:', error.message);
    process.exit(1);
  });
}

module.exports = { ExtensionBuilder, BuildError };