#!/usr/bin/env node

/**
 * Script de Verificação de Integridade para Monitor SAU Extension
 * Verifica se todos os arquivos necessários estão incluídos no build
 */

const fs = require('fs').promises;
const path = require('path');

class IntegrityChecker {
  constructor() {
    this.rootDir = process.cwd();
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Adiciona erro
   */
  addError(message) {
    this.errors.push(message);
  }

  /**
   * Adiciona aviso
   */
  addWarning(message) {
    this.warnings.push(message);
  }

  /**
   * Verifica se todos os arquivos importados existem
   */
  async checkImports() {
    console.log('🔍 Verificando imports...');
    
    const jsFiles = [
      'background.js',
      'content.js',
      'content-sigss.js',
      'popup.js',
      'options.js',
      'help.js'
    ];
    
    for (const file of jsFiles) {
      try {
        const filePath = path.join(this.rootDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        // Extrai imports
        const importMatches = content.match(/import\s+.*?\s+from\s+['"](.*?)['"];?/g);
        
        if (importMatches) {
          for (const importMatch of importMatches) {
            const moduleMatch = importMatch.match(/from\s+['"](.*?)['"];?/);
            if (moduleMatch) {
              const modulePath = moduleMatch[1];
              
              // Ignora imports de URLs ou node_modules
              if (modulePath.startsWith('http') || !modulePath.startsWith('.')) {
                continue;
              }
              
              // Resolve caminho relativo
              const resolvedPath = path.resolve(path.dirname(filePath), modulePath);
              const relativePath = path.relative(this.rootDir, resolvedPath);
              
              try {
                await fs.access(resolvedPath);
              } catch (error) {
                this.addError(`${file}: import não encontrado: ${relativePath}`);
              }
            }
          }
        }
        
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.addWarning(`Erro ao verificar imports de ${file}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Verifica se arquivos do build.js existem
   */
  async checkBuildFiles() {
    console.log('🔍 Verificando arquivos do build...');
    
    // Lê configuração do build
    const buildScriptPath = path.join(this.rootDir, 'scripts', 'build.js');
    
    try {
      const buildContent = await fs.readFile(buildScriptPath, 'utf8');
      
      // Extrai lista de sourceFiles
      const sourceFilesMatch = buildContent.match(/sourceFiles:\s*\[(.*?)\]/s);
      
      if (sourceFilesMatch) {
        const sourceFilesStr = sourceFilesMatch[1];
        const sourceFiles = sourceFilesStr
          .split(',')
          .map(line => line.trim())
          .map(line => line.replace(/['"]/g, ''))
          .filter(line => line && !line.startsWith('//'));
        
        for (const file of sourceFiles) {
          const filePath = path.join(this.rootDir, file);
          
          try {
            const stats = await fs.stat(filePath);
            
            if (stats.isDirectory()) {
              // Verifica se diretório não está vazio
              const dirContents = await fs.readdir(filePath);
              if (dirContents.length === 0) {
                this.addWarning(`Diretório vazio no build: ${file}`);
              }
            }
            
          } catch (error) {
            this.addError(`Arquivo do build não encontrado: ${file}`);
          }
        }
        
        console.log(`✅ Verificados ${sourceFiles.length} arquivos do build`);
        
      } else {
        this.addError('Não foi possível extrair lista de sourceFiles do build.js');
      }
      
    } catch (error) {
      this.addError(`Erro ao ler build.js: ${error.message}`);
    }
  }

  /**
   * Verifica arquivos críticos que podem estar faltando
   */
  async checkCriticalFiles() {
    console.log('🔍 Verificando arquivos críticos...');
    
    const criticalFiles = [
      'data-compressor.js',
      'storage-validator.js',
      'content-backup.js',
      'tooltip-system.js',
      'sigss-tab-renamer.js'
    ];
    
    for (const file of criticalFiles) {
      const filePath = path.join(this.rootDir, file);
      
      try {
        await fs.access(filePath);
      } catch (error) {
        this.addError(`Arquivo crítico não encontrado: ${file}`);
      }
    }
  }

  /**
   * Verifica se manifests estão sincronizados
   */
  async checkManifestSync() {
    console.log('🔍 Verificando sincronização de manifests...');
    
    try {
      const chromeManifest = JSON.parse(
        await fs.readFile(path.join(this.rootDir, 'manifest.json'), 'utf8')
      );
      
      const firefoxManifest = JSON.parse(
        await fs.readFile(path.join(this.rootDir, 'manifest-firefox.json'), 'utf8')
      );
      
      // Verifica campos que devem ser iguais
      const fieldsToSync = ['name', 'version', 'description'];
      
      for (const field of fieldsToSync) {
        if (chromeManifest[field] !== firefoxManifest[field]) {
          this.addError(`Manifests dessincronizados no campo '${field}': Chrome="${chromeManifest[field]}" vs Firefox="${firefoxManifest[field]}"`);
        }
      }
      
      console.log('✅ Manifests verificados');
      
    } catch (error) {
      this.addError(`Erro ao verificar manifests: ${error.message}`);
    }
  }

  /**
   * Verifica package.json vs build.js
   */
  async checkPackageScripts() {
    console.log('🔍 Verificando scripts do package.json...');
    
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(this.rootDir, 'package.json'), 'utf8')
      );
      
      const requiredScripts = [
        'build',
        'build:chrome',
        'build:firefox',
        'validate',
        'clean',
        'release',
        'version:patch',
        'version:minor',
        'version:major'
      ];
      
      for (const script of requiredScripts) {
        if (!packageJson.scripts || !packageJson.scripts[script]) {
          this.addError(`Script obrigatório não encontrado no package.json: ${script}`);
        }
      }
      
      console.log('✅ Scripts do package.json verificados');
      
    } catch (error) {
      this.addError(`Erro ao verificar package.json: ${error.message}`);
    }
  }

  /**
   * Executa todas as verificações
   */
  async check() {
    console.log('🔍 Iniciando verificação de integridade...\n');
    
    await this.checkImports();
    await this.checkBuildFiles();
    await this.checkCriticalFiles();
    await this.checkManifestSync();
    await this.checkPackageScripts();
    
    // Relatório final
    console.log('\n📊 Relatório de Integridade:');
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ Projeto íntegro - nenhum problema encontrado!');
      return true;
    }
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Erros críticos (${this.errors.length}):`);
      for (const error of this.errors) {
        console.log(`   • ${error}`);
      }
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️  Avisos (${this.warnings.length}):`);
      for (const warning of this.warnings) {
        console.log(`   • ${warning}`);
      }
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ Verificação de integridade falhou - corrija os erros críticos');
      return false;
    } else {
      console.log('\n✅ Verificação de integridade passou - apenas avisos encontrados');
      return true;
    }
  }
}

// Execução principal
async function main() {
  const checker = new IntegrityChecker();
  const success = await checker.check();
  
  if (!success) {
    process.exit(1);
  }
}

// Executa apenas se chamado diretamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erro durante verificação de integridade:', error.message);
    process.exit(1);
  });
}

module.exports = { IntegrityChecker };