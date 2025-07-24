#!/usr/bin/env node

/**
 * Script de Validação para Monitor SAU Extension
 * Executa verificações de qualidade e segurança
 */

const fs = require('fs').promises;
const path = require('path');

class ValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

class ProjectValidator {
  constructor() {
    this.rootDir = process.cwd();
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Adiciona erro
   */
  addError(message, code = 'VALIDATION_ERROR') {
    this.errors.push({ message, code });
  }

  /**
   * Adiciona aviso
   */
  addWarning(message) {
    this.warnings.push(message);
  }

  /**
   * Valida estrutura de arquivos obrigatórios
   */
  async validateFileStructure() {
    console.log('🔍 Validando estrutura de arquivos...');
    
    const requiredFiles = [
      'manifest.json',
      'manifest-firefox.json',
      'background.js',
      'content.js',
      'popup.html',
      'popup.js',
      'popup.css',
      'options.html',
      'options.js',
      'options.css',
      'README.md',
      'CHANGELOG.md',
      'package.json'
    ];
    
    const requiredDirs = [
      'icons',
      'scripts'
    ];
    
    // Verifica arquivos
    for (const file of requiredFiles) {
      const filePath = path.join(this.rootDir, file);
      try {
        await fs.access(filePath);
      } catch (error) {
        this.addError(`Arquivo obrigatório não encontrado: ${file}`, 'MISSING_FILE');
      }
    }
    
    // Verifica diretórios
    for (const dir of requiredDirs) {
      const dirPath = path.join(this.rootDir, dir);
      try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
          this.addError(`${dir} deve ser um diretório`, 'INVALID_DIRECTORY');
        }
      } catch (error) {
        this.addError(`Diretório obrigatório não encontrado: ${dir}`, 'MISSING_DIRECTORY');
      }
    }
  }

  /**
   * Valida manifests
   */
  async validateManifests() {
    console.log('🔍 Validando manifests...');
    
    const manifests = [
      { file: 'manifest.json', browser: 'chrome' },
      { file: 'manifest-firefox.json', browser: 'firefox' }
    ];
    
    for (const { file, browser } of manifests) {
      try {
        const manifestPath = path.join(this.rootDir, file);
        const content = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(content);
        
        // Validações básicas
        if (!manifest.name) {
          this.addError(`${file}: campo 'name' obrigatório`, 'INVALID_MANIFEST');
        }
        
        if (!manifest.version) {
          this.addError(`${file}: campo 'version' obrigatório`, 'INVALID_MANIFEST');
        }
        
        if (!manifest.description) {
          this.addError(`${file}: campo 'description' obrigatório`, 'INVALID_MANIFEST');
        }
        
        if (manifest.manifest_version !== 3) {
          this.addError(`${file}: deve usar Manifest V3`, 'INVALID_MANIFEST_VERSION');
        }
        
        // Validações específicas do Firefox
        if (browser === 'firefox') {
          if (!manifest.browser_specific_settings?.gecko?.id) {
            this.addError(`${file}: Firefox requer browser_specific_settings.gecko.id`, 'MISSING_FIREFOX_ID');
          }
        }
        
        // Verifica permissões perigosas
        const dangerousPermissions = ['<all_urls>', 'http://*/*', 'https://*/*'];
        if (manifest.permissions) {
          for (const permission of manifest.permissions) {
            if (dangerousPermissions.includes(permission)) {
              this.addWarning(`${file}: permissão ampla detectada: ${permission}`);
            }
          }
        }
        
      } catch (error) {
        this.addError(`Erro ao validar ${file}: ${error.message}`, 'MANIFEST_PARSE_ERROR');
      }
    }
  }

  /**
   * Valida package.json
   */
  async validatePackageJson() {
    console.log('🔍 Validando package.json...');
    
    try {
      const packagePath = path.join(this.rootDir, 'package.json');
      const content = await fs.readFile(packagePath, 'utf8');
      const packageJson = JSON.parse(content);
      
      // Campos obrigatórios
      const requiredFields = ['name', 'version', 'description'];
      for (const field of requiredFields) {
        if (!packageJson[field]) {
          this.addError(`package.json: campo '${field}' obrigatório`, 'INVALID_PACKAGE_JSON');
        }
      }
      
      // Scripts obrigatórios
      const requiredScripts = ['build', 'release', 'clean'];
      if (packageJson.scripts) {
        for (const script of requiredScripts) {
          if (!packageJson.scripts[script]) {
            this.addWarning(`package.json: script '${script}' recomendado`);
          }
        }
      } else {
        this.addError('package.json: seção scripts obrigatória', 'MISSING_SCRIPTS');
      }
      
    } catch (error) {
      this.addError(`Erro ao validar package.json: ${error.message}`, 'PACKAGE_JSON_ERROR');
    }
  }

  /**
   * Valida arquivos JavaScript
   */
  async validateJavaScript() {
    console.log('🔍 Validando arquivos JavaScript...');
    
    const jsFiles = [
      'background.js',
      'content.js',
      'popup.js',
      'options.js',
      'logger.js'
    ];
    
    for (const file of jsFiles) {
      try {
        const filePath = path.join(this.rootDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        // Verifica sintaxe básica
        if (content.includes('eval(')) {
          this.addError(`${file}: uso de eval() detectado - risco de segurança`, 'SECURITY_RISK');
        }
        
        if (content.includes('innerHTML') && !content.includes('textContent')) {
          this.addWarning(`${file}: uso de innerHTML detectado - considere textContent para segurança`);
        }
        
        // Verifica console.log em produção
        if (content.includes('console.log') && !file.includes('logger')) {
          this.addWarning(`${file}: console.log detectado - use sistema de logging`);
        }
        
        // Verifica imports/exports
        if (content.includes('import ') && !content.includes('export ')) {
          this.addWarning(`${file}: arquivo importa mas não exporta - verifique se está correto`);
        }
        
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.addError(`Erro ao validar ${file}: ${error.message}`, 'JS_VALIDATION_ERROR');
        }
      }
    }
  }

  /**
   * Valida CHANGELOG
   */
  async validateChangelog() {
    console.log('🔍 Validando CHANGELOG...');
    
    try {
      const changelogPath = path.join(this.rootDir, 'CHANGELOG.md');
      const content = await fs.readFile(changelogPath, 'utf8');
      
      // Verifica formato Keep a Changelog
      if (!content.includes('## [Unreleased]')) {
        this.addError('CHANGELOG.md: deve ter seção [Unreleased]', 'INVALID_CHANGELOG');
      }
      
      if (!content.includes('### Added') && !content.includes('### Changed') && 
          !content.includes('### Fixed') && !content.includes('### Removed')) {
        this.addWarning('CHANGELOG.md: deve usar categorias padrão (Added, Changed, Fixed, Removed)');
      }
      
      // Verifica se há conteúdo na seção Unreleased
      const unreleasedMatch = content.match(/## \[Unreleased\](.*?)(?=## \[|$)/s);
      if (unreleasedMatch && unreleasedMatch[1].trim().length < 20) {
        this.addWarning('CHANGELOG.md: seção [Unreleased] parece vazia');
      }
      
    } catch (error) {
      this.addError(`Erro ao validar CHANGELOG.md: ${error.message}`, 'CHANGELOG_ERROR');
    }
  }

  /**
   * Valida ícones
   */
  async validateIcons() {
    console.log('🔍 Validando ícones...');
    
    const requiredIcons = ['icon16.png', 'icon48.png', 'icon128.png'];
    const iconsDir = path.join(this.rootDir, 'icons');
    
    for (const icon of requiredIcons) {
      try {
        const iconPath = path.join(iconsDir, icon);
        const stats = await fs.stat(iconPath);
        
        if (stats.size === 0) {
          this.addError(`Ícone ${icon} está vazio`, 'EMPTY_ICON');
        }
        
        if (stats.size > 50 * 1024) { // 50KB
          this.addWarning(`Ícone ${icon} é muito grande (${Math.round(stats.size / 1024)}KB)`);
        }
        
      } catch (error) {
        this.addError(`Ícone obrigatório não encontrado: ${icon}`, 'MISSING_ICON');
      }
    }
  }

  /**
   * Valida segurança
   */
  async validateSecurity() {
    console.log('🔍 Validando segurança...');
    
    // Verifica se há arquivos sensíveis
    const sensitiveFiles = [
      '.env',
      '.env.local',
      'config.json',
      'secrets.json',
      'private.key',
      '.ssh'
    ];
    
    for (const file of sensitiveFiles) {
      try {
        const filePath = path.join(this.rootDir, file);
        await fs.access(filePath);
        this.addError(`Arquivo sensível detectado: ${file}`, 'SENSITIVE_FILE');
      } catch (error) {
        // Arquivo não existe - ok
      }
    }
    
    // Verifica .gitignore
    try {
      const gitignorePath = path.join(this.rootDir, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf8');
      
      const requiredIgnores = ['node_modules', '.dist', '*.log', '.env'];
      for (const ignore of requiredIgnores) {
        if (!content.includes(ignore)) {
          this.addWarning(`.gitignore: deve incluir ${ignore}`);
        }
      }
      
    } catch (error) {
      this.addWarning('.gitignore não encontrado - recomendado para projetos Git');
    }
  }

  /**
   * Executa todas as validações
   */
  async validate() {
    console.log('🔍 Iniciando validação do projeto...\n');
    
    await this.validateFileStructure();
    await this.validateManifests();
    await this.validatePackageJson();
    await this.validateJavaScript();
    await this.validateChangelog();
    await this.validateIcons();
    await this.validateSecurity();
    
    // Relatório final
    console.log('\n📊 Relatório de Validação:');
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ Nenhum problema encontrado!');
      return true;
    }
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Erros (${this.errors.length}):`);
      for (const error of this.errors) {
        console.log(`   • ${error.message}`);
      }
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️  Avisos (${this.warnings.length}):`);
      for (const warning of this.warnings) {
        console.log(`   • ${warning}`);
      }
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ Validação falhou - corrija os erros antes de continuar');
      return false;
    } else {
      console.log('\n✅ Validação passou - apenas avisos encontrados');
      return true;
    }
  }
}

// Execução principal
async function main() {
  const validator = new ProjectValidator();
  const success = await validator.validate();
  
  if (!success) {
    process.exit(1);
  }
}

// Executa apenas se chamado diretamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erro durante validação:', error.message);
    process.exit(1);
  });
}

module.exports = { ProjectValidator, ValidationError };