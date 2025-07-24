#!/usr/bin/env node

/**
 * Script de Versionamento para Monitor SAU Extension
 * Atualiza versões nos manifests e package.json seguindo SemVer
 */

const fs = require('fs').promises;
const path = require('path');
const semver = require('semver');

class VersionError extends Error {
  constructor(message, code = 'VERSION_ERROR') {
    super(message);
    this.name = 'VersionError';
    this.code = code;
  }
}

class VersionManager {
  constructor() {
    this.rootDir = process.cwd();
    this.packageJsonPath = path.join(this.rootDir, 'package.json');
    this.manifestPaths = [
      path.join(this.rootDir, 'manifest.json'),
      path.join(this.rootDir, 'manifest-firefox.json')
    ];
  }

  /**
   * Lê a versão atual do package.json
   */
  async getCurrentVersion() {
    try {
      const packageContent = await fs.readFile(this.packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      if (!packageJson.version) {
        throw new VersionError('Versão não encontrada no package.json', 'NO_VERSION');
      }
      
      if (!semver.valid(packageJson.version)) {
        throw new VersionError(
          `Versão inválida no package.json: ${packageJson.version}`,
          'INVALID_VERSION'
        );
      }
      
      return packageJson.version;
      
    } catch (error) {
      if (error instanceof VersionError) throw error;
      throw new VersionError(
        `Erro ao ler package.json: ${error.message}`,
        'READ_ERROR'
      );
    }
  }

  /**
   * Valida se todas as versões estão sincronizadas
   */
  async validateVersionSync() {
    console.log('🔍 Validando sincronização de versões...');
    
    const packageVersion = await this.getCurrentVersion();
    const versions = { 'package.json': packageVersion };
    
    // Verifica manifests
    for (const manifestPath of this.manifestPaths) {
      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestContent);
        
        const fileName = path.basename(manifestPath);
        versions[fileName] = manifest.version;
        
        if (manifest.version !== packageVersion) {
          console.warn(`⚠️  Versão dessincronizada em ${fileName}: ${manifest.version} (esperado: ${packageVersion})`);
        }
        
      } catch (error) {
        console.warn(`⚠️  Não foi possível ler ${path.basename(manifestPath)}: ${error.message}`);
      }
    }
    
    return versions;
  }

  /**
   * Incrementa versão seguindo SemVer
   */
  incrementVersion(currentVersion, type) {
    const validTypes = ['patch', 'minor', 'major', 'prerelease'];
    
    if (!validTypes.includes(type)) {
      throw new VersionError(
        `Tipo de incremento inválido: ${type}. Use: ${validTypes.join(', ')}`,
        'INVALID_INCREMENT_TYPE'
      );
    }
    
    const newVersion = semver.inc(currentVersion, type);
    
    if (!newVersion) {
      throw new VersionError(
        `Erro ao incrementar versão ${currentVersion} com tipo ${type}`,
        'INCREMENT_ERROR'
      );
    }
    
    return newVersion;
  }

  /**
   * Atualiza versão em um arquivo JSON
   */
  async updateJsonVersion(filePath, newVersion) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const json = JSON.parse(content);
      
      json.version = newVersion;
      
      const updatedContent = JSON.stringify(json, null, 2) + '\n';
      await fs.writeFile(filePath, updatedContent, 'utf8');
      
      console.log(`✅ Atualizado ${path.basename(filePath)}: ${newVersion}`);
      
    } catch (error) {
      throw new VersionError(
        `Erro ao atualizar ${path.basename(filePath)}: ${error.message}`,
        'UPDATE_ERROR'
      );
    }
  }

  /**
   * Atualiza versão em todos os arquivos
   */
  async updateVersion(incrementType) {
    try {
      console.log('🔄 Iniciando atualização de versão...\n');
      
      // Valida estado atual
      const currentVersions = await this.validateVersionSync();
      const currentVersion = await this.getCurrentVersion();
      
      console.log(`📋 Versão atual: ${currentVersion}`);
      
      // Calcula nova versão
      const newVersion = this.incrementVersion(currentVersion, incrementType);
      console.log(`🆕 Nova versão: ${newVersion} (${incrementType})\n`);
      
      // Confirma com o usuário (em ambiente interativo)
      if (process.stdin.isTTY) {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
          rl.question(`Confirma a atualização para v${newVersion}? (y/N): `, resolve);
        });
        
        rl.close();
        
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('❌ Atualização cancelada pelo usuário');
          return null;
        }
      }
      
      // Atualiza package.json
      await this.updateJsonVersion(this.packageJsonPath, newVersion);
      
      // Atualiza manifests
      for (const manifestPath of this.manifestPaths) {
        try {
          await this.updateJsonVersion(manifestPath, newVersion);
        } catch (error) {
          console.warn(`⚠️  Não foi possível atualizar ${path.basename(manifestPath)}: ${error.message}`);
        }
      }
      
      console.log('\n🎉 Versão atualizada com sucesso!');
      console.log('\n📝 Próximos passos:');
      console.log('   1. Revisar as mudanças');
      console.log('   2. Atualizar CHANGELOG.md');
      console.log('   3. Fazer commit das mudanças');
      console.log('   4. Executar npm run build');
      console.log('   5. Executar npm run release');
      
      return {
        oldVersion: currentVersion,
        newVersion,
        incrementType,
        updatedFiles: ['package.json', ...this.manifestPaths.map(p => path.basename(p))]
      };
      
    } catch (error) {
      console.error('\n❌ Erro durante atualização de versão:');
      console.error(`   ${error.message}`);
      
      if (error.code) {
        console.error(`   Código: ${error.code}`);
      }
      
      process.exit(1);
    }
  }

  /**
   * Mostra informações da versão atual
   */
  async showVersionInfo() {
    try {
      console.log('📊 Informações de Versão\n');
      
      const versions = await this.validateVersionSync();
      
      for (const [file, version] of Object.entries(versions)) {
        console.log(`   ${file}: ${version}`);
      }
      
      const currentVersion = await this.getCurrentVersion();
      
      console.log('\n🔮 Próximas versões possíveis:');
      console.log(`   patch: ${semver.inc(currentVersion, 'patch')}`);
      console.log(`   minor: ${semver.inc(currentVersion, 'minor')}`);
      console.log(`   major: ${semver.inc(currentVersion, 'major')}`);
      
    } catch (error) {
      console.error('❌ Erro ao obter informações de versão:', error.message);
      process.exit(1);
    }
  }
}

// Execução principal
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📖 Uso: node version.js <patch|minor|major|info>');
    console.log('\nExemplos:');
    console.log('   node version.js patch   # 1.0.0 → 1.0.1');
    console.log('   node version.js minor   # 1.0.0 → 1.1.0');
    console.log('   node version.js major   # 1.0.0 → 2.0.0');
    console.log('   node version.js info    # Mostra versões atuais');
    process.exit(1);
  }
  
  const command = args[0];
  const versionManager = new VersionManager();
  
  if (command === 'info') {
    await versionManager.showVersionInfo();
  } else {
    await versionManager.updateVersion(command);
  }
}

// Executa apenas se chamado diretamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erro fatal:', error.message);
    process.exit(1);
  });
}

module.exports = { VersionManager, VersionError };